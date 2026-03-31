import { Prisma, ScanFindingConfidence, ScanFindingStatus, JobStatus, AuditActorType } from "@prisma/client";
import { prisma } from "./client.js";

export interface CategoryStateSnapshot {
  taxonomyId: string | null;
  taxonomyGid: string | null;
  name: string | null;
  fullPath: string | null;
}

export interface ProductCategoryStateSnapshot {
  productId: string;
  productGid: string;
  productTitle: string | null;
  category: CategoryStateSnapshot | null;
}

export interface AuditTimelineEntry {
  id: string;
  eventType: string;
  actorType: AuditActorType;
  actor: string;
  source: string;
  reason: string | null;
  applyJobId: string | null;
  rollbackJobId: string | null;
  createdAt: string;
}

export interface ApplyJobItemDetail {
  id: string;
  applyJobId: string;
  scanFindingId: string | null;
  productId: string;
  productGid: string;
  productTitle: string | null;
  before: ProductCategoryStateSnapshot;
  after: ProductCategoryStateSnapshot;
  status: JobStatus;
  errorMessage: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyJobSummary {
  id: string;
  shopId: string;
  status: JobStatus;
  source: string;
  reason: string;
  actor: string;
  selectedFindingCount: number;
  appliedCount: number;
  failedCount: number;
  rollbackEligibleCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyJobDetail extends ApplyJobSummary {
  items: ApplyJobItemDetail[];
}

export interface RollbackJobItemDetail {
  id: string;
  rollbackJobId: string;
  applyJobItemId: string | null;
  productId: string;
  productGid: string;
  productTitle: string | null;
  before: ProductCategoryStateSnapshot;
  after: ProductCategoryStateSnapshot;
  status: JobStatus;
  errorMessage: string | null;
  rolledBackAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RollbackJobSummary {
  id: string;
  shopId: string;
  applyJobId: string | null;
  status: JobStatus;
  source: string;
  reason: string;
  actor: string;
  selectedItemCount: number;
  rolledBackCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RollbackJobDetail extends RollbackJobSummary {
  items: RollbackJobItemDetail[];
}

type ScanFindingForApplyRecord = Prisma.ScanFindingGetPayload<{
  select: {
    id: true;
    scanRunId: true;
    productId: true;
    productGid: true;
    productTitle: true;
    currentCategoryId: true;
    currentCategoryGid: true;
    recommendedCategoryId: true;
    recommendedCategoryGid: true;
    confidence: true;
    status: true;
  };
}>;

type ApplyJobRecord = Prisma.ApplyJobGetPayload<{
  include: {
    items: {
      include: {
        scanFinding: {
          select: {
            status: true;
          };
        };
      };
    };
  };
}>;

type RollbackJobRecord = Prisma.RollbackJobGetPayload<{
  include: {
    items: true;
  };
}>;

type AuditEventRecord = Prisma.AuditEventGetPayload<{
  select: {
    id: true;
    eventType: true;
    actorType: true;
    actor: true;
    source: true;
    reason: true;
    applyJobId: true;
    rollbackJobId: true;
    createdAt: true;
  };
}>;

type TaxonomyLookupRecord = Prisma.TaxonomyCategoryGetPayload<{
  select: {
    taxonomyId: true;
    taxonomyGid: true;
    name: true;
    fullPath: true;
  };
}>;

export interface ApplyJobsDatabaseClient {
  scanRun: {
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  scanFinding: {
    findMany(args: any): Promise<any[]>;
    update(args: any): Promise<any>;
    updateMany(args: any): Promise<{ count: number }>;
  };
  taxonomyCategory: {
    findMany(args: any): Promise<any[]>;
  };
  applyJob: {
    create(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  applyJobItem: {
    createMany(args: any): Promise<{ count: number }>;
    findMany(args: any): Promise<any[]>;
    update(args: any): Promise<any>;
  };
  rollbackJob: {
    create(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  rollbackJobItem: {
    createMany(args: any): Promise<{ count: number }>;
    findMany(args: any): Promise<any[]>;
    update(args: any): Promise<any>;
  };
  auditEvent: {
    create(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
  };
  $transaction: (...args: any[]) => Promise<any>;
}

const APPLY_CONFIDENCE_DEFAULTS = [
  ScanFindingConfidence.EXACT,
  ScanFindingConfidence.STRONG,
] as const;
const APPLY_CONFIDENCE_EXPLICIT = [
  ...APPLY_CONFIDENCE_DEFAULTS,
  ScanFindingConfidence.REVIEW_REQUIRED,
] as const;

function toCategoryStateSnapshot(
  category:
    | {
        taxonomyId: string | null;
        taxonomyGid: string | null;
        name: string | null;
        fullPath: string | null;
      }
    | null
    | undefined,
): CategoryStateSnapshot | null {
  if (!category || (!category.taxonomyId && !category.taxonomyGid && !category.name && !category.fullPath)) {
    return null;
  }

  return {
    taxonomyId: category.taxonomyId ?? null,
    taxonomyGid: category.taxonomyGid ?? null,
    name: category.name ?? null,
    fullPath: category.fullPath ?? null,
  };
}

function parseProductCategoryStateSnapshot(value: Prisma.JsonValue): ProductCategoryStateSnapshot {
  return value as unknown as ProductCategoryStateSnapshot;
}

function toProductCategoryStateSnapshot(args: {
  productId: string;
  productGid: string;
  productTitle: string | null;
  category:
    | {
        taxonomyId: string | null;
        taxonomyGid: string | null;
        name: string | null;
        fullPath: string | null;
      }
    | null;
}): ProductCategoryStateSnapshot {
  return {
    productId: args.productId,
    productGid: args.productGid,
    productTitle: args.productTitle,
    category: toCategoryStateSnapshot(args.category),
  };
}

function summarizeJobStatus(successCount: number, failedCount: number, pendingCount: number): JobStatus {
  if (pendingCount > 0) {
    return JobStatus.RUNNING;
  }

  if (successCount > 0 && failedCount > 0) {
    return JobStatus.PARTIALLY_SUCCEEDED;
  }

  if (successCount > 0) {
    return JobStatus.SUCCEEDED;
  }

  if (failedCount > 0) {
    return JobStatus.FAILED;
  }

  return JobStatus.PENDING;
}

function toApplyJobItemDetail(record: ApplyJobRecord["items"][number]): ApplyJobItemDetail {
  const before = parseProductCategoryStateSnapshot(record.before);
  const after = parseProductCategoryStateSnapshot(record.after);

  return {
    id: record.id,
    applyJobId: record.applyJobId,
    scanFindingId: record.scanFindingId ?? null,
    productId: record.productId,
    productGid: record.productGid,
    productTitle: before.productTitle ?? after.productTitle ?? null,
    before,
    after,
    status: record.status,
    errorMessage: record.errorMessage ?? null,
    appliedAt: record.appliedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toApplyJobDetail(record: ApplyJobRecord): ApplyJobDetail {
  const items = record.items.map((item) => toApplyJobItemDetail(item));

  return {
    id: record.id,
    shopId: record.shopId,
    status: record.status,
    source: record.source,
    reason: record.reason,
    actor: record.actor,
    selectedFindingCount: record.selectedFindingCount,
    appliedCount: record.appliedCount,
    failedCount: record.failedCount,
    rollbackEligibleCount: record.items.filter(
      (item) => item.status === JobStatus.SUCCEEDED && item.scanFinding?.status === ScanFindingStatus.APPLIED,
    ).length,
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    items,
  };
}

function toRollbackJobItemDetail(record: RollbackJobRecord["items"][number]): RollbackJobItemDetail {
  const before = parseProductCategoryStateSnapshot(record.before);
  const after = parseProductCategoryStateSnapshot(record.after);

  return {
    id: record.id,
    rollbackJobId: record.rollbackJobId,
    applyJobItemId: record.applyJobItemId ?? null,
    productId: record.productId,
    productGid: record.productGid,
    productTitle: before.productTitle ?? after.productTitle ?? null,
    before,
    after,
    status: record.status,
    errorMessage: record.errorMessage ?? null,
    rolledBackAt: record.rolledBackAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toRollbackJobDetail(record: RollbackJobRecord): RollbackJobDetail {
  return {
    id: record.id,
    shopId: record.shopId,
    applyJobId: record.applyJobId ?? null,
    status: record.status,
    source: record.source,
    reason: record.reason,
    actor: record.actor,
    selectedItemCount: record.selectedItemCount,
    rolledBackCount: record.rolledBackCount,
    failedCount: record.failedCount,
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    items: record.items.map((item) => toRollbackJobItemDetail(item)),
  };
}

function toAuditTimelineEntry(record: AuditEventRecord): AuditTimelineEntry {
  return {
    id: record.id,
    eventType: record.eventType,
    actorType: record.actorType,
    actor: record.actor,
    source: record.source,
    reason: record.reason ?? null,
    applyJobId: record.applyJobId ?? null,
    rollbackJobId: record.rollbackJobId ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

async function loadCategoryLookup(
  taxonomyVersionId: string | null,
  taxonomyIds: string[],
  database: ApplyJobsDatabaseClient,
) {
  if (!taxonomyVersionId || !taxonomyIds.length) {
    return new Map<string, TaxonomyLookupRecord>();
  }

  const uniqueIds = [...new Set(taxonomyIds.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map<string, TaxonomyLookupRecord>();
  }

  const categories = (await database.taxonomyCategory.findMany({
    where: {
      taxonomyVersionId,
      taxonomyId: {
        in: uniqueIds,
      },
    },
    select: {
      taxonomyId: true,
      taxonomyGid: true,
      name: true,
      fullPath: true,
    },
  })) as TaxonomyLookupRecord[];

  return new Map(categories.map((category) => [category.taxonomyId, category]));
}

async function syncScanRunReviewCounts(scanRunIds: readonly string[], database: ApplyJobsDatabaseClient) {
  for (const scanRunId of [...new Set(scanRunIds.filter(Boolean))]) {
    const findings = (await database.scanFinding.findMany({
      where: { scanRunId },
      select: { status: true },
    })) as Array<{ status: ScanFindingStatus }>;

    let acceptedFindingCount = 0;
    let rejectedFindingCount = 0;

    for (const finding of findings) {
      if (finding.status === ScanFindingStatus.ACCEPTED) {
        acceptedFindingCount += 1;
      }

      if (finding.status === ScanFindingStatus.DISMISSED) {
        rejectedFindingCount += 1;
      }
    }

    await database.scanRun.update({
      where: { id: scanRunId },
      data: {
        acceptedFindingCount,
        rejectedFindingCount,
      },
    });
  }
}

export async function createApplyJobFromFindings(
  args: {
    shopId: string;
    scanRunId: string;
    findingIds?: readonly string[];
    source: string;
    reason: string;
    actor: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<ApplyJobDetail | null> {
  return database.$transaction(async (transaction: ApplyJobsDatabaseClient) => {
    const scanRun = await transaction.scanRun.findUnique({
      where: { id: args.scanRunId },
      select: {
        id: true,
        shopId: true,
        taxonomyVersionId: true,
      },
    });

    if (!scanRun || scanRun.shopId !== args.shopId) {
      return null;
    }

    const findings = (await transaction.scanFinding.findMany({
      where: {
        shopId: args.shopId,
        scanRunId: args.scanRunId,
        status: ScanFindingStatus.ACCEPTED,
        recommendedCategoryId: { not: null },
        confidence: {
          in: args.findingIds?.length ? APPLY_CONFIDENCE_EXPLICIT : APPLY_CONFIDENCE_DEFAULTS,
        },
        ...(args.findingIds?.length
          ? {
              id: {
                in: [...args.findingIds],
              },
            }
          : {}),
      },
      select: {
        id: true,
        scanRunId: true,
        productId: true,
        productGid: true,
        productTitle: true,
        currentCategoryId: true,
        currentCategoryGid: true,
        recommendedCategoryId: true,
        recommendedCategoryGid: true,
        confidence: true,
        status: true,
      },
      orderBy: [{ productTitle: "asc" }],
    })) as ScanFindingForApplyRecord[];

    if (!findings.length) {
      return null;
    }

    const categoryLookup = await loadCategoryLookup(
      scanRun.taxonomyVersionId,
      findings.flatMap((finding) => [
        finding.currentCategoryId ?? "",
        finding.recommendedCategoryId ?? "",
      ]),
      transaction,
    );
    const applyJob = await transaction.applyJob.create({
      data: {
        shopId: args.shopId,
        source: args.source,
        reason: args.reason,
        actor: args.actor,
        selectedFindingCount: findings.length,
      },
    });

    await transaction.applyJobItem.createMany({
      data: findings.map((finding) => ({
        applyJobId: applyJob.id,
        scanFindingId: finding.id,
        productId: finding.productId,
        productGid: finding.productGid,
        before: toProductCategoryStateSnapshot({
          productId: finding.productId,
          productGid: finding.productGid,
          productTitle: finding.productTitle,
          category: finding.currentCategoryId
            ? {
                taxonomyId: finding.currentCategoryId,
                taxonomyGid: finding.currentCategoryGid ?? categoryLookup.get(finding.currentCategoryId)?.taxonomyGid ?? null,
                name: categoryLookup.get(finding.currentCategoryId)?.name ?? null,
                fullPath: categoryLookup.get(finding.currentCategoryId)?.fullPath ?? null,
              }
            : null,
        }) as unknown as Prisma.InputJsonValue,
        after: toProductCategoryStateSnapshot({
          productId: finding.productId,
          productGid: finding.productGid,
          productTitle: finding.productTitle,
          category: finding.recommendedCategoryId
            ? {
                taxonomyId: finding.recommendedCategoryId,
                taxonomyGid:
                  finding.recommendedCategoryGid ??
                  categoryLookup.get(finding.recommendedCategoryId)?.taxonomyGid ??
                  null,
                name: categoryLookup.get(finding.recommendedCategoryId)?.name ?? null,
                fullPath: categoryLookup.get(finding.recommendedCategoryId)?.fullPath ?? null,
              }
            : null,
        }) as unknown as Prisma.InputJsonValue,
        source: args.source,
        reason: args.reason,
        actor: args.actor,
      })),
    });

    await transaction.auditEvent.create({
      data: {
        shopId: args.shopId,
        eventType: "apply_job_created",
        actorType: AuditActorType.USER,
        actor: args.actor,
        source: args.source,
        reason: args.reason,
        applyJobId: applyJob.id,
        scanRunId: args.scanRunId,
        payload: {
          selectedFindingCount: findings.length,
        },
      },
    });

    return getApplyJobById(
      {
        shopId: args.shopId,
        applyJobId: applyJob.id,
      },
      transaction,
    );
  });
}

export async function listRecentApplyJobsForShop(
  args: {
    shopId: string;
    limit?: number;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<ApplyJobSummary[]> {
  const records = (await database.applyJob.findMany({
    where: { shopId: args.shopId },
    orderBy: [{ createdAt: "desc" }],
    take: args.limit ?? 10,
    include: {
      items: {
        include: {
          scanFinding: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  })) as ApplyJobRecord[];

  return records.map((record) => {
    const detail = toApplyJobDetail(record);

    return {
      id: detail.id,
      shopId: detail.shopId,
      status: detail.status,
      source: detail.source,
      reason: detail.reason,
      actor: detail.actor,
      selectedFindingCount: detail.selectedFindingCount,
      appliedCount: detail.appliedCount,
      failedCount: detail.failedCount,
      rollbackEligibleCount: detail.rollbackEligibleCount,
      startedAt: detail.startedAt,
      completedAt: detail.completedAt,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    };
  });
}

export async function getApplyJobById(
  args: {
    shopId: string;
    applyJobId: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<ApplyJobDetail | null> {
  const record = (await database.applyJob.findUnique({
    where: { id: args.applyJobId },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          scanFinding: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  })) as ApplyJobRecord | null;

  if (!record || record.shopId !== args.shopId) {
    return null;
  }

  return toApplyJobDetail(record);
}

export async function markApplyJobRunning(
  args: {
    shopId: string;
    applyJobId: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<ApplyJobDetail | null> {
  const record = await database.applyJob.findUnique({
    where: { id: args.applyJobId },
    select: { id: true, shopId: true, startedAt: true },
  });

  if (!record || record.shopId !== args.shopId) {
    return null;
  }

  await database.applyJob.update({
    where: { id: args.applyJobId },
    data: {
      status: JobStatus.RUNNING,
      startedAt: record.startedAt ?? new Date(),
      completedAt: null,
    },
  });

  return getApplyJobById(args, database);
}

export async function listPendingApplyJobItems(
  args: {
    shopId: string;
    applyJobId: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<ApplyJobItemDetail[] | null> {
  const job = await database.applyJob.findUnique({
    where: { id: args.applyJobId },
    select: { id: true, shopId: true },
  });

  if (!job || job.shopId !== args.shopId) {
    return null;
  }

  const records = await database.applyJobItem.findMany({
    where: {
      applyJobId: args.applyJobId,
      status: {
        in: [JobStatus.PENDING, JobStatus.FAILED],
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return records.map((record: any) =>
    toApplyJobItemDetail({ ...record, scanFinding: null } as ApplyJobRecord["items"][number]),
  );
}

export async function recordApplyJobItemResult(
  args: {
    shopId: string;
    applyJobId: string;
    applyJobItemId: string;
    status: "SUCCEEDED" | "FAILED";
    errorMessage?: string | null;
    afterSnapshot?: ProductCategoryStateSnapshot;
    actor: string;
    source: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<ApplyJobItemDetail | null> {
  return database.$transaction(async (transaction: ApplyJobsDatabaseClient) => {
    const item = await transaction.applyJobItem.findMany({
      where: {
        id: args.applyJobItemId,
        applyJobId: args.applyJobId,
      },
      take: 1,
    });
    const [record] = item as Array<any>;

    if (!record) {
      return null;
    }

    const job = await transaction.applyJob.findUnique({
      where: { id: args.applyJobId },
      select: { id: true, shopId: true },
    });

    if (!job || job.shopId !== args.shopId) {
      return null;
    }

    const updated = await transaction.applyJobItem.update({
      where: { id: args.applyJobItemId },
      data: {
        status: args.status,
        errorMessage: args.errorMessage ?? null,
        appliedAt: args.status === JobStatus.SUCCEEDED ? new Date() : null,
        after: (args.afterSnapshot ?? parseProductCategoryStateSnapshot(record.after)) as unknown as Prisma.InputJsonValue,
      },
    });

    if (record.scanFindingId) {
      await transaction.scanFinding.update({
        where: { id: record.scanFindingId },
        data: {
          status: args.status === JobStatus.SUCCEEDED ? ScanFindingStatus.APPLIED : ScanFindingStatus.ACCEPTED,
        },
      });
    }

    await transaction.auditEvent.create({
      data: {
        shopId: args.shopId,
        eventType: args.status === JobStatus.SUCCEEDED ? "apply_job_item_succeeded" : "apply_job_item_failed",
        actorType: AuditActorType.USER,
        actor: args.actor,
        source: args.source,
        reason: args.errorMessage ?? null,
        applyJobId: args.applyJobId,
        applyJobItemId: args.applyJobItemId,
        payload: {
          productId: record.productId,
          errorMessage: args.errorMessage ?? null,
        },
      },
    });

    const scanFindings = record.scanFindingId
      ? await transaction.scanFinding.findMany({
          where: { id: record.scanFindingId },
          select: { scanRunId: true },
        })
      : [];

    await syncScanRunReviewCounts(
      scanFindings.map((finding: any) => finding.scanRunId),
      transaction,
    );

    return toApplyJobItemDetail({
      ...updated,
      scanFinding: null,
    } as ApplyJobRecord["items"][number]);
  });
}

export async function finalizeApplyJob(
  args: {
    shopId: string;
    applyJobId: string;
    actor: string;
    source: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<ApplyJobDetail | null> {
  return database.$transaction(async (transaction: ApplyJobsDatabaseClient) => {
    const detail = await getApplyJobById(args, transaction);

    if (!detail) {
      return null;
    }

    const successCount = detail.items.filter((item) => item.status === JobStatus.SUCCEEDED).length;
    const failedCount = detail.items.filter((item) => item.status === JobStatus.FAILED).length;
    const pendingCount = detail.items.filter(
      (item) => item.status === JobStatus.PENDING || item.status === JobStatus.RUNNING,
    ).length;
    const status = summarizeJobStatus(successCount, failedCount, pendingCount);
    const updated = await transaction.applyJob.update({
      where: { id: args.applyJobId },
      data: {
        status,
        appliedCount: successCount,
        failedCount,
        completedAt: pendingCount === 0 ? new Date() : null,
      },
    });

    await transaction.auditEvent.create({
      data: {
        shopId: args.shopId,
        eventType:
          status === JobStatus.SUCCEEDED
            ? "apply_job_completed"
            : status === JobStatus.PARTIALLY_SUCCEEDED
              ? "apply_job_partially_succeeded"
              : "apply_job_failed",
        actorType: AuditActorType.USER,
        actor: args.actor,
        source: args.source,
        applyJobId: args.applyJobId,
        payload: {
          appliedCount: successCount,
          failedCount,
        },
      },
    });

    return getApplyJobById(
      {
        shopId: updated.shopId,
        applyJobId: updated.id,
      },
      transaction,
    );
  });
}

export async function createRollbackJobFromApplyJob(
  args: {
    shopId: string;
    applyJobId: string;
    source: string;
    reason: string;
    actor: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<RollbackJobDetail | null> {
  return database.$transaction(async (transaction: ApplyJobsDatabaseClient) => {
    const applyJob = (await transaction.applyJob.findUnique({
      where: { id: args.applyJobId },
      include: {
        items: {
          include: {
            scanFinding: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    })) as ApplyJobRecord | null;

    if (!applyJob || applyJob.shopId !== args.shopId) {
      return null;
    }

    const eligibleItems = applyJob.items.filter(
      (item) => item.status === JobStatus.SUCCEEDED && item.scanFinding?.status === ScanFindingStatus.APPLIED,
    );

    if (!eligibleItems.length) {
      return null;
    }

    const rollbackJob = await transaction.rollbackJob.create({
      data: {
        shopId: args.shopId,
        applyJobId: args.applyJobId,
        source: args.source,
        reason: args.reason,
        actor: args.actor,
        selectedItemCount: eligibleItems.length,
      },
    });

    await transaction.rollbackJobItem.createMany({
      data: eligibleItems.map((item) => ({
        rollbackJobId: rollbackJob.id,
        applyJobItemId: item.id,
        productId: item.productId,
        productGid: item.productGid,
        before: item.after,
        after: item.before,
        source: args.source,
        reason: args.reason,
        actor: args.actor,
      })),
    });

    await transaction.auditEvent.create({
      data: {
        shopId: args.shopId,
        eventType: "rollback_job_created",
        actorType: AuditActorType.USER,
        actor: args.actor,
        source: args.source,
        reason: args.reason,
        applyJobId: args.applyJobId,
        rollbackJobId: rollbackJob.id,
        payload: {
          selectedItemCount: eligibleItems.length,
        },
      },
    });

    return getRollbackJobById(
      {
        shopId: args.shopId,
        rollbackJobId: rollbackJob.id,
      },
      transaction,
    );
  });
}

export async function getRollbackJobById(
  args: {
    shopId: string;
    rollbackJobId: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<RollbackJobDetail | null> {
  const record = (await database.rollbackJob.findUnique({
    where: { id: args.rollbackJobId },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  })) as RollbackJobRecord | null;

  if (!record || record.shopId !== args.shopId) {
    return null;
  }

  return toRollbackJobDetail(record);
}

export async function listRecentRollbackJobsForShop(
  args: {
    shopId: string;
    limit?: number;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<RollbackJobSummary[]> {
  const records = (await database.rollbackJob.findMany({
    where: { shopId: args.shopId },
    orderBy: [{ createdAt: "desc" }],
    take: args.limit ?? 10,
    include: {
      items: true,
    },
  })) as RollbackJobRecord[];

  return records.map((record) => {
    const detail = toRollbackJobDetail(record);

    return {
      id: detail.id,
      shopId: detail.shopId,
      applyJobId: detail.applyJobId,
      status: detail.status,
      source: detail.source,
      reason: detail.reason,
      actor: detail.actor,
      selectedItemCount: detail.selectedItemCount,
      rolledBackCount: detail.rolledBackCount,
      failedCount: detail.failedCount,
      startedAt: detail.startedAt,
      completedAt: detail.completedAt,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    };
  });
}

export async function markRollbackJobRunning(
  args: {
    shopId: string;
    rollbackJobId: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<RollbackJobDetail | null> {
  const record = await database.rollbackJob.findUnique({
    where: { id: args.rollbackJobId },
    select: { id: true, shopId: true, startedAt: true },
  });

  if (!record || record.shopId !== args.shopId) {
    return null;
  }

  await database.rollbackJob.update({
    where: { id: args.rollbackJobId },
    data: {
      status: JobStatus.RUNNING,
      startedAt: record.startedAt ?? new Date(),
      completedAt: null,
    },
  });

  return getRollbackJobById(args, database);
}

export async function listPendingRollbackJobItems(
  args: {
    shopId: string;
    rollbackJobId: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<RollbackJobItemDetail[] | null> {
  const job = await database.rollbackJob.findUnique({
    where: { id: args.rollbackJobId },
    select: { id: true, shopId: true },
  });

  if (!job || job.shopId !== args.shopId) {
    return null;
  }

  const records = await database.rollbackJobItem.findMany({
    where: {
      rollbackJobId: args.rollbackJobId,
      status: {
        in: [JobStatus.PENDING, JobStatus.FAILED],
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return records.map((record: any) =>
    toRollbackJobItemDetail(record as RollbackJobRecord["items"][number]),
  );
}

export async function recordRollbackJobItemResult(
  args: {
    shopId: string;
    rollbackJobId: string;
    rollbackJobItemId: string;
    status: "SUCCEEDED" | "FAILED";
    errorMessage?: string | null;
    actor: string;
    source: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<RollbackJobItemDetail | null> {
  return database.$transaction(async (transaction: ApplyJobsDatabaseClient) => {
    const records = await transaction.rollbackJobItem.findMany({
      where: {
        id: args.rollbackJobItemId,
        rollbackJobId: args.rollbackJobId,
      },
      take: 1,
    });
    const [record] = records as Array<any>;

    if (!record) {
      return null;
    }

    const job = await transaction.rollbackJob.findUnique({
      where: { id: args.rollbackJobId },
      select: { id: true, shopId: true },
    });

    if (!job || job.shopId !== args.shopId) {
      return null;
    }

    const updated = await transaction.rollbackJobItem.update({
      where: { id: args.rollbackJobItemId },
      data: {
        status: args.status,
        errorMessage: args.errorMessage ?? null,
        rolledBackAt: args.status === JobStatus.SUCCEEDED ? new Date() : null,
      },
    });

    if (record.applyJobItemId) {
      const applyItems = await transaction.applyJobItem.findMany({
        where: { id: record.applyJobItemId },
        take: 1,
      });
      const [applyItem] = applyItems as Array<any>;

      if (applyItem?.scanFindingId) {
        await transaction.scanFinding.update({
          where: { id: applyItem.scanFindingId },
          data: {
            status: args.status === JobStatus.SUCCEEDED ? ScanFindingStatus.ROLLED_BACK : ScanFindingStatus.APPLIED,
          },
        });

        const scanFindings = await transaction.scanFinding.findMany({
          where: { id: applyItem.scanFindingId },
          select: { scanRunId: true },
        });

        await syncScanRunReviewCounts(
          scanFindings.map((finding: any) => finding.scanRunId),
          transaction,
        );
      }
    }

    await transaction.auditEvent.create({
      data: {
        shopId: args.shopId,
        eventType: args.status === JobStatus.SUCCEEDED ? "rollback_job_item_succeeded" : "rollback_job_item_failed",
        actorType: AuditActorType.USER,
        actor: args.actor,
        source: args.source,
        reason: args.errorMessage ?? null,
        rollbackJobId: args.rollbackJobId,
        rollbackJobItemId: args.rollbackJobItemId,
        payload: {
          productId: record.productId,
          errorMessage: args.errorMessage ?? null,
        },
      },
    });

    return toRollbackJobItemDetail(updated as RollbackJobRecord["items"][number]);
  });
}

export async function finalizeRollbackJob(
  args: {
    shopId: string;
    rollbackJobId: string;
    actor: string;
    source: string;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<RollbackJobDetail | null> {
  return database.$transaction(async (transaction: ApplyJobsDatabaseClient) => {
    const detail = await getRollbackJobById(args, transaction);

    if (!detail) {
      return null;
    }

    const successCount = detail.items.filter((item) => item.status === JobStatus.SUCCEEDED).length;
    const failedCount = detail.items.filter((item) => item.status === JobStatus.FAILED).length;
    const pendingCount = detail.items.filter(
      (item) => item.status === JobStatus.PENDING || item.status === JobStatus.RUNNING,
    ).length;
    const status = summarizeJobStatus(successCount, failedCount, pendingCount);
    const updated = await transaction.rollbackJob.update({
      where: { id: args.rollbackJobId },
      data: {
        status,
        rolledBackCount: successCount,
        failedCount,
        completedAt: pendingCount === 0 ? new Date() : null,
      },
    });

    await transaction.auditEvent.create({
      data: {
        shopId: args.shopId,
        eventType:
          status === JobStatus.SUCCEEDED
            ? "rollback_job_completed"
            : status === JobStatus.PARTIALLY_SUCCEEDED
              ? "rollback_job_partially_succeeded"
              : "rollback_job_failed",
        actorType: AuditActorType.USER,
        actor: args.actor,
        source: args.source,
        rollbackJobId: args.rollbackJobId,
        applyJobId: updated.applyJobId ?? null,
        payload: {
          rolledBackCount: successCount,
          failedCount,
        },
      },
    });

    return getRollbackJobById(
      {
        shopId: updated.shopId,
        rollbackJobId: updated.id,
      },
      transaction,
    );
  });
}

export async function listAuditTimelineForShop(
  args: {
    shopId: string;
    limit?: number;
  },
  database: ApplyJobsDatabaseClient = prisma,
): Promise<AuditTimelineEntry[]> {
  const records = (await database.auditEvent.findMany({
    where: {
      shopId: args.shopId,
      OR: [{ applyJobId: { not: null } }, { rollbackJobId: { not: null } }],
    },
    orderBy: [{ createdAt: "desc" }],
    take: args.limit ?? 20,
    select: {
      id: true,
      eventType: true,
      actorType: true,
      actor: true,
      source: true,
      reason: true,
      applyJobId: true,
      rollbackJobId: true,
      createdAt: true,
    },
  })) as AuditEventRecord[];

  return records.map((record) => toAuditTimelineEntry(record));
}
