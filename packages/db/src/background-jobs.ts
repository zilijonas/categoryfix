import {
  BackgroundJobKind,
  BackgroundJobStatus,
  Prisma,
  ScanRunStatus,
  ScanRunTrigger,
  WebhookDeliveryStatus,
} from "@prisma/client";
import { prisma } from "./client.js";

const AUTO_SCAN_KINDS = [
  BackgroundJobKind.AUTO_SCAN_START,
  BackgroundJobKind.AUTO_SCAN_SYNC,
] as const;

type BackgroundJobRecord = Prisma.BackgroundJobGetPayload<{
  include: {
    shop: {
      select: {
        shop: true;
      };
    };
  };
}>;

type WebhookDeliveryRecord = Prisma.WebhookDeliveryGetPayload<{
  select: {
    id: true;
    shopId: true;
    topic: true;
    webhookId: true;
    productId: true;
    productGid: true;
    productHandle: true;
    productTitle: true;
    status: true;
    failureSummary: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

type WebhookScanRecord = Prisma.ScanRunGetPayload<{
  select: {
    id: true;
    status: true;
    source: true;
    startedAt: true;
    completedAt: true;
    failureSummary: true;
  };
}>;

export interface BackgroundJobPayload {
  scanRunId?: string;
  latestDeliveryAt?: string;
  latestWebhookId?: string;
  latestTopic?: string;
}

export interface BackgroundJobSummary {
  id: string;
  shopId: string;
  shopDomain: string;
  kind: BackgroundJobKind;
  status: BackgroundJobStatus;
  dedupeKey: string | null;
  payload: BackgroundJobPayload | null;
  attemptCount: number;
  availableAt: string;
  lockedAt: string | null;
  leaseExpiresAt: string | null;
  workerId: string | null;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliverySummary {
  id: string;
  shopId: string;
  topic: string;
  webhookId: string;
  productId: string | null;
  productGid: string | null;
  productHandle: string | null;
  productTitle: string | null;
  status: WebhookDeliveryStatus;
  failureSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookScanSummary {
  id: string;
  status: ScanRunStatus;
  source: string;
  startedAt: string | null;
  completedAt: string | null;
  failureSummary: string | null;
}

export interface ShopFreshnessSummary {
  lastWebhookScan: WebhookScanSummary | null;
  autoRescanPending: boolean;
  recentWebhookDeliveryCount: number;
  latestIssue: BackgroundJobSummary | null;
  recentJobs: BackgroundJobSummary[];
}

export interface RecordWebhookDeliveryResult {
  duplicate: boolean;
  delivery: WebhookDeliverySummary | null;
  job: BackgroundJobSummary | null;
}

export interface BackgroundJobsDatabaseClient {
  shop: {
    findUnique(args: any): Promise<any>;
  };
  scanRun: {
    findFirst(args: any): Promise<any>;
  };
  webhookDelivery: {
    create(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    update(args: any): Promise<any>;
  };
  backgroundJob: {
    create(args: any): Promise<any>;
    findFirst(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
  };
  $transaction: (...args: any[]) => Promise<any>;
}

function toBackgroundJobPayload(value: Prisma.JsonValue | null | undefined): BackgroundJobPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const result: BackgroundJobPayload = {};

  if (typeof payload.scanRunId === "string") {
    result.scanRunId = payload.scanRunId;
  }

  if (typeof payload.latestDeliveryAt === "string") {
    result.latestDeliveryAt = payload.latestDeliveryAt;
  }

  if (typeof payload.latestWebhookId === "string") {
    result.latestWebhookId = payload.latestWebhookId;
  }

  if (typeof payload.latestTopic === "string") {
    result.latestTopic = payload.latestTopic;
  }

  return result;
}

function toBackgroundJobSummary(record: BackgroundJobRecord): BackgroundJobSummary {
  return {
    id: record.id,
    shopId: record.shopId,
    shopDomain: record.shop.shop,
    kind: record.kind,
    status: record.status,
    dedupeKey: record.dedupeKey ?? null,
    payload: toBackgroundJobPayload(record.payload),
    attemptCount: record.attemptCount,
    availableAt: record.availableAt.toISOString(),
    lockedAt: record.lockedAt?.toISOString() ?? null,
    leaseExpiresAt: record.leaseExpiresAt?.toISOString() ?? null,
    workerId: record.workerId ?? null,
    lastError: record.lastError ?? null,
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toWebhookDeliverySummary(record: WebhookDeliveryRecord): WebhookDeliverySummary {
  return {
    id: record.id,
    shopId: record.shopId,
    topic: record.topic,
    webhookId: record.webhookId,
    productId: record.productId ?? null,
    productGid: record.productGid ?? null,
    productHandle: record.productHandle ?? null,
    productTitle: record.productTitle ?? null,
    status: record.status,
    failureSummary: record.failureSummary ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toWebhookScanSummary(record: WebhookScanRecord): WebhookScanSummary {
  return {
    id: record.id,
    status: record.status,
    source: record.source,
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    failureSummary: record.failureSummary ?? null,
  };
}

function buildClaimWhere(now: Date, kinds?: readonly BackgroundJobKind[]): Prisma.BackgroundJobWhereInput {
  return {
    ...(kinds?.length ? { kind: { in: [...kinds] } } : {}),
    availableAt: {
      lte: now,
    },
    OR: [
      {
        status: {
          in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.FAILED],
        },
      },
      {
        status: BackgroundJobStatus.RUNNING,
        leaseExpiresAt: {
          lte: now,
        },
      },
    ],
  };
}

function createAutoScanStartPayload(args: {
  latestDeliveryAt: string;
  latestWebhookId: string;
  latestTopic: string;
}): Prisma.InputJsonValue {
  return {
    latestDeliveryAt: args.latestDeliveryAt,
    latestWebhookId: args.latestWebhookId,
    latestTopic: args.latestTopic,
  };
}

export function createAutoScanStartDedupeKey(shopId: string) {
  return `auto-scan-start:${shopId}`;
}

export function createAutoScanSyncDedupeKey(scanRunId: string) {
  return `auto-scan-sync:${scanRunId}`;
}

export async function recordWebhookDeliveryAndScheduleAutoScan(
  args: {
    shopId: string;
    topic: string;
    webhookId: string;
    productId?: string | null;
    productGid?: string | null;
    productHandle?: string | null;
    productTitle?: string | null;
    debounceMs?: number;
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<RecordWebhookDeliveryResult> {
  const debounceMs = args.debounceMs ?? 2 * 60 * 1000;
  const now = new Date();
  const debounceAt = new Date(now.getTime() + debounceMs);

  try {
    return await database.$transaction(async (transaction: BackgroundJobsDatabaseClient) => {
      const delivery = await transaction.webhookDelivery.create({
        data: {
          shopId: args.shopId,
          topic: args.topic,
          webhookId: args.webhookId,
          productId: args.productId ?? null,
          productGid: args.productGid ?? null,
          productHandle: args.productHandle ?? null,
          productTitle: args.productTitle ?? null,
          status: WebhookDeliveryStatus.RECEIVED,
        },
        select: {
          id: true,
          shopId: true,
          topic: true,
          webhookId: true,
          productId: true,
          productGid: true,
          productHandle: true,
          productTitle: true,
          status: true,
          failureSummary: true,
          createdAt: true,
          updatedAt: true,
        },
      }) as WebhookDeliveryRecord;

      const dedupeKey = createAutoScanStartDedupeKey(args.shopId);
      const existing = (await transaction.backgroundJob.findFirst({
        where: {
          shopId: args.shopId,
          kind: BackgroundJobKind.AUTO_SCAN_START,
          dedupeKey,
          status: {
            in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.FAILED],
          },
        },
        orderBy: [{ createdAt: "desc" }],
        include: {
          shop: {
            select: {
              shop: true,
            },
          },
        },
      })) as BackgroundJobRecord | null;
      const payload = createAutoScanStartPayload({
        latestDeliveryAt: delivery.createdAt.toISOString(),
        latestWebhookId: delivery.webhookId,
        latestTopic: delivery.topic,
      });

      const job = existing
        ? ((await transaction.backgroundJob.update({
            where: { id: existing.id },
            data: {
              status: BackgroundJobStatus.PENDING,
              availableAt: debounceAt,
              lastError: null,
              lockedAt: null,
              leaseExpiresAt: null,
              workerId: null,
              completedAt: null,
              payload,
            },
            include: {
              shop: {
                select: {
                  shop: true,
                },
              },
            },
          })) as BackgroundJobRecord)
        : ((await transaction.backgroundJob.create({
            data: {
              shopId: args.shopId,
              kind: BackgroundJobKind.AUTO_SCAN_START,
              status: BackgroundJobStatus.PENDING,
              dedupeKey,
              availableAt: debounceAt,
              payload,
            },
            include: {
              shop: {
                select: {
                  shop: true,
                },
              },
            },
          })) as BackgroundJobRecord);

      return {
        duplicate: false,
        delivery: toWebhookDeliverySummary(delivery),
        job: toBackgroundJobSummary(job),
      };
    });
  } catch (error) {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002") ||
      ((error as { code?: string } | null)?.code === "P2002")
    ) {
      return {
        duplicate: true,
        delivery: null,
        job: null,
      };
    }

    throw error;
  }
}

export async function enqueueBackgroundJob(
  args: {
    shopId: string;
    kind: BackgroundJobKind;
    dedupeKey?: string | null;
    payload?: Prisma.InputJsonValue | null;
    availableAt?: Date;
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<BackgroundJobSummary> {
  const now = args.availableAt ?? new Date();

  return database.$transaction(async (transaction: BackgroundJobsDatabaseClient) => {
    if (args.dedupeKey) {
      const existing = (await transaction.backgroundJob.findFirst({
        where: {
          shopId: args.shopId,
          kind: args.kind,
          dedupeKey: args.dedupeKey,
          status: {
            in: [
              BackgroundJobStatus.PENDING,
              BackgroundJobStatus.RUNNING,
              BackgroundJobStatus.FAILED,
            ],
          },
        },
        orderBy: [{ createdAt: "desc" }],
        include: {
          shop: {
            select: {
              shop: true,
            },
          },
        },
      })) as BackgroundJobRecord | null;

      if (existing) {
        return toBackgroundJobSummary(existing);
      }
    }

    const record = (await transaction.backgroundJob.create({
      data: {
        shopId: args.shopId,
        kind: args.kind,
        status: BackgroundJobStatus.PENDING,
        dedupeKey: args.dedupeKey ?? null,
        payload: args.payload ?? null,
        availableAt: now,
      },
      include: {
        shop: {
          select: {
            shop: true,
          },
        },
      },
    })) as BackgroundJobRecord;

    return toBackgroundJobSummary(record);
  });
}

export async function claimNextBackgroundJob(
  args: {
    workerId: string;
    leaseMs?: number;
    kinds?: readonly BackgroundJobKind[];
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<BackgroundJobSummary | null> {
  const leaseMs = args.leaseMs ?? 60_000;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const claimed = await database.$transaction(async (transaction: BackgroundJobsDatabaseClient) => {
      const now = new Date();
      const candidate = (await transaction.backgroundJob.findFirst({
        where: buildClaimWhere(now, args.kinds),
        orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
        include: {
          shop: {
            select: {
              shop: true,
            },
          },
        },
      })) as BackgroundJobRecord | null;

      if (!candidate) {
        return null;
      }

      const result = await transaction.backgroundJob.updateMany({
        where: {
          id: candidate.id,
          ...buildClaimWhere(now, args.kinds),
        },
        data: {
          status: BackgroundJobStatus.RUNNING,
          lockedAt: now,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          workerId: args.workerId,
          startedAt: candidate.startedAt ?? now,
        },
      });

      if (result.count === 0) {
        return "retry";
      }

      return (await transaction.backgroundJob.findUnique({
        where: { id: candidate.id },
        include: {
          shop: {
            select: {
              shop: true,
            },
          },
        },
      })) as BackgroundJobRecord | null;
    });

    if (claimed === "retry") {
      continue;
    }

    return claimed ? toBackgroundJobSummary(claimed) : null;
  }

  return null;
}

export async function updateBackgroundJob(
  args: {
    jobId: string;
    payload?: Prisma.InputJsonValue | null;
    lastError?: string | null;
    availableAt?: Date;
    status?: BackgroundJobStatus;
    clearLease?: boolean;
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<BackgroundJobSummary | null> {
  const record = (await database.backgroundJob.update({
    where: { id: args.jobId },
    data: {
      ...(args.payload !== undefined ? { payload: args.payload } : {}),
      ...(args.lastError !== undefined ? { lastError: args.lastError } : {}),
      ...(args.availableAt ? { availableAt: args.availableAt } : {}),
      ...(args.status ? { status: args.status } : {}),
      ...(args.clearLease
        ? {
            lockedAt: null,
            leaseExpiresAt: null,
            workerId: null,
          }
        : {}),
    },
    include: {
      shop: {
        select: {
          shop: true,
        },
      },
    },
  })) as BackgroundJobRecord;

  return record ? toBackgroundJobSummary(record) : null;
}

export async function markBackgroundJobPending(
  args: {
    jobId: string;
    availableAt: Date;
    lastError?: string | null;
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<BackgroundJobSummary> {
  const record = (await database.backgroundJob.update({
    where: { id: args.jobId },
    data: {
      status: BackgroundJobStatus.PENDING,
      availableAt: args.availableAt,
      lastError: args.lastError ?? null,
      lockedAt: null,
      leaseExpiresAt: null,
      workerId: null,
      completedAt: null,
    },
    include: {
      shop: {
        select: {
          shop: true,
        },
      },
    },
  })) as BackgroundJobRecord;

  return toBackgroundJobSummary(record);
}

export async function markBackgroundJobFailed(
  args: {
    jobId: string;
    availableAt: Date;
    lastError: string;
    incrementAttemptCount?: boolean;
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<BackgroundJobSummary> {
  const existing = (await database.backgroundJob.findUnique({
    where: { id: args.jobId },
    include: {
      shop: {
        select: {
          shop: true,
        },
      },
    },
  })) as BackgroundJobRecord | null;

  if (!existing) {
    throw new Error(`Background job ${args.jobId} not found.`);
  }

  const record = (await database.backgroundJob.update({
    where: { id: args.jobId },
    data: {
      status: BackgroundJobStatus.FAILED,
      availableAt: args.availableAt,
      lastError: args.lastError,
      attemptCount: existing.attemptCount + (args.incrementAttemptCount === false ? 0 : 1),
      lockedAt: null,
      leaseExpiresAt: null,
      workerId: null,
      completedAt: null,
    },
    include: {
      shop: {
        select: {
          shop: true,
        },
      },
    },
  })) as BackgroundJobRecord;

  return toBackgroundJobSummary(record);
}

export async function markBackgroundJobDeadLetter(
  args: {
    jobId: string;
    lastError: string;
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<BackgroundJobSummary> {
  const existing = (await database.backgroundJob.findUnique({
    where: { id: args.jobId },
    include: {
      shop: {
        select: {
          shop: true,
        },
      },
    },
  })) as BackgroundJobRecord | null;

  if (!existing) {
    throw new Error(`Background job ${args.jobId} not found.`);
  }

  const record = (await database.backgroundJob.update({
    where: { id: args.jobId },
    data: {
      status: BackgroundJobStatus.DEAD_LETTER,
      lastError: args.lastError,
      attemptCount: existing.attemptCount + 1,
      lockedAt: null,
      leaseExpiresAt: null,
      workerId: null,
      completedAt: new Date(),
    },
    include: {
      shop: {
        select: {
          shop: true,
        },
      },
    },
  })) as BackgroundJobRecord;

  return toBackgroundJobSummary(record);
}

export async function markBackgroundJobSucceeded(
  args: {
    jobId: string;
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<BackgroundJobSummary> {
  const record = (await database.backgroundJob.update({
    where: { id: args.jobId },
    data: {
      status: BackgroundJobStatus.SUCCEEDED,
      lastError: null,
      lockedAt: null,
      leaseExpiresAt: null,
      workerId: null,
      completedAt: new Date(),
    },
    include: {
      shop: {
        select: {
          shop: true,
        },
      },
    },
  })) as BackgroundJobRecord;

  return toBackgroundJobSummary(record);
}

export async function listRecentBackgroundJobsForShop(
  args: {
    shopId: string;
    limit?: number;
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<BackgroundJobSummary[]> {
  const records = (await database.backgroundJob.findMany({
    where: {
      shopId: args.shopId,
      kind: {
        in: [...AUTO_SCAN_KINDS],
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: args.limit ?? 5,
    include: {
      shop: {
        select: {
          shop: true,
        },
      },
    },
  })) as BackgroundJobRecord[];

  return records.map(toBackgroundJobSummary);
}

export async function getShopFreshnessSummary(
  args: {
    shopId: string;
  },
  database: BackgroundJobsDatabaseClient = prisma,
): Promise<ShopFreshnessSummary> {
  const now = new Date();
  const [webhookScan, pendingJob, latestIssue, recentJobs, recentDeliveries] = await Promise.all([
    database.scanRun.findFirst({
      where: {
        shopId: args.shopId,
        trigger: ScanRunTrigger.WEBHOOK,
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        source: true,
        startedAt: true,
        completedAt: true,
        failureSummary: true,
      },
    }) as Promise<WebhookScanRecord | null>,
    database.backgroundJob.findFirst({
      where: {
        shopId: args.shopId,
        kind: {
          in: [...AUTO_SCAN_KINDS],
        },
        OR: [
          {
            status: BackgroundJobStatus.PENDING,
          },
          {
            status: BackgroundJobStatus.RUNNING,
          },
          {
            status: BackgroundJobStatus.FAILED,
            availableAt: {
              gte: now,
            },
          },
        ],
      },
      orderBy: [{ availableAt: "asc" }],
      include: {
        shop: {
          select: {
            shop: true,
          },
        },
      },
    }) as Promise<BackgroundJobRecord | null>,
    database.backgroundJob.findFirst({
      where: {
        shopId: args.shopId,
        kind: {
          in: [...AUTO_SCAN_KINDS],
        },
        status: {
          in: [BackgroundJobStatus.FAILED, BackgroundJobStatus.DEAD_LETTER],
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        shop: {
          select: {
            shop: true,
          },
        },
      },
    }) as Promise<BackgroundJobRecord | null>,
    listRecentBackgroundJobsForShop({ shopId: args.shopId, limit: 5 }, database),
    database.webhookDelivery.findMany({
      where: {
        shopId: args.shopId,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        shopId: true,
        topic: true,
        webhookId: true,
        productId: true,
        productGid: true,
        productHandle: true,
        productTitle: true,
        status: true,
        failureSummary: true,
        createdAt: true,
        updatedAt: true,
      },
    }) as Promise<WebhookDeliveryRecord[]>,
  ]);

  return {
    lastWebhookScan: webhookScan ? toWebhookScanSummary(webhookScan) : null,
    autoRescanPending: Boolean(pendingJob),
    recentWebhookDeliveryCount: recentDeliveries.length,
    latestIssue: latestIssue ? toBackgroundJobSummary(latestIssue) : null,
    recentJobs,
  };
}
