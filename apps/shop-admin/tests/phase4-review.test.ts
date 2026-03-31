import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ScanFindingConfidence,
  ScanFindingStatus,
  ScanRunStatus,
  ShopInstallationState,
} from "@prisma/client";
import {
  listRecentScanRunsForShop,
  listScanFindingsForReview,
  updateScanFindingStatuses,
  type ScanDatabaseClient,
} from "@categoryfix/db";
import {
  createReviewMutationResponse,
  createScanDashboardResponse,
  createScanReviewResponse,
  type ReviewLoaderDatabaseClient,
} from "../app/lib/scan-review.server.js";

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

function createExplanation(decision: string, basisCount = 1, blockers: string[] = []) {
  return {
    ruleKey: "phase4-test-rule",
    ruleVersion: "2026-03-31.phase4",
    decision,
    basis: Array.from({ length: basisCount }, (_, index) => ({
      source: index === 0 ? "title" : "tags",
      rawValue: index === 0 ? "Beanie" : "Warm",
      normalizedValue: index === 0 ? "beanie" : "warm",
      matchType: "TERM",
      matchedTerm: index === 0 ? "beanie" : "warm",
      taxonomyId: "aa-2-17",
      taxonomyGid: "gid://shopify/TaxonomyCategory/aa-2-17",
      taxonomyName: "Hats",
      taxonomyFullPath: "Apparel & Accessories > Clothing Accessories > Hats",
    })),
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

function createReviewDatabase() {
  const shops: MockShop[] = [
    {
      id: "shop_1",
      shop: "demo.myshopify.com",
      state: ShopInstallationState.INSTALLED,
      scopes: "read_products,write_products",
      appUrl: "https://app.categoryfix.com",
      offlineSessionId: "offline_demo",
      installedAt: new Date("2026-03-31T12:00:00.000Z"),
      uninstalledAt: null,
    },
  ];
  const scanRuns: MockScanRun[] = [
    {
      id: "scan_completed",
      shopId: "shop_1",
      status: ScanRunStatus.SUCCEEDED,
      trigger: "MANUAL",
      source: "phase3-deterministic-scan",
      externalOperationId: null,
      externalOperationStatus: "COMPLETED",
      taxonomyVersionId: "taxonomy_v1",
      scannedProductCount: 5,
      findingCount: 5,
      acceptedFindingCount: 1,
      rejectedFindingCount: 1,
      failureSummary: null,
      startedAt: new Date("2026-03-31T12:00:00.000Z"),
      completedAt: new Date("2026-03-31T12:05:00.000Z"),
      createdAt: new Date("2026-03-31T12:00:00.000Z"),
      updatedAt: new Date("2026-03-31T12:05:00.000Z"),
    },
    {
      id: "scan_running",
      shopId: "shop_1",
      status: ScanRunStatus.RUNNING,
      trigger: "MANUAL",
      source: "phase3-deterministic-scan",
      externalOperationId: "bulk_123",
      externalOperationStatus: "RUNNING",
      taxonomyVersionId: "taxonomy_v1",
      scannedProductCount: 0,
      findingCount: 0,
      acceptedFindingCount: 0,
      rejectedFindingCount: 0,
      failureSummary: null,
      startedAt: new Date("2026-03-31T13:00:00.000Z"),
      completedAt: null,
      createdAt: new Date("2026-03-31T13:00:00.000Z"),
      updatedAt: new Date("2026-03-31T13:00:00.000Z"),
    },
  ];
  const findings: MockFinding[] = [
    {
      id: "finding_1",
      shopId: "shop_1",
      scanRunId: "scan_completed",
      productId: "100",
      productGid: "gid://shopify/Product/100",
      productHandle: "wool-beanie",
      productTitle: "Wool Beanie",
      evidence: createEvidence("Wool Beanie"),
      explanation: createExplanation("EXACT", 2),
      currentCategoryId: null,
      recommendedCategoryId: "aa-2-17",
      confidence: ScanFindingConfidence.EXACT,
      status: ScanFindingStatus.OPEN,
      source: "phase3-deterministic-scan",
      createdAt: new Date("2026-03-31T12:05:00.000Z"),
    },
    {
      id: "finding_2",
      shopId: "shop_1",
      scanRunId: "scan_completed",
      productId: "101",
      productGid: "gid://shopify/Product/101",
      productHandle: "paperback-novel",
      productTitle: "Paperback Novel",
      evidence: createEvidence("Paperback Novel"),
      explanation: createExplanation("REVIEW_REQUIRED", 1),
      currentCategoryId: null,
      recommendedCategoryId: "me-1-3",
      confidence: ScanFindingConfidence.REVIEW_REQUIRED,
      status: ScanFindingStatus.OPEN,
      source: "phase3-deterministic-scan",
      createdAt: new Date("2026-03-31T12:05:00.000Z"),
    },
    {
      id: "finding_3",
      shopId: "shop_1",
      scanRunId: "scan_completed",
      productId: "102",
      productGid: "gid://shopify/Product/102",
      productHandle: "mystery-bundle",
      productTitle: "Mystery Bundle",
      evidence: createEvidence("Mystery Bundle"),
      explanation: createExplanation("NO_SAFE_SUGGESTION", 0, [
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
      id: "finding_4",
      shopId: "shop_1",
      scanRunId: "scan_completed",
      productId: "103",
      productGid: "gid://shopify/Product/103",
      productHandle: "sun-hat",
      productTitle: "Sun Hat",
      evidence: createEvidence("Sun Hat"),
      explanation: createExplanation("STRONG", 1),
      currentCategoryId: null,
      recommendedCategoryId: "aa-2-17",
      confidence: ScanFindingConfidence.STRONG,
      status: ScanFindingStatus.DISMISSED,
      source: "phase3-deterministic-scan",
      createdAt: new Date("2026-03-31T12:05:00.000Z"),
    },
    {
      id: "finding_5",
      shopId: "shop_1",
      scanRunId: "scan_completed",
      productId: "104",
      productGid: "gid://shopify/Product/104",
      productHandle: "cozy-cap",
      productTitle: "Cozy Cap",
      evidence: createEvidence("Cozy Cap"),
      explanation: createExplanation("STRONG", 1),
      currentCategoryId: null,
      recommendedCategoryId: "aa-2-17",
      confidence: ScanFindingConfidence.STRONG,
      status: ScanFindingStatus.ACCEPTED,
      source: "phase3-deterministic-scan",
      createdAt: new Date("2026-03-31T12:05:00.000Z"),
    },
  ];
  const categories = [
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
  ];

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

  const database = {
    shop: {
      async findUnique(args: any) {
        const record = shops.find((shop) => shop.shop === args.where.shop) ?? null;

        if (!record) {
          return null;
        }

        return record;
      },
    },
    scanRun: {
      async create() {
        throw new Error("not implemented in review tests");
      },
      async findFirst(args: any) {
        const matches = scanRuns
          .filter((scanRun) => scanRun.shopId === args.where?.shopId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

        return (matches[0] ?? null) as any;
      },
      async findMany(args: any) {
        return scanRuns
          .filter((scanRun) => scanRun.shopId === args.where?.shopId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take ?? scanRuns.length) as any;
      },
      async findUnique(args: any) {
        return (scanRuns.find((scanRun) => scanRun.id === args.where.id) ?? null) as any;
      },
      async update(args: any) {
        const record = scanRuns.find((scanRun) => scanRun.id === args.where.id);

        if (!record) {
          throw new Error("scan run not found");
        }

        Object.assign(record, args.data, { updatedAt: new Date("2026-03-31T14:00:00.000Z") });

        return record as any;
      },
    },
    scanFinding: {
      async count(args: any) {
        return findings.filter((finding) => matchesWhere(finding, args.where ?? {})).length;
      },
      async createMany() {
        throw new Error("not implemented in review tests");
      },
      async findMany(args: any) {
        const where = args.where ?? {};
        const ordered = findings
          .filter((finding) => matchesWhere(finding, where))
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
        const finding = findings.find((entry) => entry.id === args.where.id) ?? null;

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
        const matches = findings.filter((finding) => matchesWhere(finding, args.where ?? {}));

        for (const finding of matches) {
          Object.assign(finding, args.data);
        }

        return { count: matches.length };
      },
    },
    ruleDefinition: {
      async upsert() {
        throw new Error("not implemented in review tests");
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
        return categories.filter(
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

  return {
    database,
    scanRuns,
    findings,
  };
}

describe("phase 4 review flows", () => {
  let mock: ReturnType<typeof createReviewDatabase>;
  const authenticateAdmin = vi.fn(async () => ({
    session: { shop: "demo.myshopify.com" },
  }));

  beforeEach(() => {
    mock = createReviewDatabase();
  });

  it("lists recent scan history with confidence counts", async () => {
    const history = await listRecentScanRunsForShop(
      { shopId: "shop_1", limit: 10 },
      mock.database,
    );

    expect(history[0]?.id).toBe("scan_running");
    const completed = history.find((scan) => scan.id === "scan_completed");

    expect(completed?.confidenceCounts.exact).toBe(1);
    expect(completed?.confidenceCounts.strong).toBe(2);
    expect(completed?.confidenceCounts.reviewRequired).toBe(1);
    expect(completed?.confidenceCounts.noSafeSuggestion).toBe(1);
  });

  it("filters and paginates review findings while preserving preview counts", async () => {
    const page = await listScanFindingsForReview(
      {
        shopId: "shop_1",
        scanRunId: "scan_completed",
        filters: {
          status: "OPEN",
          query: "a",
          page: 1,
          pageSize: 2,
        },
      },
      mock.database,
    );

    expect(page?.items).toHaveLength(2);
    expect(page?.totalPages).toBe(1);
    expect(page?.previewCounts.readyToApply).toBe(1);
    expect(page?.previewCounts.safeDeterministicOpen).toBe(1);
    expect(
      page?.items.map((item) => item.recommendedCategory?.fullPath),
    ).toContain("Media > Books > Print Books");
  });

  it("bulk-accepts only safe deterministic open findings and recomputes counters", async () => {
    const result = await updateScanFindingStatuses(
      {
        shopId: "shop_1",
        scanRunId: "scan_completed",
        targetStatus: "ACCEPTED",
        safeDeterministicOnly: true,
      },
      mock.database,
    );

    expect(result?.updatedCount).toBe(1);
    expect(result?.previewCounts.readyToApply).toBe(2);
    expect(result?.previewCounts.reviewRequiredOpen).toBe(1);
    expect(result?.scanRun.acceptedFindingCount).toBe(2);
    expect(mock.findings.find((finding) => finding.id === "finding_1")?.status).toBe(
      ScanFindingStatus.ACCEPTED,
    );
    expect(mock.findings.find((finding) => finding.id === "finding_2")?.status).toBe(
      ScanFindingStatus.OPEN,
    );
  });

  it("loads the dashboard and scan review payloads", async () => {
    const dashboardResponse = await createScanDashboardResponse({
      request: new Request("https://app.categoryfix.com/app"),
      authenticateAdmin,
      database: mock.database,
    });
    const dashboardPayload = await dashboardResponse.json();

    expect(dashboardPayload.shop).toBe("demo.myshopify.com");
    expect(dashboardPayload.scanHistory).toHaveLength(2);
    expect(dashboardPayload.latestScan.scanRun.id).toBe("scan_running");

    const reviewResponse = await createScanReviewResponse({
      request: new Request(
        "https://app.categoryfix.com/app/scans/scan_completed?status=OPEN&findingId=finding_2",
      ),
      scanRunId: "scan_completed",
      authenticateAdmin,
      database: mock.database,
    });
    const reviewPayload = await reviewResponse.json();

    expect(reviewPayload.readOnly).toBe(false);
    expect(reviewPayload.selectedFinding?.id).toBe("finding_2");
    expect(reviewPayload.findingsPage.filters.status).toBe("OPEN");
  });

  it("rejects review mutations while a scan is still running", async () => {
    const response = await createReviewMutationResponse({
      request: new Request("https://app.categoryfix.com/app/scans/scan_running", {
        method: "POST",
        body: new URLSearchParams({
          intent: "accept_selected",
          findingId: "finding_1",
        }),
      }),
      scanRunId: "scan_running",
      authenticateAdmin,
      database: mock.database,
    });

    expect(response.status).toBe(409);
  });

  it("persists manual accept and dismiss actions through the route helper", async () => {
    const acceptResponse = await createReviewMutationResponse({
      request: new Request("https://app.categoryfix.com/app/scans/scan_completed", {
        method: "POST",
        body: new URLSearchParams({
          intent: "accept_selected",
          findingId: "finding_2",
        }),
      }),
      scanRunId: "scan_completed",
      authenticateAdmin,
      database: mock.database,
    });
    const acceptPayload = await acceptResponse.json();

    expect(acceptResponse.status).toBe(200);
    expect(acceptPayload.updatedCount).toBe(1);
    expect(mock.findings.find((finding) => finding.id === "finding_2")?.status).toBe(
      ScanFindingStatus.ACCEPTED,
    );

    const dismissResponse = await createReviewMutationResponse({
      request: new Request("https://app.categoryfix.com/app/scans/scan_completed", {
        method: "POST",
        body: new URLSearchParams({
          intent: "dismiss_selected",
          findingId: "finding_1",
        }),
      }),
      scanRunId: "scan_completed",
      authenticateAdmin,
      database: mock.database,
    });
    const dismissPayload = await dismissResponse.json();

    expect(dismissResponse.status).toBe(200);
    expect(dismissPayload.updatedCount).toBe(1);
    expect(mock.findings.find((finding) => finding.id === "finding_1")?.status).toBe(
      ScanFindingStatus.DISMISSED,
    );
  });
});
