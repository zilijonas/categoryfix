import {
  Prisma,
  RuleDefinitionState,
  ScanFindingConfidence,
  ScanFindingStatus,
  ScanRunStatus,
  type RuleDefinition,
  type ScanRun,
  type TaxonomyCategoryTermKind,
  type TaxonomyVersion,
} from "@prisma/client";
import { prisma } from "./client.js";

type TaxonomyCategoryRecord = Prisma.TaxonomyCategoryGetPayload<{
  select: {
    taxonomyId: true;
    taxonomyGid: true;
    name: true;
    fullPath: true;
    isLeaf: true;
  };
}>;

type TaxonomyTermWithCategory = Prisma.TaxonomyCategoryTermGetPayload<{
  include: {
    category: {
      select: {
        taxonomyId: true;
        taxonomyGid: true;
        name: true;
        fullPath: true;
        isLeaf: true;
      };
    };
  };
}>;

type ScanFindingReviewRecord = Prisma.ScanFindingGetPayload<{
  select: {
    id: true;
    scanRunId: true;
    productId: true;
    productGid: true;
    productHandle: true;
    productTitle: true;
    evidence: true;
    explanation: true;
    currentCategoryId: true;
    recommendedCategoryId: true;
    confidence: true;
    status: true;
    source: true;
    createdAt: true;
  };
}>;

export interface ScanFindingEvidencePayload {
  title: string;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  collections: string[];
  currentCategory: {
    taxonomyId: string | null;
    taxonomyGid: string | null;
    name: string | null;
    fullPath: string | null;
  } | null;
  normalized: {
    title: string;
    productType: string | null;
    vendor: string | null;
    tags: string[];
    collections: string[];
    currentCategory: {
      taxonomyId: string | null;
      taxonomyGid: string | null;
      name: string | null;
      fullPath: string | null;
    } | null;
  };
  matchedSignals: Array<{
    source: string;
    rawValue: string;
    normalizedValue: string;
    matchedTerm: string;
    matchType: string;
    taxonomyId: string;
    taxonomyGid: string;
    taxonomyName: string;
    taxonomyFullPath: string;
  }>;
}

export interface ScanFindingExplanationPayload {
  ruleKey: string;
  ruleVersion: string;
  decision: string;
  basis: Array<{
    source: string;
    rawValue: string;
    normalizedValue: string;
    matchType: string;
    matchedTerm: string;
    taxonomyId: string;
    taxonomyGid: string;
    taxonomyName: string;
    taxonomyFullPath: string;
  }>;
  blockers: Array<{
    type: string;
    message: string;
    taxonomyIds: string[];
  }>;
}

export interface ScanConfidenceCounts {
  exact: number;
  strong: number;
  reviewRequired: number;
  noSafeSuggestion: number;
}

export interface ScanRunSummary {
  id: string;
  status: ScanRunStatus;
  trigger: string;
  source: string;
  startedAt: string | null;
  completedAt: string | null;
  scannedProductCount: number;
  findingCount: number;
  acceptedFindingCount: number;
  rejectedFindingCount: number;
  failureSummary: string | null;
}

export interface ScanRunDetail extends ScanRunSummary {
  shopId: string;
  taxonomyVersionId: string | null;
  externalOperationId: string | null;
  externalOperationStatus: string | null;
  confidenceCounts: ScanConfidenceCounts;
}

export interface ScanHistoryEntry extends ScanRunSummary {
  confidenceCounts: ScanConfidenceCounts;
}

export interface ScanFindingCategorySummary {
  taxonomyId: string;
  name: string;
  fullPath: string;
}

export interface ScanReviewPreviewCounts {
  total: number;
  open: number;
  accepted: number;
  dismissed: number;
  applied: number;
  rolledBack: number;
  safeDeterministicOpen: number;
  reviewRequiredOpen: number;
  safeDeterministicAccepted: number;
  reviewRequiredAccepted: number;
  noSafeSuggestion: number;
  readyToApply: number;
}

export interface ScanFindingReviewListItem {
  id: string;
  scanRunId: string;
  productId: string;
  productGid: string;
  productHandle: string | null;
  productTitle: string;
  confidence: ScanFindingConfidence;
  status: ScanFindingStatus;
  source: string;
  currentCategory: ScanFindingCategorySummary | null;
  recommendedCategory: ScanFindingCategorySummary | null;
  basisCount: number;
  blockerCount: number;
  createdAt: string;
}

export interface ScanFindingReviewDetail extends ScanFindingReviewListItem {
  evidence: ScanFindingEvidencePayload;
  explanation: ScanFindingExplanationPayload;
}

export interface ScanFindingReviewFilters {
  status?: ScanFindingStatus | "ALL" | null;
  confidence?: ScanFindingConfidence | "ALL" | null;
  query?: string | null;
  page?: number;
  pageSize?: number;
}

export interface ScanFindingReviewPage {
  items: ScanFindingReviewListItem[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
  filters: {
    status: ScanFindingStatus | "ALL";
    confidence: ScanFindingConfidence | "ALL";
    query: string;
  };
  previewCounts: ScanReviewPreviewCounts;
}

export interface UpdateScanFindingStatusesResult {
  updatedCount: number;
  previewCounts: ScanReviewPreviewCounts;
  scanRun: ScanRunDetail;
}

export interface CreateScanFindingInput {
  shopId: string;
  scanRunId: string;
  productId: string;
  productGid: string;
  productHandle?: string | null;
  productTitle: string;
  evidence: Prisma.InputJsonValue;
  explanation: Prisma.InputJsonValue;
  currentCategoryId?: string | null;
  currentCategoryGid?: string | null;
  recommendedCategoryId?: string | null;
  recommendedCategoryGid?: string | null;
  confidence: ScanFindingConfidence;
  status?: ScanFindingStatus;
  source: string;
}

export interface ScanRuleDefinitionInput {
  key: string;
  version: string;
  description: string;
  priority: number;
  configuration: Prisma.InputJsonValue;
  state?: RuleDefinitionState;
}

export interface TaxonomyLeafCategory {
  taxonomyId: string;
  taxonomyGid: string;
  name: string;
  fullPath: string;
  isLeaf: boolean;
}

export interface TaxonomyLeafTerm {
  taxonomyId: string;
  term: string;
  normalizedTerm: string;
  kind: TaxonomyCategoryTermKind;
  category: TaxonomyLeafCategory;
}

export interface TaxonomyReferenceSnapshot {
  versionId: string;
  version: string;
  locale: string;
  categories: TaxonomyLeafCategory[];
  terms: TaxonomyLeafTerm[];
}

export interface ScanDatabaseClient {
  scanRun: {
    create(args: any): Promise<ScanRun>;
    findFirst(args: any): Promise<ScanRun | null>;
    findMany(args: any): Promise<ScanRun[]>;
    findUnique(args: any): Promise<ScanRun | null>;
    update(args: any): Promise<ScanRun>;
  };
  scanFinding: {
    count(args: any): Promise<number>;
    createMany(args: any): Promise<{ count: number }>;
    findMany(args: any): Promise<unknown[]>;
    findUnique(args: any): Promise<unknown>;
    updateMany(args: any): Promise<{ count: number }>;
  };
  ruleDefinition: {
    upsert(args: any): Promise<RuleDefinition>;
  };
  taxonomyVersion: {
    findFirst(args: any): Promise<TaxonomyVersion | null>;
    findUnique(args: any): Promise<TaxonomyVersion | null>;
  };
  taxonomyCategory: {
    findMany(args: any): Promise<unknown[]>;
  };
  taxonomyCategoryTerm: {
    findMany(args: any): Promise<unknown[]>;
  };
  $transaction: (...args: any[]) => Promise<any>;
}

function createEmptyConfidenceCounts(): ScanConfidenceCounts {
  return {
    exact: 0,
    strong: 0,
    reviewRequired: 0,
    noSafeSuggestion: 0,
  };
}

function toConfidenceCounts(records: readonly { confidence: ScanFindingConfidence }[]) {
  const counts = createEmptyConfidenceCounts();

  for (const record of records) {
    switch (record.confidence) {
      case ScanFindingConfidence.EXACT:
        counts.exact += 1;
        break;
      case ScanFindingConfidence.STRONG:
        counts.strong += 1;
        break;
      case ScanFindingConfidence.REVIEW_REQUIRED:
        counts.reviewRequired += 1;
        break;
      case ScanFindingConfidence.NO_SAFE_SUGGESTION:
        counts.noSafeSuggestion += 1;
        break;
      default:
        break;
    }
  }

  return counts;
}

function toScanRunSummary(record: ScanRun): ScanRunSummary {
  return {
    id: record.id,
    status: record.status,
    trigger: record.trigger,
    source: record.source,
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    scannedProductCount: record.scannedProductCount,
    findingCount: record.findingCount,
    acceptedFindingCount: record.acceptedFindingCount,
    rejectedFindingCount: record.rejectedFindingCount,
    failureSummary: record.failureSummary ?? null,
  };
}

async function loadConfidenceCounts(
  scanRunId: string,
  database: ScanDatabaseClient,
): Promise<ScanConfidenceCounts> {
  const records = (await database.scanFinding.findMany({
    where: { scanRunId },
    select: { confidence: true },
  })) as { confidence: ScanFindingConfidence }[];

  return toConfidenceCounts(records);
}

async function toScanRunDetail(
  record: ScanRun,
  database: ScanDatabaseClient,
): Promise<ScanRunDetail> {
  return {
    ...toScanRunSummary(record),
    shopId: record.shopId,
    taxonomyVersionId: record.taxonomyVersionId ?? null,
    externalOperationId: record.externalOperationId ?? null,
    externalOperationStatus: record.externalOperationStatus ?? null,
    confidenceCounts: await loadConfidenceCounts(record.id, database),
  };
}

function normalizeReviewFilters(filters: ScanFindingReviewFilters = {}) {
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 50, 100));
  const page = Math.max(1, filters.page ?? 1);

  return {
    status: filters.status && filters.status !== "ALL" ? filters.status : "ALL",
    confidence:
      filters.confidence && filters.confidence !== "ALL" ? filters.confidence : "ALL",
    query: filters.query?.trim() ?? "",
    page,
    pageSize,
  } as const;
}

function parseFindingEvidencePayload(value: Prisma.JsonValue): ScanFindingEvidencePayload {
  return value as unknown as ScanFindingEvidencePayload;
}

function parseFindingExplanationPayload(
  value: Prisma.JsonValue,
): ScanFindingExplanationPayload {
  return value as unknown as ScanFindingExplanationPayload;
}

function toCategorySummary(
  taxonomyId: string | null,
  categoryLookup: Map<string, TaxonomyCategoryRecord>,
): ScanFindingCategorySummary | null {
  if (!taxonomyId) {
    return null;
  }

  const category = categoryLookup.get(taxonomyId);

  if (!category) {
    return null;
  }

  return {
    taxonomyId: category.taxonomyId,
    name: category.name,
    fullPath: category.fullPath,
  };
}

async function loadScanRunRecord(
  scanRunId: string,
  database: ScanDatabaseClient,
): Promise<ScanRun | null> {
  return database.scanRun.findUnique({
    where: { id: scanRunId },
  });
}

async function loadCategoryLookupForScan(
  scanRun: ScanRun,
  findings: readonly ScanFindingReviewRecord[],
  database: ScanDatabaseClient,
) {
  if (!scanRun.taxonomyVersionId) {
    return new Map<string, TaxonomyCategoryRecord>();
  }

  const taxonomyIds = [
    ...new Set(
      findings.flatMap((finding) =>
        [finding.currentCategoryId, finding.recommendedCategoryId].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
  ];

  if (!taxonomyIds.length) {
    return new Map<string, TaxonomyCategoryRecord>();
  }

  const categories = (await database.taxonomyCategory.findMany({
    where: {
      taxonomyVersionId: scanRun.taxonomyVersionId,
      taxonomyId: { in: taxonomyIds },
    },
    select: {
      taxonomyId: true,
      taxonomyGid: true,
      name: true,
      fullPath: true,
      isLeaf: true,
    },
  })) as TaxonomyCategoryRecord[];

  return new Map(categories.map((category) => [category.taxonomyId, category]));
}

function toScanFindingReviewListItem(
  record: ScanFindingReviewRecord,
  categoryLookup: Map<string, TaxonomyCategoryRecord>,
): ScanFindingReviewListItem {
  const evidence = parseFindingEvidencePayload(record.evidence as Prisma.JsonValue);
  const explanation = parseFindingExplanationPayload(record.explanation as Prisma.JsonValue);

  return {
    id: record.id,
    scanRunId: record.scanRunId,
    productId: record.productId,
    productGid: record.productGid,
    productHandle: record.productHandle ?? null,
    productTitle: record.productTitle,
    confidence: record.confidence,
    status: record.status,
    source: record.source,
    currentCategory: toCategorySummary(record.currentCategoryId ?? null, categoryLookup),
    recommendedCategory: toCategorySummary(
      record.recommendedCategoryId ?? null,
      categoryLookup,
    ),
    basisCount: explanation.basis.length,
    blockerCount: explanation.blockers.length,
    createdAt: record.createdAt.toISOString(),
  };
}

function toScanFindingReviewDetail(
  record: ScanFindingReviewRecord,
  categoryLookup: Map<string, TaxonomyCategoryRecord>,
): ScanFindingReviewDetail {
  return {
    ...toScanFindingReviewListItem(record, categoryLookup),
    evidence: parseFindingEvidencePayload(record.evidence as Prisma.JsonValue),
    explanation: parseFindingExplanationPayload(record.explanation as Prisma.JsonValue),
  };
}

async function loadPreviewCounts(
  scanRunId: string,
  database: ScanDatabaseClient,
): Promise<ScanReviewPreviewCounts> {
  const findings = (await database.scanFinding.findMany({
    where: { scanRunId },
    select: {
      confidence: true,
      status: true,
      recommendedCategoryId: true,
    },
  })) as Array<{
    confidence: ScanFindingConfidence;
    status: ScanFindingStatus;
    recommendedCategoryId: string | null;
  }>;

  const counts: ScanReviewPreviewCounts = {
    total: findings.length,
    open: 0,
    accepted: 0,
    dismissed: 0,
    applied: 0,
    rolledBack: 0,
    safeDeterministicOpen: 0,
    reviewRequiredOpen: 0,
    safeDeterministicAccepted: 0,
    reviewRequiredAccepted: 0,
    noSafeSuggestion: 0,
    readyToApply: 0,
  };

  for (const finding of findings) {
    switch (finding.status) {
      case ScanFindingStatus.OPEN:
        counts.open += 1;
        break;
      case ScanFindingStatus.ACCEPTED:
        counts.accepted += 1;
        break;
      case ScanFindingStatus.DISMISSED:
        counts.dismissed += 1;
        break;
      case ScanFindingStatus.APPLIED:
        counts.applied += 1;
        break;
      case ScanFindingStatus.ROLLED_BACK:
        counts.rolledBack += 1;
        break;
      default:
        break;
    }

    if (finding.status === ScanFindingStatus.OPEN) {
      if (
        finding.recommendedCategoryId &&
        (finding.confidence === ScanFindingConfidence.EXACT ||
          finding.confidence === ScanFindingConfidence.STRONG)
      ) {
        counts.safeDeterministicOpen += 1;
      } else if (
        finding.recommendedCategoryId &&
        finding.confidence === ScanFindingConfidence.REVIEW_REQUIRED
      ) {
        counts.reviewRequiredOpen += 1;
      } else if (finding.confidence === ScanFindingConfidence.NO_SAFE_SUGGESTION) {
        counts.noSafeSuggestion += 1;
      }
    }

    if (
      finding.status === ScanFindingStatus.ACCEPTED &&
      finding.recommendedCategoryId &&
      finding.confidence !== ScanFindingConfidence.NO_SAFE_SUGGESTION
    ) {
      counts.readyToApply += 1;

      if (
        finding.confidence === ScanFindingConfidence.EXACT ||
        finding.confidence === ScanFindingConfidence.STRONG
      ) {
        counts.safeDeterministicAccepted += 1;
      }

      if (finding.confidence === ScanFindingConfidence.REVIEW_REQUIRED) {
        counts.reviewRequiredAccepted += 1;
      }
    }
  }

  return counts;
}

async function syncReviewCountsOnScanRun(
  scanRunId: string,
  database: ScanDatabaseClient,
): Promise<ScanRun> {
  const findings = (await database.scanFinding.findMany({
    where: { scanRunId },
    select: {
      status: true,
    },
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

  return database.scanRun.update({
    where: { id: scanRunId },
    data: {
      acceptedFindingCount,
      rejectedFindingCount,
    },
  });
}

export async function createScanRun(
  args: {
    shopId: string;
    trigger: ScanRun["trigger"];
    source: string;
    taxonomyVersionId?: string | null;
  },
  database: ScanDatabaseClient = prisma,
): Promise<ScanRunDetail> {
  const record = await database.scanRun.create({
    data: {
      shopId: args.shopId,
      trigger: args.trigger,
      source: args.source,
      taxonomyVersionId: args.taxonomyVersionId ?? null,
    },
  });

  return toScanRunDetail(record, database);
}

export async function findActiveScanRunForShop(
  shopId: string,
  database: ScanDatabaseClient = prisma,
): Promise<ScanRunDetail | null> {
  const record = await database.scanRun.findFirst({
    where: {
      shopId,
      status: {
        in: [ScanRunStatus.PENDING, ScanRunStatus.RUNNING],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return record ? toScanRunDetail(record, database) : null;
}

export async function getLatestScanRunForShop(
  shopId: string,
  database: ScanDatabaseClient = prisma,
): Promise<ScanRunDetail | null> {
  const record = await database.scanRun.findFirst({
    where: { shopId },
    orderBy: [{ createdAt: "desc" }],
  });

  return record ? toScanRunDetail(record, database) : null;
}

export async function getScanRunById(
  args: { shopId: string; scanRunId: string },
  database: ScanDatabaseClient = prisma,
): Promise<ScanRunDetail | null> {
  const record = await database.scanRun.findUnique({
    where: { id: args.scanRunId },
  });

  if (!record || record.shopId !== args.shopId) {
    return null;
  }

  return toScanRunDetail(record, database);
}

export async function listRecentScanRunsForShop(
  args: { shopId: string; limit?: number },
  database: ScanDatabaseClient = prisma,
): Promise<ScanHistoryEntry[]> {
  const records = await database.scanRun.findMany({
    where: { shopId: args.shopId },
    orderBy: [{ createdAt: "desc" }],
    take: args.limit ?? 10,
  });

  return Promise.all(
    records.map(async (record) => ({
      ...(await toScanRunDetail(record, database)),
    })),
  );
}

export async function listScanFindingsForReview(
  args: {
    shopId: string;
    scanRunId: string;
    filters?: ScanFindingReviewFilters;
  },
  database: ScanDatabaseClient = prisma,
): Promise<ScanFindingReviewPage | null> {
  const scanRun = await loadScanRunRecord(args.scanRunId, database);

  if (!scanRun || scanRun.shopId !== args.shopId) {
    return null;
  }

  const filters = normalizeReviewFilters(args.filters);
  const where: Prisma.ScanFindingWhereInput = {
    shopId: args.shopId,
    scanRunId: args.scanRunId,
    ...(filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.confidence !== "ALL" ? { confidence: filters.confidence } : {}),
    ...(filters.query
      ? {
          productTitle: {
            contains: filters.query,
            mode: "insensitive",
          },
        }
      : {}),
  };
  const totalCount = await database.scanFinding.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const records = (await database.scanFinding.findMany({
    where,
    select: {
      id: true,
      scanRunId: true,
      productId: true,
      productGid: true,
      productHandle: true,
      productTitle: true,
      evidence: true,
      explanation: true,
      currentCategoryId: true,
      recommendedCategoryId: true,
      confidence: true,
      status: true,
      source: true,
      createdAt: true,
    },
    orderBy: [
      { status: "asc" },
      { confidence: "asc" },
      { productTitle: "asc" },
    ],
    skip: (page - 1) * filters.pageSize,
    take: filters.pageSize,
  })) as ScanFindingReviewRecord[];
  const categoryLookup = await loadCategoryLookupForScan(scanRun, records, database);

  return {
    items: records.map((record) => toScanFindingReviewListItem(record, categoryLookup)),
    totalCount,
    totalPages,
    page,
    pageSize: filters.pageSize,
    filters: {
      status: filters.status,
      confidence: filters.confidence,
      query: filters.query,
    },
    previewCounts: await loadPreviewCounts(args.scanRunId, database),
  };
}

export async function getScanFindingDetailForReview(
  args: {
    shopId: string;
    scanRunId: string;
    findingId: string;
  },
  database: ScanDatabaseClient = prisma,
): Promise<ScanFindingReviewDetail | null> {
  const scanRun = await loadScanRunRecord(args.scanRunId, database);

  if (!scanRun || scanRun.shopId !== args.shopId) {
    return null;
  }

  const record = (await database.scanFinding.findUnique({
    where: { id: args.findingId },
    select: {
      id: true,
      scanRunId: true,
      productId: true,
      productGid: true,
      productHandle: true,
      productTitle: true,
      evidence: true,
      explanation: true,
      currentCategoryId: true,
      recommendedCategoryId: true,
      confidence: true,
      status: true,
      source: true,
      createdAt: true,
    },
  })) as ScanFindingReviewRecord | null;

  if (!record || record.scanRunId !== args.scanRunId) {
    return null;
  }

  const categoryLookup = await loadCategoryLookupForScan(scanRun, [record], database);

  return toScanFindingReviewDetail(record, categoryLookup);
}

export async function updateScanFindingStatuses(
  args: {
    shopId: string;
    scanRunId: string;
    targetStatus: "ACCEPTED" | "DISMISSED";
    findingIds?: readonly string[];
    safeDeterministicOnly?: boolean;
  },
  database: ScanDatabaseClient = prisma,
): Promise<UpdateScanFindingStatusesResult | null> {
  return database.$transaction(async (transaction: ScanDatabaseClient) => {
    const scanRun = await loadScanRunRecord(args.scanRunId, transaction);

    if (!scanRun || scanRun.shopId !== args.shopId) {
      return null;
    }

    const where: Prisma.ScanFindingWhereInput = {
      shopId: args.shopId,
      scanRunId: args.scanRunId,
      status: args.safeDeterministicOnly
        ? ScanFindingStatus.OPEN
        : {
            notIn: [ScanFindingStatus.APPLIED, ScanFindingStatus.ROLLED_BACK],
          },
      ...(args.findingIds?.length ? { id: { in: [...args.findingIds] } } : {}),
    };

    if (args.targetStatus === ScanFindingStatus.ACCEPTED) {
      Object.assign(where, {
        recommendedCategoryId: { not: null },
        confidence: args.safeDeterministicOnly
          ? { in: [ScanFindingConfidence.EXACT, ScanFindingConfidence.STRONG] }
          : {
              in: [
                ScanFindingConfidence.EXACT,
                ScanFindingConfidence.STRONG,
                ScanFindingConfidence.REVIEW_REQUIRED,
              ],
            },
      });
    }

    const result = await transaction.scanFinding.updateMany({
      where,
      data: {
        status: args.targetStatus,
      },
    });
    const updatedScanRunRecord = await syncReviewCountsOnScanRun(args.scanRunId, transaction);

    return {
      updatedCount: result.count,
      previewCounts: await loadPreviewCounts(args.scanRunId, transaction),
      scanRun: await toScanRunDetail(updatedScanRunRecord, transaction),
    };
  });
}

export async function markScanRunRunning(
  args: {
    scanRunId: string;
    externalOperationId?: string | null;
    externalOperationStatus?: string | null;
  },
  database: ScanDatabaseClient = prisma,
): Promise<ScanRunDetail> {
  const record = await database.scanRun.update({
    where: { id: args.scanRunId },
    data: {
      status: ScanRunStatus.RUNNING,
      startedAt: new Date(),
      externalOperationId: args.externalOperationId ?? null,
      externalOperationStatus: args.externalOperationStatus ?? null,
      failureSummary: null,
    },
  });

  return toScanRunDetail(record, database);
}

export async function markScanRunSucceeded(
  args: {
    scanRunId: string;
    scannedProductCount: number;
    findingCount: number;
    externalOperationStatus?: string | null;
  },
  database: ScanDatabaseClient = prisma,
): Promise<ScanRunDetail> {
  const record = await database.scanRun.update({
    where: { id: args.scanRunId },
    data: {
      status: ScanRunStatus.SUCCEEDED,
      scannedProductCount: args.scannedProductCount,
      findingCount: args.findingCount,
      externalOperationStatus: args.externalOperationStatus ?? "COMPLETED",
      completedAt: new Date(),
      failureSummary: null,
    },
  });

  return toScanRunDetail(record, database);
}

export async function markScanRunFailed(
  args: {
    scanRunId: string;
    failureSummary: string;
    externalOperationStatus?: string | null;
  },
  database: ScanDatabaseClient = prisma,
): Promise<ScanRunDetail> {
  const record = await database.scanRun.update({
    where: { id: args.scanRunId },
    data: {
      status: ScanRunStatus.FAILED,
      externalOperationStatus: args.externalOperationStatus ?? "FAILED",
      completedAt: new Date(),
      failureSummary: args.failureSummary,
    },
  });

  return toScanRunDetail(record, database);
}

export async function createScanFindings(
  args: {
    findings: readonly CreateScanFindingInput[];
  },
  database: ScanDatabaseClient = prisma,
): Promise<number> {
  if (!args.findings.length) {
    return 0;
  }

  const result = await database.scanFinding.createMany({
    data: args.findings.map((finding) => ({
      shopId: finding.shopId,
      scanRunId: finding.scanRunId,
      productId: finding.productId,
      productGid: finding.productGid,
      productHandle: finding.productHandle ?? null,
      productTitle: finding.productTitle,
      evidence: finding.evidence,
      explanation: finding.explanation,
      currentCategoryId: finding.currentCategoryId ?? null,
      currentCategoryGid: finding.currentCategoryGid ?? null,
      recommendedCategoryId: finding.recommendedCategoryId ?? null,
      recommendedCategoryGid: finding.recommendedCategoryGid ?? null,
      confidence: finding.confidence,
      status: finding.status ?? ScanFindingStatus.OPEN,
      source: finding.source,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

export async function syncRuleDefinitions(
  args: {
    definitions: readonly ScanRuleDefinitionInput[];
  },
  database: ScanDatabaseClient = prisma,
): Promise<RuleDefinition[]> {
  const definitions: RuleDefinition[] = [];

  for (const definition of args.definitions) {
    const record = await database.ruleDefinition.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        version: definition.version,
        description: definition.description,
        priority: definition.priority,
        state: definition.state ?? RuleDefinitionState.ACTIVE,
        configuration: definition.configuration,
      },
      update: {
        version: definition.version,
        description: definition.description,
        priority: definition.priority,
        state: definition.state ?? RuleDefinitionState.ACTIVE,
        configuration: definition.configuration,
      },
    });

    definitions.push(record);
  }

  return definitions;
}

export async function getLatestTaxonomyVersion(
  locale = "en",
  database: ScanDatabaseClient = prisma,
): Promise<TaxonomyVersion | null> {
  return database.taxonomyVersion.findFirst({
    where: { locale },
    orderBy: [{ releasedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function loadTaxonomyReferenceSnapshot(
  versionId: string,
  database: ScanDatabaseClient = prisma,
): Promise<TaxonomyReferenceSnapshot | null> {
  const version = await database.taxonomyVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    return null;
  }

  const categories = (await database.taxonomyCategory.findMany({
    where: {
      taxonomyVersionId: versionId,
      isLeaf: true,
    },
    select: {
      taxonomyId: true,
      taxonomyGid: true,
      name: true,
      fullPath: true,
      isLeaf: true,
    },
    orderBy: [{ taxonomyId: "asc" }],
  })) as TaxonomyCategoryRecord[];

  const terms = (await database.taxonomyCategoryTerm.findMany({
    where: {
      taxonomyVersionId: versionId,
      category: {
        isLeaf: true,
      },
    },
    include: {
      category: {
        select: {
          taxonomyId: true,
          taxonomyGid: true,
          name: true,
          fullPath: true,
          isLeaf: true,
        },
      },
    },
    orderBy: [{ taxonomyId: "asc" }, { normalizedTerm: "asc" }],
  })) as TaxonomyTermWithCategory[];

  return {
    versionId: version.id,
    version: version.version,
    locale: version.locale,
    categories,
    terms: terms.map((term) => ({
      taxonomyId: term.taxonomyId,
      term: term.term,
      normalizedTerm: term.normalizedTerm,
      kind: term.kind,
      category: term.category,
    })),
  };
}
