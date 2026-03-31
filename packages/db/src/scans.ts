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
    create(args: Prisma.ScanRunCreateArgs): Promise<ScanRun>;
    findFirst(args: Prisma.ScanRunFindFirstArgs): Promise<ScanRun | null>;
    findUnique(args: Prisma.ScanRunFindUniqueArgs): Promise<ScanRun | null>;
    update(args: Prisma.ScanRunUpdateArgs): Promise<ScanRun>;
  };
  scanFinding: {
    createMany(args: Prisma.ScanFindingCreateManyArgs): Promise<{ count: number }>;
    findMany(args: Prisma.ScanFindingFindManyArgs): Promise<unknown[]>;
  };
  ruleDefinition: {
    upsert(args: Prisma.RuleDefinitionUpsertArgs): Promise<RuleDefinition>;
  };
  taxonomyVersion: {
    findFirst(args: Prisma.TaxonomyVersionFindFirstArgs): Promise<TaxonomyVersion | null>;
    findUnique(args: Prisma.TaxonomyVersionFindUniqueArgs): Promise<TaxonomyVersion | null>;
  };
  taxonomyCategory: {
    findMany(args: Prisma.TaxonomyCategoryFindManyArgs): Promise<unknown[]>;
  };
  taxonomyCategoryTerm: {
    findMany(args: Prisma.TaxonomyCategoryTermFindManyArgs): Promise<unknown[]>;
  };
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
