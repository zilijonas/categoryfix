import {
  AuditActorType,
  JobStatus,
  ScanFindingConfidence,
  ScanFindingStatus,
  ScanRunStatus,
  ShopInstallationState,
} from "@prisma/client";
import type { ReviewLoaderDatabaseClient } from "./scan-review.server.js";
import type { ApplyJobsDatabaseClient, ProductCategoryStateSnapshot, ScanDatabaseClient } from "@categoryfix/db";

interface MockShop {
  id: string;
  shop: string;
  state: ShopInstallationState;
  scopes: string;
  appUrl: string;
  offlineSessionId: string | null;
  installedAt: Date;
  uninstalledAt: Date | null;
}

interface MockScanRun {
  id: string;
  shopId: string;
  status: ScanRunStatus;
  trigger: "MANUAL";
  source: string;
  externalOperationId: string | null;
  externalOperationStatus: string | null;
  taxonomyVersionId: string | null;
  scannedProductCount: number;
  findingCount: number;
  acceptedFindingCount: number;
  rejectedFindingCount: number;
  failureSummary: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockFinding {
  id: string;
  shopId: string;
  scanRunId: string;
  productId: string;
  productGid: string;
  productHandle: string | null;
  productTitle: string;
  evidence: Record<string, unknown>;
  explanation: Record<string, unknown>;
  currentCategoryId: string | null;
  currentCategoryGid: string | null;
  recommendedCategoryId: string | null;
  recommendedCategoryGid: string | null;
  confidence: ScanFindingConfidence;
  status: ScanFindingStatus;
  source: string;
  createdAt: Date;
}

interface MockApplyJob {
  id: string;
  shopId: string;
  status: JobStatus;
  source: string;
  reason: string;
  actor: string;
  selectedFindingCount: number;
  appliedCount: number;
  failedCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockApplyJobItem {
  id: string;
  applyJobId: string;
  scanFindingId: string | null;
  productId: string;
  productGid: string;
  before: ProductCategoryStateSnapshot;
  after: ProductCategoryStateSnapshot;
  source: string;
  reason: string;
  actor: string;
  status: JobStatus;
  errorMessage: string | null;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockRollbackJob {
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
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockRollbackJobItem {
  id: string;
  rollbackJobId: string;
  applyJobItemId: string | null;
  productId: string;
  productGid: string;
  before: ProductCategoryStateSnapshot;
  after: ProductCategoryStateSnapshot;
  source: string;
  reason: string;
  actor: string;
  status: JobStatus;
  errorMessage: string | null;
  rolledBackAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockAuditEvent {
  id: string;
  shopId: string;
  eventType: string;
  actorType: AuditActorType;
  actor: string;
  source: string;
  reason: string | null;
  applyJobId: string | null;
  applyJobItemId: string | null;
  rollbackJobId: string | null;
  rollbackJobItemId: string | null;
  scanRunId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

interface MockLiveProductState {
  productId: string;
  productGid: string;
  productTitle: string;
  category: {
    taxonomyId: string | null;
    taxonomyGid: string | null;
    name: string | null;
    fullPath: string | null;
  } | null;
}

function createExplanation(decision: string, blockers: string[] = []) {
  return {
    ruleKey: "phase4-playwright",
    ruleVersion: "2026-03-31.phase4",
    decision,
    basis: [
      {
        source: "title",
        rawValue: "Beanie",
        normalizedValue: "beanie",
        matchType: "TERM",
        matchedTerm: "beanie",
        taxonomyId: "aa-2-17",
        taxonomyGid: "gid://shopify/TaxonomyCategory/aa-2-17",
        taxonomyName: "Hats",
        taxonomyFullPath: "Apparel & Accessories > Clothing Accessories > Hats",
      },
    ],
    blockers: blockers.map((message) => ({
      type: "no_safe_match",
      message,
      taxonomyIds: [],
    })),
  };
}

function createEvidence(title: string) {
  return {
    title,
    productType: null,
    vendor: null,
    tags: [],
    collections: [],
    currentCategory: null,
    normalized: {
      title: title.toLowerCase(),
      productType: null,
      vendor: null,
      tags: [],
      collections: [],
      currentCategory: null,
    },
    matchedSignals: [],
  };
}

function createMockState() {
  return {
    shops: [
      {
        id: "shop_1",
        shop: process.env.CATEGORYFIX_E2E_SHOP ?? "demo.myshopify.com",
        state: ShopInstallationState.INSTALLED,
        scopes: "read_products,write_products",
        appUrl: "http://127.0.0.1:4173",
        offlineSessionId: "offline_demo",
        installedAt: new Date("2026-03-31T12:00:00.000Z"),
        uninstalledAt: null,
      },
    ] as MockShop[],
    scanRuns: [
      {
        id: "scan_mock_completed",
        shopId: "shop_1",
        status: ScanRunStatus.SUCCEEDED,
        trigger: "MANUAL",
        source: "phase3-deterministic-scan",
        externalOperationId: null,
        externalOperationStatus: "COMPLETED",
        taxonomyVersionId: "taxonomy_v1",
        scannedProductCount: 4,
        findingCount: 4,
        acceptedFindingCount: 0,
        rejectedFindingCount: 0,
        failureSummary: null,
        startedAt: new Date("2026-03-31T12:00:00.000Z"),
        completedAt: new Date("2026-03-31T12:05:00.000Z"),
        createdAt: new Date("2026-03-31T12:00:00.000Z"),
        updatedAt: new Date("2026-03-31T12:05:00.000Z"),
      },
    ] as MockScanRun[],
    findings: [
      {
        id: "finding_mock_1",
        shopId: "shop_1",
        scanRunId: "scan_mock_completed",
        productId: "100",
        productGid: "gid://shopify/Product/100",
        productHandle: "wool-beanie",
        productTitle: "Wool Beanie",
        evidence: createEvidence("Wool Beanie"),
        explanation: createExplanation("EXACT"),
        currentCategoryId: null,
        currentCategoryGid: null,
        recommendedCategoryId: "aa-2-17",
        recommendedCategoryGid: "gid://shopify/TaxonomyCategory/aa-2-17",
        confidence: ScanFindingConfidence.EXACT,
        status: ScanFindingStatus.OPEN,
        source: "phase3-deterministic-scan",
        createdAt: new Date("2026-03-31T12:05:00.000Z"),
      },
      {
        id: "finding_mock_2",
        shopId: "shop_1",
        scanRunId: "scan_mock_completed",
        productId: "101",
        productGid: "gid://shopify/Product/101",
        productHandle: "paperback-novel",
        productTitle: "Paperback Novel",
        evidence: createEvidence("Paperback Novel"),
        explanation: createExplanation("REVIEW_REQUIRED"),
        currentCategoryId: null,
        currentCategoryGid: null,
        recommendedCategoryId: "me-1-3",
        recommendedCategoryGid: "gid://shopify/TaxonomyCategory/me-1-3",
        confidence: ScanFindingConfidence.REVIEW_REQUIRED,
        status: ScanFindingStatus.OPEN,
        source: "phase3-deterministic-scan",
        createdAt: new Date("2026-03-31T12:05:00.000Z"),
      },
      {
        id: "finding_mock_3",
        shopId: "shop_1",
        scanRunId: "scan_mock_completed",
        productId: "102",
        productGid: "gid://shopify/Product/102",
        productHandle: "mystery-bundle",
        productTitle: "Mystery Bundle",
        evidence: createEvidence("Mystery Bundle"),
        explanation: createExplanation("NO_SAFE_SUGGESTION", [
          "CategoryFix could not make a safe recommendation.",
        ]),
        currentCategoryId: null,
        currentCategoryGid: null,
        recommendedCategoryId: null,
        recommendedCategoryGid: null,
        confidence: ScanFindingConfidence.NO_SAFE_SUGGESTION,
        status: ScanFindingStatus.OPEN,
        source: "phase3-deterministic-scan",
        createdAt: new Date("2026-03-31T12:05:00.000Z"),
      },
      {
        id: "finding_mock_4",
        shopId: "shop_1",
        scanRunId: "scan_mock_completed",
        productId: "103",
        productGid: "gid://shopify/Product/103",
        productHandle: "sun-hat",
        productTitle: "Sun Hat",
        evidence: createEvidence("Sun Hat"),
        explanation: createExplanation("STRONG"),
        currentCategoryId: null,
        currentCategoryGid: null,
        recommendedCategoryId: "aa-2-17",
        recommendedCategoryGid: "gid://shopify/TaxonomyCategory/aa-2-17",
        confidence: ScanFindingConfidence.STRONG,
        status: ScanFindingStatus.OPEN,
        source: "phase3-deterministic-scan",
        createdAt: new Date("2026-03-31T12:05:00.000Z"),
      },
    ] as MockFinding[],
    categories: [
      {
        taxonomyVersionId: "taxonomy_v1",
        taxonomyId: "aa-2-17",
        taxonomyGid: "gid://shopify/TaxonomyCategory/aa-2-17",
        name: "Hats",
        fullPath: "Apparel & Accessories > Clothing Accessories > Hats",
        isLeaf: true,
      },
      {
        taxonomyVersionId: "taxonomy_v1",
        taxonomyId: "me-1-3",
        taxonomyGid: "gid://shopify/TaxonomyCategory/me-1-3",
        name: "Print Books",
        fullPath: "Media > Books > Print Books",
        isLeaf: true,
      },
    ],
    liveProducts: [
      {
        productId: "100",
        productGid: "gid://shopify/Product/100",
        productTitle: "Wool Beanie",
        category: null,
      },
      {
        productId: "101",
        productGid: "gid://shopify/Product/101",
        productTitle: "Paperback Novel",
        category: null,
      },
      {
        productId: "102",
        productGid: "gid://shopify/Product/102",
        productTitle: "Mystery Bundle",
        category: null,
      },
      {
        productId: "103",
        productGid: "gid://shopify/Product/103",
        productTitle: "Sun Hat",
        category: null,
      },
    ] as MockLiveProductState[],
    applyJobs: [] as MockApplyJob[],
    applyJobItems: [] as MockApplyJobItem[],
    rollbackJobs: [] as MockRollbackJob[],
    rollbackJobItems: [] as MockRollbackJobItem[],
    auditEvents: [] as MockAuditEvent[],
    sequences: {
      applyJob: 1,
      applyJobItem: 1,
      rollbackJob: 1,
      rollbackJobItem: 1,
      auditEvent: 1,
    },
  };
}

let mockState = createMockState();

export function resetMockReviewState() {
  mockState = createMockState();
}

function now() {
  return new Date("2026-03-31T14:00:00.000Z");
}

function nextSequence(key: keyof typeof mockState.sequences) {
  const value = mockState.sequences[key];
  mockState.sequences[key] += 1;

  return value;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function selectFields(record: Record<string, unknown>, select: Record<string, unknown>) {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(select)) {
    if (select[key]) {
      result[key] = record[key];
    }
  }

  return result;
}

export async function mockReadLiveProductState(productGid: string) {
  const record = mockState.liveProducts.find((entry) => entry.productGid === productGid);

  if (!record) {
    throw new Error("Mock product not found.");
  }

  return cloneJson(record);
}

export async function mockWriteProductCategory(productGid: string, categoryGid: string | null) {
  const record = mockState.liveProducts.find((entry) => entry.productGid === productGid);

  if (!record) {
    throw new Error("Mock product not found.");
  }

  const category = categoryGid
    ? mockState.categories.find((entry) => entry.taxonomyGid === categoryGid) ?? null
    : null;

  record.category = category
    ? {
        taxonomyId: category.taxonomyId,
        taxonomyGid: category.taxonomyGid,
        name: category.name,
        fullPath: category.fullPath,
      }
    : null;

  return cloneJson(record);
}

function matchesWhere(finding: MockFinding, where: any) {
  if (where.shopId && finding.shopId !== where.shopId) {
    return false;
  }

  if (where.scanRunId && finding.scanRunId !== where.scanRunId) {
    return false;
  }

  if (where.id?.in && !where.id.in.includes(finding.id)) {
    return false;
  }

  if (where.id && typeof where.id === "string" && finding.id !== where.id) {
    return false;
  }

  if (where.status && typeof where.status === "string" && finding.status !== where.status) {
    return false;
  }

  if (where.status?.notIn && where.status.notIn.includes(finding.status)) {
    return false;
  }

  if (
    where.confidence &&
    typeof where.confidence === "string" &&
    finding.confidence !== where.confidence
  ) {
    return false;
  }

  if (where.confidence?.in && !where.confidence.in.includes(finding.confidence)) {
    return false;
  }

  if (where.recommendedCategoryId?.not === null && !finding.recommendedCategoryId) {
    return false;
  }

  if (
    where.productTitle?.contains &&
    !finding.productTitle
      .toLowerCase()
      .includes(String(where.productTitle.contains).toLowerCase())
  ) {
    return false;
  }

  return true;
}

export function getMockReviewDatabase() {
  const database = {
    shop: {
      async findUnique(args: any) {
        const record =
          mockState.shops.find((shop) => shop.shop === args.where.shop) ?? null;

        if (!record || !args.select) {
          return record as any;
        }

        return selectFields(record as unknown as Record<string, unknown>, args.select) as any;
      },
    },
    scanRun: {
      async create() {
        throw new Error("Scan creation is not supported in e2e mock mode.");
      },
      async findFirst(args: any) {
        const matches = mockState.scanRuns
          .filter((scanRun) => scanRun.shopId === args.where?.shopId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

        return (matches[0] ?? null) as any;
      },
      async findMany(args: any) {
        return mockState.scanRuns
          .filter((scanRun) => scanRun.shopId === args.where?.shopId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take ?? mockState.scanRuns.length) as any;
      },
      async findUnique(args: any) {
        const record = mockState.scanRuns.find((scanRun) => scanRun.id === args.where.id) ?? null;

        if (!record || !args.select) {
          return record as any;
        }

        return selectFields(record as unknown as Record<string, unknown>, args.select) as any;
      },
      async update(args: any) {
        const record = mockState.scanRuns.find((scanRun) => scanRun.id === args.where.id);

        if (!record) {
          throw new Error("Mock scan run not found.");
        }

        Object.assign(record, args.data, { updatedAt: now() });

        return record as any;
      },
    },
    scanFinding: {
      async count(args: any) {
        return mockState.findings.filter((finding) => matchesWhere(finding, args.where ?? {})).length;
      },
      async createMany() {
        throw new Error("createMany is not supported in e2e mock mode.");
      },
      async findMany(args: any) {
        const ordered = mockState.findings
          .filter((finding) => matchesWhere(finding, args.where ?? {}))
          .sort((left, right) => {
            if (left.status !== right.status) {
              return left.status.localeCompare(right.status);
            }

            if (left.confidence !== right.confidence) {
              return left.confidence.localeCompare(right.confidence);
            }

            return left.productTitle.localeCompare(right.productTitle);
          });
        const sliced = ordered.slice(
          args.skip ?? 0,
          (args.skip ?? 0) + (args.take ?? ordered.length),
        );

        if (!args.select) {
          return sliced as any;
        }

        return sliced.map((finding) =>
          selectFields(finding as unknown as Record<string, unknown>, args.select),
        ) as any;
      },
      async findUnique(args: any) {
        const finding = mockState.findings.find((entry) => entry.id === args.where.id) ?? null;

        if (!finding || !args.select) {
          return finding as any;
        }

        return selectFields(finding as unknown as Record<string, unknown>, args.select) as any;
      },
      async update(args: any) {
        const finding = mockState.findings.find((entry) => entry.id === args.where.id);

        if (!finding) {
          throw new Error("Mock finding not found.");
        }

        Object.assign(finding, args.data);

        return finding as any;
      },
      async updateMany(args: any) {
        const matches = mockState.findings.filter((finding) => matchesWhere(finding, args.where ?? {}));

        for (const finding of matches) {
          Object.assign(finding, args.data);
        }

        return { count: matches.length };
      },
    },
    ruleDefinition: {
      async upsert() {
        throw new Error("ruleDefinition.upsert is unavailable in e2e mock mode.");
      },
    },
    taxonomyVersion: {
      async findFirst() {
        return null;
      },
      async findUnique() {
        return null;
      },
    },
    taxonomyCategory: {
      async findMany(args: any) {
        return mockState.categories.filter(
          (category) =>
            category.taxonomyVersionId === args.where?.taxonomyVersionId &&
            (!args.where?.taxonomyId?.in || args.where.taxonomyId.in.includes(category.taxonomyId)),
        ) as any;
      },
    },
    taxonomyCategoryTerm: {
      async findMany() {
        return [];
      },
    },
    applyJob: {
      async create(args: any) {
        const timestamp = now();
        const record: MockApplyJob = {
          id: `apply_job_${nextSequence("applyJob")}`,
          shopId: args.data.shopId,
          status: args.data.status ?? JobStatus.PENDING,
          source: args.data.source,
          reason: args.data.reason,
          actor: args.data.actor,
          selectedFindingCount: args.data.selectedFindingCount ?? 0,
          appliedCount: args.data.appliedCount ?? 0,
          failedCount: args.data.failedCount ?? 0,
          startedAt: args.data.startedAt ?? null,
          completedAt: args.data.completedAt ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        mockState.applyJobs.push(record);

        return record as any;
      },
      async findMany(args: any) {
        const records = mockState.applyJobs
          .filter((job) => job.shopId === args.where?.shopId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take ?? mockState.applyJobs.length);

        if (!args.include) {
          return records as any;
        }

        return records.map((job) => ({
          ...job,
          items: mockState.applyJobItems
            .filter((item) => item.applyJobId === job.id)
            .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
            .map((item) => ({
              ...item,
              scanFinding: item.scanFindingId
                ? {
                    status:
                      mockState.findings.find((finding) => finding.id === item.scanFindingId)?.status ??
                      null,
                  }
                : null,
            })),
        })) as any;
      },
      async findUnique(args: any) {
        const record = mockState.applyJobs.find((job) => job.id === args.where.id) ?? null;

        if (!record) {
          return null;
        }

        if (args.include?.items) {
          return {
            ...record,
            items: mockState.applyJobItems
              .filter((item) => item.applyJobId === record.id)
              .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
              .map((item) => ({
                ...item,
                scanFinding: args.include.items.include?.scanFinding
                  ? item.scanFindingId
                    ? {
                        status:
                          mockState.findings.find((finding) => finding.id === item.scanFindingId)?.status ??
                          null,
                      }
                    : null
                  : undefined,
              })),
          } as any;
        }

        if (args.select) {
          return selectFields(record as unknown as Record<string, unknown>, args.select) as any;
        }

        return record as any;
      },
      async update(args: any) {
        const record = mockState.applyJobs.find((job) => job.id === args.where.id);

        if (!record) {
          throw new Error("Mock apply job not found.");
        }

        Object.assign(record, args.data, { updatedAt: now() });

        return record as any;
      },
    },
    applyJobItem: {
      async createMany(args: any) {
        for (const row of args.data) {
          mockState.applyJobItems.push({
            id: `apply_job_item_${nextSequence("applyJobItem")}`,
            applyJobId: row.applyJobId,
            scanFindingId: row.scanFindingId ?? null,
            productId: row.productId,
            productGid: row.productGid,
            before: cloneJson(row.before),
            after: cloneJson(row.after),
            source: row.source,
            reason: row.reason,
            actor: row.actor,
            status: row.status ?? JobStatus.PENDING,
            errorMessage: row.errorMessage ?? null,
            appliedAt: row.appliedAt ?? null,
            createdAt: now(),
            updatedAt: now(),
          });
        }

        return { count: args.data.length };
      },
      async findMany(args: any) {
        return mockState.applyJobItems
          .filter((item) => {
            if (args.where?.applyJobId && item.applyJobId !== args.where.applyJobId) {
              return false;
            }

            if (args.where?.id && item.id !== args.where.id) {
              return false;
            }

            if (args.where?.status?.in && !args.where.status.in.includes(item.status)) {
              return false;
            }

            return true;
          })
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
          .slice(0, args.take ?? mockState.applyJobItems.length) as any;
      },
      async update(args: any) {
        const record = mockState.applyJobItems.find((item) => item.id === args.where.id);

        if (!record) {
          throw new Error("Mock apply job item not found.");
        }

        Object.assign(record, args.data, { updatedAt: now() });

        return record as any;
      },
    },
    rollbackJob: {
      async create(args: any) {
        const timestamp = now();
        const record: MockRollbackJob = {
          id: `rollback_job_${nextSequence("rollbackJob")}`,
          shopId: args.data.shopId,
          applyJobId: args.data.applyJobId ?? null,
          status: args.data.status ?? JobStatus.PENDING,
          source: args.data.source,
          reason: args.data.reason,
          actor: args.data.actor,
          selectedItemCount: args.data.selectedItemCount ?? 0,
          rolledBackCount: args.data.rolledBackCount ?? 0,
          failedCount: args.data.failedCount ?? 0,
          startedAt: args.data.startedAt ?? null,
          completedAt: args.data.completedAt ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        mockState.rollbackJobs.push(record);

        return record as any;
      },
      async findMany(args: any) {
        const records = mockState.rollbackJobs
          .filter((job) => job.shopId === args.where?.shopId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take ?? mockState.rollbackJobs.length);

        if (!args.include?.items) {
          return records as any;
        }

        return records.map((job) => ({
          ...job,
          items: mockState.rollbackJobItems
            .filter((item) => item.rollbackJobId === job.id)
            .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
        })) as any;
      },
      async findUnique(args: any) {
        const record = mockState.rollbackJobs.find((job) => job.id === args.where.id) ?? null;

        if (!record) {
          return null;
        }

        if (args.include?.items) {
          return {
            ...record,
            items: mockState.rollbackJobItems
              .filter((item) => item.rollbackJobId === record.id)
              .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
          } as any;
        }

        if (args.select) {
          return selectFields(record as unknown as Record<string, unknown>, args.select) as any;
        }

        return record as any;
      },
      async update(args: any) {
        const record = mockState.rollbackJobs.find((job) => job.id === args.where.id);

        if (!record) {
          throw new Error("Mock rollback job not found.");
        }

        Object.assign(record, args.data, { updatedAt: now() });

        return record as any;
      },
    },
    rollbackJobItem: {
      async createMany(args: any) {
        for (const row of args.data) {
          mockState.rollbackJobItems.push({
            id: `rollback_job_item_${nextSequence("rollbackJobItem")}`,
            rollbackJobId: row.rollbackJobId,
            applyJobItemId: row.applyJobItemId ?? null,
            productId: row.productId,
            productGid: row.productGid,
            before: cloneJson(row.before),
            after: cloneJson(row.after),
            source: row.source,
            reason: row.reason,
            actor: row.actor,
            status: row.status ?? JobStatus.PENDING,
            errorMessage: row.errorMessage ?? null,
            rolledBackAt: row.rolledBackAt ?? null,
            createdAt: now(),
            updatedAt: now(),
          });
        }

        return { count: args.data.length };
      },
      async findMany(args: any) {
        return mockState.rollbackJobItems
          .filter((item) => {
            if (args.where?.rollbackJobId && item.rollbackJobId !== args.where.rollbackJobId) {
              return false;
            }

            if (args.where?.id && item.id !== args.where.id) {
              return false;
            }

            if (args.where?.status?.in && !args.where.status.in.includes(item.status)) {
              return false;
            }

            return true;
          })
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
          .slice(0, args.take ?? mockState.rollbackJobItems.length) as any;
      },
      async update(args: any) {
        const record = mockState.rollbackJobItems.find((item) => item.id === args.where.id);

        if (!record) {
          throw new Error("Mock rollback job item not found.");
        }

        Object.assign(record, args.data, { updatedAt: now() });

        return record as any;
      },
    },
    auditEvent: {
      async create(args: any) {
        const record: MockAuditEvent = {
          id: `audit_${nextSequence("auditEvent")}`,
          shopId: args.data.shopId,
          eventType: args.data.eventType,
          actorType: args.data.actorType,
          actor: args.data.actor,
          source: args.data.source,
          reason: args.data.reason ?? null,
          applyJobId: args.data.applyJobId ?? null,
          applyJobItemId: args.data.applyJobItemId ?? null,
          rollbackJobId: args.data.rollbackJobId ?? null,
          rollbackJobItemId: args.data.rollbackJobItemId ?? null,
          scanRunId: args.data.scanRunId ?? null,
          payload: args.data.payload ?? null,
          createdAt: now(),
        };
        mockState.auditEvents.push(record);

        return record as any;
      },
      async findMany(args: any) {
        return mockState.auditEvents
          .filter((event) => {
            if (args.where?.shopId && event.shopId !== args.where.shopId) {
              return false;
            }

            if (args.where?.OR) {
              const matches = args.where.OR.some((condition: any) => {
                if (condition.applyJobId?.not === null) {
                  return event.applyJobId !== null;
                }

                if (condition.rollbackJobId?.not === null) {
                  return event.rollbackJobId !== null;
                }

                return false;
              });

              if (!matches) {
                return false;
              }
            }

            return true;
          })
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take ?? mockState.auditEvents.length)
          .map((event) =>
            args.select
              ? selectFields(event as unknown as Record<string, unknown>, args.select)
              : event,
          ) as any;
      },
    },
    async $transaction(callback: any) {
      return callback(database as ScanDatabaseClient & ApplyJobsDatabaseClient);
    },
  } as unknown as ReviewLoaderDatabaseClient;

  return database;
}
