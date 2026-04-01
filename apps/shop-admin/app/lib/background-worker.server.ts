import {
  BackgroundJobKind,
  BackgroundJobStatus,
  ScanRunTrigger,
} from "@prisma/client";
import {
  claimNextBackgroundJob,
  createAutoScanSyncDedupeKey,
  enqueueBackgroundJob,
  getLatestTaxonomyVersion,
  getScanRunById,
  markBackgroundJobDeadLetter,
  markBackgroundJobFailed,
  markBackgroundJobPending,
  markBackgroundJobSucceeded,
  markScanRunFailed,
  markScanRunRunning,
  syncRuleDefinitions,
  updateBackgroundJob,
  createScanRun,
  findActiveScanRunForShop,
  type BackgroundJobSummary,
  type BackgroundJobsDatabaseClient,
} from "@categoryfix/db";
import { PHASE3_RULE_DEFINITIONS } from "@categoryfix/domain";
import { createLogger } from "@categoryfix/shopify-core";
import {
  resolveOfflineAdminContext,
  type OfflineAdminContext,
} from "./offline-admin.server.js";
import {
  SCAN_SOURCE,
  startBulkProductScan,
  syncRunningScan,
  type Phase3DatabaseClient,
} from "./scans.server.js";

const CLAIM_LEASE_MS = 60_000;
const RUNNING_REQUEUE_MS = 30_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;

export type Phase6DatabaseClient = Phase3DatabaseClient & BackgroundJobsDatabaseClient;

function readPayload(job: BackgroundJobSummary) {
  return job.payload ?? {};
}

function buildRetryDelay(job: BackgroundJobSummary) {
  return RETRY_DELAYS_MS[job.attemptCount] ?? null;
}

async function ensureSyncJob(scanRunId: string, shopId: string, database: Phase6DatabaseClient) {
  return enqueueBackgroundJob(
    {
      shopId,
      kind: BackgroundJobKind.AUTO_SCAN_SYNC,
      dedupeKey: createAutoScanSyncDedupeKey(scanRunId),
      payload: {
        scanRunId,
      },
    },
    database,
  );
}

async function deadLetterJob(args: {
  job: BackgroundJobSummary;
  database: Phase6DatabaseClient;
  errorMessage: string;
  scanRunId?: string;
}) {
  if (args.scanRunId) {
    await markScanRunFailed(
      {
        scanRunId: args.scanRunId,
        failureSummary: args.errorMessage,
      },
      args.database,
    ).catch(() => null);
  }

  return markBackgroundJobDeadLetter(
    {
      jobId: args.job.id,
      lastError: args.errorMessage,
    },
    args.database,
  );
}

async function retryOrDeadLetter(args: {
  job: BackgroundJobSummary;
  database: Phase6DatabaseClient;
  errorMessage: string;
  scanRunId?: string;
}) {
  const retryDelay = buildRetryDelay(args.job);

  if (retryDelay === null) {
    return deadLetterJob(args);
  }

  return markBackgroundJobFailed(
    {
      jobId: args.job.id,
      availableAt: new Date(Date.now() + retryDelay),
      lastError: args.errorMessage,
    },
    args.database,
  );
}

async function runAutoScanStartJob(args: {
  job: BackgroundJobSummary;
  database: Phase6DatabaseClient;
  resolveOfflineContext?: typeof resolveOfflineAdminContext;
}) {
  const payload = readPayload(args.job);
  const resolveContext = args.resolveOfflineContext ?? resolveOfflineAdminContext;

  if (payload.scanRunId) {
    const existingScanRun = await getScanRunById(
      {
        shopId: args.job.shopId,
        scanRunId: payload.scanRunId,
      },
      args.database,
    );

    if (existingScanRun?.externalOperationId) {
      await ensureSyncJob(existingScanRun.id, args.job.shopId, args.database);

      return markBackgroundJobSucceeded({ jobId: args.job.id }, args.database);
    }
  }

  const activeScanRun = await findActiveScanRunForShop(args.job.shopId, args.database);

  if (activeScanRun && activeScanRun.id !== payload.scanRunId) {
    return markBackgroundJobPending(
      {
        jobId: args.job.id,
        availableAt: new Date(Date.now() + RUNNING_REQUEUE_MS),
      },
      args.database,
    );
  }

  const offlineAdmin = await resolveContext({
    shop: args.job.shopDomain,
    database: args.database,
  });
  const taxonomyVersion = await getLatestTaxonomyVersion("en", args.database);

  if (!taxonomyVersion) {
    throw new Error("No taxonomy snapshot is available for scanning.");
  }

  await syncRuleDefinitions(
    {
      definitions: PHASE3_RULE_DEFINITIONS.map((definition) => ({
        key: definition.key,
        version: definition.version,
        description: definition.description,
        priority: definition.priority,
        configuration: definition.configuration,
      })),
    },
    args.database,
  );

  let scanRunId = payload.scanRunId;

  if (!scanRunId) {
    const scanRun = await createScanRun(
      {
        shopId: args.job.shopId,
        trigger: ScanRunTrigger.WEBHOOK,
        source: SCAN_SOURCE,
        taxonomyVersionId: taxonomyVersion.id,
      },
      args.database,
    );
    scanRunId = scanRun.id;

    await updateBackgroundJob(
      {
        jobId: args.job.id,
        payload: {
          ...payload,
          scanRunId,
        },
      },
      args.database,
    );
  }

  const operation = await startBulkProductScan((offlineAdmin as OfflineAdminContext).admin);

  await markScanRunRunning(
    {
      scanRunId,
      externalOperationId: operation.id,
      externalOperationStatus: operation.status,
    },
    args.database,
  );
  await ensureSyncJob(scanRunId, args.job.shopId, args.database);

  return markBackgroundJobSucceeded({ jobId: args.job.id }, args.database);
}

async function runAutoScanSyncJob(args: {
  job: BackgroundJobSummary;
  database: Phase6DatabaseClient;
  resolveOfflineContext?: typeof resolveOfflineAdminContext;
  fetchImpl?: typeof fetch;
}) {
  const payload = readPayload(args.job);

  if (!payload.scanRunId) {
    throw new Error("Auto-scan sync jobs require a scanRunId.");
  }

  const scanRun = await getScanRunById(
    {
      shopId: args.job.shopId,
      scanRunId: payload.scanRunId,
    },
    args.database,
  );

  if (!scanRun) {
    throw new Error(`Scan run ${payload.scanRunId} was not found.`);
  }

  const result = await syncRunningScan({
    scanRun,
    shop: args.job.shopDomain,
    database: args.database,
    ...(args.resolveOfflineContext
      ? { getOfflineAdminContext: args.resolveOfflineContext }
      : {}),
    ...(args.fetchImpl ? { fetchImpl: args.fetchImpl } : {}),
  });

  if (result.outcome === "RUNNING") {
    return markBackgroundJobPending(
      {
        jobId: args.job.id,
        availableAt: new Date(Date.now() + RUNNING_REQUEUE_MS),
      },
      args.database,
    );
  }

  if (result.outcome === "SUCCEEDED") {
    return markBackgroundJobSucceeded({ jobId: args.job.id }, args.database);
  }

  if (result.outcome === "FAILED") {
    return deadLetterJob({
      job: args.job,
      database: args.database,
      errorMessage:
        result.errorMessage ??
        result.scanRun.failureSummary ??
        "CategoryFix could not complete the webhook-triggered scan.",
      scanRunId: payload.scanRunId,
    });
  }

  return retryOrDeadLetter({
    job: args.job,
    database: args.database,
    errorMessage:
      result.errorMessage ??
      "CategoryFix could not refresh the webhook-triggered scan yet.",
    scanRunId: payload.scanRunId,
  });
}

export async function runBackgroundWorkerOnce(args: {
  database: Phase6DatabaseClient;
  workerId: string;
  resolveOfflineContext?: typeof resolveOfflineAdminContext;
  fetchImpl?: typeof fetch;
}) {
  const job = await claimNextBackgroundJob(
    {
      workerId: args.workerId,
      leaseMs: CLAIM_LEASE_MS,
    },
    args.database,
  );

  if (!job) {
    return false;
  }

  const logger = createLogger({
    workerId: args.workerId,
    jobId: job.id,
    shopId: job.shopDomain,
    kind: job.kind,
  });

  logger.info("categoryfix.background_job.claimed", {
    status: job.status,
  });

  try {
    const outcome =
      job.kind === BackgroundJobKind.AUTO_SCAN_START
        ? await runAutoScanStartJob({
            job,
            database: args.database,
            ...(args.resolveOfflineContext
              ? { resolveOfflineContext: args.resolveOfflineContext }
              : {}),
          })
        : await runAutoScanSyncJob({
            job,
            database: args.database,
            ...(args.resolveOfflineContext
              ? { resolveOfflineContext: args.resolveOfflineContext }
              : {}),
            ...(args.fetchImpl ? { fetchImpl: args.fetchImpl } : {}),
          });

    logger.info("categoryfix.background_job.completed", {
      status: outcome.status,
      attempts: outcome.attemptCount,
    });

    return true;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "CategoryFix could not process the background job.";
    const outcome = await retryOrDeadLetter({
      job,
      database: args.database,
      errorMessage: message,
      ...(readPayload(job).scanRunId
        ? { scanRunId: readPayload(job).scanRunId }
        : {}),
    });

    logger.error("categoryfix.background_job.failed", error, {
      status: outcome.status,
      attempts: outcome.attemptCount,
      errorMessage: message,
    });

    return true;
  }
}

export async function runBackgroundWorkerLoop(args: {
  database: Phase6DatabaseClient;
  workerId?: string;
  idleMs?: number;
  resolveOfflineContext?: typeof resolveOfflineAdminContext;
  fetchImpl?: typeof fetch;
}) {
  const workerId = args.workerId ?? `worker-${process.pid}`;
  const idleMs = args.idleMs ?? 2_000;

  while (true) {
    const processed = await runBackgroundWorkerOnce({
      database: args.database,
      workerId,
      ...(args.resolveOfflineContext
        ? { resolveOfflineContext: args.resolveOfflineContext }
        : {}),
      ...(args.fetchImpl ? { fetchImpl: args.fetchImpl } : {}),
    });

    if (!processed) {
      await new Promise((resolve) => {
        setTimeout(resolve, idleMs);
      });
    }
  }
}
