import {
  ScanFindingStatus,
  ScanRunStatus,
  type ScanFindingConfidence,
} from "@prisma/client";
import {
  getLatestScanRunForShop,
  listAuditTimelineForShop,
  listRecentApplyJobsForShop,
  listRecentRollbackJobsForShop,
  getScanFindingDetailForReview,
  getScanRunById,
  listRecentScanRunsForShop,
  listScanFindingsForReview,
  updateScanFindingStatuses,
  type ApplyJobSummary,
  type ApplyJobsDatabaseClient,
  type AuditTimelineEntry,
  type RollbackJobSummary,
  type ScanDatabaseClient,
  type ScanFindingReviewFilters,
  type ScanFindingReviewPage,
  type ScanRunDetail,
  type ShopSettingsSnapshot,
} from "@categoryfix/db";
import { z } from "zod";
import { getMockReviewDatabase } from "./scan-review.mock.server.js";

const reviewActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("accept_safe_deterministic"),
  }),
  z.object({
    intent: z.literal("accept_selected"),
    findingIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    intent: z.literal("dismiss_selected"),
    findingIds: z.array(z.string().min(1)).min(1),
  }),
]);

export interface ReviewShopLookupClient {
  shop: {
    findUnique(args: unknown): Promise<unknown>;
  };
}

export type ReviewLoaderDatabaseClient = ScanDatabaseClient &
  ApplyJobsDatabaseClient &
  ReviewShopLookupClient;

export interface AuthenticatedAdminContext {
  session: {
    shop: string;
  };
}

export interface ScanDashboardPayload {
  installation: ShopSettingsSnapshot | null;
  latestScan: {
    scanRun: {
      id: string;
      status: string;
      trigger: string;
      source: string;
      startedAt: string | null;
      completedAt: string | null;
      scannedProductCount: number;
      findingCount: number;
      acceptedFindingCount: number;
      rejectedFindingCount: number;
      failureSummary: string | null;
    } | null;
    confidenceCounts: {
      exact: number;
      strong: number;
      reviewRequired: number;
      noSafeSuggestion: number;
    };
  };
  scanHistory: Awaited<ReturnType<typeof listRecentScanRunsForShop>>;
  shop: string;
  reviewPath: string | null;
  scanEndpoint: string;
}

export interface ScanReviewRoutePayload {
  applyJobs: ApplyJobSummary[];
  auditTimeline: AuditTimelineEntry[];
  filters: ScanFindingReviewPage["filters"];
  findingsPage: ScanFindingReviewPage;
  pollEndpoint: string;
  rollbackJobs: RollbackJobSummary[];
  scanRun: ScanRunDetail;
  scanHistory: Awaited<ReturnType<typeof listRecentScanRunsForShop>>;
  selectedFinding: Awaited<ReturnType<typeof getScanFindingDetailForReview>>;
  shop: string;
  readOnly: boolean;
}

function resolveReviewDatabase(database: ReviewLoaderDatabaseClient) {
  return process.env.CATEGORYFIX_E2E_MOCK === "1" ? getMockReviewDatabase() : database;
}

function serializeScanPayload(scanRun: ScanRunDetail | null) {
  return {
    scanRun: scanRun
      ? {
          id: scanRun.id,
          status: scanRun.status,
          trigger: scanRun.trigger,
          source: scanRun.source,
          startedAt: scanRun.startedAt,
          completedAt: scanRun.completedAt,
          scannedProductCount: scanRun.scannedProductCount,
          findingCount: scanRun.findingCount,
          acceptedFindingCount: scanRun.acceptedFindingCount,
          rejectedFindingCount: scanRun.rejectedFindingCount,
          failureSummary: scanRun.failureSummary,
        }
      : null,
    confidenceCounts: scanRun?.confidenceCounts ?? {
      exact: 0,
      strong: 0,
      reviewRequired: 0,
      noSafeSuggestion: 0,
    },
  };
}

function parseFilters(request: Request): ScanFindingReviewFilters {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const status = url.searchParams.get("status");
  const confidence = url.searchParams.get("confidence");
  const query = url.searchParams.get("query");

  return {
    page: Number.isFinite(page) ? page : 1,
    status:
      status === "ALL" || !status ? "ALL" : (status as ScanFindingStatus | "ALL"),
    confidence:
      confidence === "ALL" || !confidence
        ? "ALL"
        : (confidence as ScanFindingConfidence | "ALL"),
    query,
  };
}

function splitScopes(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function loadShopSettingsSnapshot(
  shop: string,
  database: ReviewShopLookupClient,
): Promise<ShopSettingsSnapshot | null> {
  const record = (await database.shop.findUnique({
    where: { shop },
  })) as
    | {
        shop: string;
        state: ShopSettingsSnapshot["state"];
        scopes: string | null;
        appUrl: string | null;
        offlineSessionId: string | null;
        installedAt: Date;
        uninstalledAt: Date | null;
      }
    | null;

  if (!record) {
    return null;
  }

  return {
    shop: record.shop,
    state: record.state,
    scopes: splitScopes(record.scopes),
    appUrl: record.appUrl,
    offlineSessionId: record.offlineSessionId,
    installedAt: record.installedAt.toISOString(),
    uninstalledAt: record.uninstalledAt?.toISOString() ?? null,
  };
}

async function requireShopRecord(
  shop: string,
  database: ReviewShopLookupClient,
) {
  return database.shop.findUnique({
    where: { shop },
    select: { id: true, shop: true },
  }) as Promise<{ id: string; shop: string } | null>;
}

export async function createScanDashboardResponse(args: {
  request: Request;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: ReviewLoaderDatabaseClient;
}): Promise<Response> {
  const database = resolveReviewDatabase(args.database);
  const { session } = await args.authenticateAdmin(args.request);
  const installation = await loadShopSettingsSnapshot(session.shop, database);
  const shopRecord = await requireShopRecord(session.shop, database);
  const latestScan = shopRecord
    ? await getLatestScanRunForShop(shopRecord.id, database)
    : null;
  const scanHistory = shopRecord
    ? await listRecentScanRunsForShop({ shopId: shopRecord.id, limit: 10 }, database)
    : [];
  const reviewPath = latestScan ? `/app/scans/${latestScan.id}` : null;
  const payload: ScanDashboardPayload = {
    installation,
    latestScan: serializeScanPayload(latestScan),
    scanHistory,
    shop: session.shop,
    reviewPath,
    scanEndpoint: "/api/v1/scans",
  };

  return Response.json(payload);
}

export async function createScanReviewResponse(args: {
  request: Request;
  scanRunId: string;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: ReviewLoaderDatabaseClient;
}): Promise<Response> {
  const database = resolveReviewDatabase(args.database);
  const { session } = await args.authenticateAdmin(args.request);
  const shopRecord = await requireShopRecord(session.shop, database);

  if (!shopRecord) {
    return Response.json({ error: "Shop installation not found." }, { status: 404 });
  }

  const scanRun = await getScanRunById(
    {
      shopId: shopRecord.id,
      scanRunId: args.scanRunId,
    },
    database,
  );

  if (!scanRun) {
    return Response.json({ error: "Scan run not found." }, { status: 404 });
  }

  const filters = parseFilters(args.request);
  const findingsPage = await listScanFindingsForReview(
    {
      shopId: shopRecord.id,
      scanRunId: args.scanRunId,
      filters,
    },
    database,
  );

  if (!findingsPage) {
    return Response.json({ error: "Scan findings not found." }, { status: 404 });
  }

  const url = new URL(args.request.url);
  const findingId = url.searchParams.get("findingId");
  const selectedFinding = findingId
    ? await getScanFindingDetailForReview(
        {
          shopId: shopRecord.id,
          scanRunId: args.scanRunId,
          findingId,
        },
        database,
      )
    : null;
  const scanHistory = await listRecentScanRunsForShop(
    { shopId: shopRecord.id, limit: 10 },
    database,
  );
  const applyJobs = await listRecentApplyJobsForShop(
    { shopId: shopRecord.id, limit: 5 },
    database,
  );
  const rollbackJobs = await listRecentRollbackJobsForShop(
    { shopId: shopRecord.id, limit: 5 },
    database,
  );
  const auditTimeline = await listAuditTimelineForShop(
    { shopId: shopRecord.id, limit: 20 },
    database,
  );
  const payload: ScanReviewRoutePayload = {
    applyJobs,
    auditTimeline,
    filters: findingsPage.filters,
    findingsPage,
    pollEndpoint: `/api/v1/scans/${scanRun.id}`,
    rollbackJobs,
    scanRun,
    scanHistory,
    selectedFinding,
    shop: session.shop,
    readOnly:
      scanRun.status === ScanRunStatus.PENDING || scanRun.status === ScanRunStatus.RUNNING,
  };

  return Response.json(payload);
}

export async function createReviewMutationResponse(args: {
  request: Request;
  scanRunId: string;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: ReviewLoaderDatabaseClient;
}): Promise<Response> {
  const database = resolveReviewDatabase(args.database);
  const { session } = await args.authenticateAdmin(args.request);
  const shopRecord = await requireShopRecord(session.shop, database);

  if (!shopRecord) {
    return Response.json({ error: "Shop installation not found." }, { status: 404 });
  }

  const scanRun = await getScanRunById(
    {
      shopId: shopRecord.id,
      scanRunId: args.scanRunId,
    },
    database,
  );

  if (!scanRun) {
    return Response.json({ error: "Scan run not found." }, { status: 404 });
  }

  if (scanRun.status === ScanRunStatus.PENDING || scanRun.status === ScanRunStatus.RUNNING) {
    return Response.json(
      { error: "Review actions are unavailable while the scan is still running." },
      { status: 409 },
    );
  }

  const formData = await args.request.formData();
  const findingIds = formData
    .getAll("findingId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const parsed = reviewActionSchema.safeParse({
    intent: formData.get("intent"),
    findingIds,
  });

  if (!parsed.success) {
    return Response.json({ error: "The review action payload is invalid." }, { status: 400 });
  }

  const result =
    parsed.data.intent === "accept_safe_deterministic"
      ? await updateScanFindingStatuses(
          {
            shopId: shopRecord.id,
            scanRunId: args.scanRunId,
            targetStatus: ScanFindingStatus.ACCEPTED,
            safeDeterministicOnly: true,
          },
          database,
        )
      : parsed.data.intent === "accept_selected"
        ? await updateScanFindingStatuses(
            {
              shopId: shopRecord.id,
              scanRunId: args.scanRunId,
              targetStatus: ScanFindingStatus.ACCEPTED,
              findingIds: parsed.data.findingIds,
            },
            database,
          )
        : await updateScanFindingStatuses(
            {
              shopId: shopRecord.id,
              scanRunId: args.scanRunId,
              targetStatus: ScanFindingStatus.DISMISSED,
              findingIds: parsed.data.findingIds,
            },
            database,
          );

  if (!result) {
    return Response.json({ error: "Scan run not found." }, { status: 404 });
  }

  return Response.json({
    updatedCount: result.updatedCount,
    previewCounts: result.previewCounts,
    scanRun: serializeScanPayload(result.scanRun).scanRun,
  });
}
