import {
  ScanFindingConfidence,
  ScanFindingStatus,
  ScanRunStatus,
  ShopInstallationState,
} from "@prisma/client";
import type { ReviewLoaderDatabaseClient } from "./scan-review.server.js";
import type { ScanDatabaseClient } from "@categoryfix/db";

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
  recommendedCategoryId: string | null;
  confidence: ScanFindingConfidence;
  status: ScanFindingStatus;
  source: string;
  createdAt: Date;
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
        recommendedCategoryId: "aa-2-17",
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
        recommendedCategoryId: "me-1-3",
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
        recommendedCategoryId: null,
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
        recommendedCategoryId: "aa-2-17",
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
  };
}

const mockState = createMockState();

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
        return mockState.shops.find((shop) => shop.shop === args.where.shop) ?? null;
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
        return (mockState.scanRuns.find((scanRun) => scanRun.id === args.where.id) ?? null) as any;
      },
      async update(args: any) {
        const record = mockState.scanRuns.find((scanRun) => scanRun.id === args.where.id);

        if (!record) {
          throw new Error("Mock scan run not found.");
        }

        Object.assign(record, args.data, { updatedAt: new Date("2026-03-31T14:00:00.000Z") });

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

        return sliced.map((finding) => {
          const record: Record<string, unknown> = {};

          for (const key of Object.keys(args.select)) {
            if (args.select[key]) {
              record[key] = (finding as unknown as Record<string, unknown>)[key];
            }
          }

          return record;
        }) as any;
      },
      async findUnique(args: any) {
        const finding = mockState.findings.find((entry) => entry.id === args.where.id) ?? null;

        if (!finding || !args.select) {
          return finding as any;
        }

        const record: Record<string, unknown> = {};

        for (const key of Object.keys(args.select)) {
          if (args.select[key]) {
            record[key] = (finding as unknown as Record<string, unknown>)[key];
          }
        }

        return record as any;
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
            args.where?.taxonomyId?.in.includes(category.taxonomyId),
        ) as any;
      },
    },
    taxonomyCategoryTerm: {
      async findMany() {
        return [];
      },
    },
    async $transaction(callback: any) {
      return callback(database as ScanDatabaseClient);
    },
  } as unknown as ReviewLoaderDatabaseClient;

  return database;
}
