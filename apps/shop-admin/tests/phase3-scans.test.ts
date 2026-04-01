import { beforeEach, describe, expect, it, vi } from "vitest";
import { PHASE3_RULE_DEFINITIONS } from "@categoryfix/domain";
const searchTaxonomyCategoriesMock = vi.hoisted(() => vi.fn());

vi.mock("@categoryfix/db", async () => {
  const actual = await vi.importActual<typeof import("@categoryfix/db")>("@categoryfix/db");

  return {
    ...actual,
    searchTaxonomyCategories: searchTaxonomyCategoriesMock,
  };
});

import {
  createScanRunResponse,
  createStartScanResponse,
  type Phase3DatabaseClient,
  type ShopifyAdminApi,
} from "../app/lib/scans.server.js";
import type { AssistiveAiService } from "../app/lib/ai-assist.server.js";
import type { OfflineAdminContext } from "../app/lib/offline-admin.server.js";
import { shopifyTaxonomyBootstrapSnapshot } from "../../../packages/taxonomy-data/src/snapshot.js";

interface MockShop {
  id: string;
  shop: string;
  offlineSessionId: string | null;
}

interface MockScanRun {
  id: string;
  shopId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  trigger: "MANUAL" | "INSTALL" | "WEBHOOK" | "SCHEDULED";
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
  scanRunId: string;
  productId: string;
  confidence: "EXACT" | "STRONG" | "REVIEW_REQUIRED" | "NO_SAFE_SUGGESTION";
  source: string;
  aiModel: string | null;
  aiPromptVersion: string | null;
  aiGeneratedAt: Date | null;
  aiSummary: string | null;
}

function normalizeTerm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function createMockDatabase() {
  const shops: MockShop[] = [
    {
      id: "shop_1",
      shop: "demo.myshopify.com",
      offlineSessionId: "offline_demo",
    },
  ];
  const scanRuns: MockScanRun[] = [];
  const scanFindings: MockFinding[] = [];
  const ruleDefinitions: Array<{ key: string; version: string }> = [];
  const taxonomyVersions = [
    {
      id: "taxonomy_version_1",
      version: shopifyTaxonomyBootstrapSnapshot.version,
      locale: shopifyTaxonomyBootstrapSnapshot.locale,
      source: shopifyTaxonomyBootstrapSnapshot.source,
      sourceUrl: shopifyTaxonomyBootstrapSnapshot.sourceUrl,
      releasedAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
      importedAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
      createdAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
      updatedAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
    },
  ];
  const taxonomyCategories = shopifyTaxonomyBootstrapSnapshot.categories.map((category) => ({
    taxonomyVersionId: "taxonomy_version_1",
    taxonomyId: category.taxonomyId,
    taxonomyGid: category.taxonomyGid,
    name: category.name,
    fullPath: category.fullPath,
    isLeaf: category.isLeaf,
  }));
  const taxonomyTerms = shopifyTaxonomyBootstrapSnapshot.categories.flatMap((category) => {
    const terms = [
      { term: category.name, normalizedTerm: normalizeTerm(category.name) },
      { term: category.fullPath, normalizedTerm: normalizeTerm(category.fullPath) },
      ...(category.terms ?? []).map((term) => ({
        term: term.term,
        normalizedTerm: normalizeTerm(term.term),
      })),
    ];

    return terms.map((term) => ({
      taxonomyVersionId: "taxonomy_version_1",
      taxonomyId: category.taxonomyId,
      term: term.term,
      normalizedTerm: term.normalizedTerm,
      kind: "TERM",
      category: {
        taxonomyId: category.taxonomyId,
        taxonomyGid: category.taxonomyGid,
        name: category.name,
        fullPath: category.fullPath,
        isLeaf: category.isLeaf,
      },
    }));
  });
  const manualOverrides: Array<{ shopId: string; productId: string; productGid: string; active: true }> = [
    {
      shopId: "shop_1",
      productId: "102",
      productGid: "gid://shopify/Product/102",
      active: true,
    },
  ];
  let scanSequence = 1;

  const database = {
    shop: {
      async findUnique(args: any) {
        const record = shops.find((shop) => shop.shop === args.where.shop) ?? null;

        if (!record) {
          return null;
        }

        return {
          id: record.id,
          shop: record.shop,
          offlineSessionId: record.offlineSessionId,
        };
      },
    },
    scanRun: {
      async create(args: any) {
        const now = new Date();
        const record: MockScanRun = {
          id: `scan_run_${scanSequence++}`,
          shopId: args.data.shopId,
          status: "PENDING",
          trigger: args.data.trigger,
          source: args.data.source,
          externalOperationId: null,
          externalOperationStatus: null,
          taxonomyVersionId: args.data.taxonomyVersionId ?? null,
          scannedProductCount: 0,
          findingCount: 0,
          acceptedFindingCount: 0,
          rejectedFindingCount: 0,
          failureSummary: null,
          startedAt: null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        scanRuns.push(record);

        return record as any;
      },
      async findFirst(args: any) {
        const matches = scanRuns
          .filter((scanRun) => scanRun.shopId === args.where?.shopId)
          .filter((scanRun) => {
            const statuses = args.where?.status?.in;

            return statuses ? statuses.includes(scanRun.status as any) : true;
          })
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

        return (matches[0] ?? null) as any;
      },
      async findUnique(args: any) {
        return (scanRuns.find((scanRun) => scanRun.id === args.where.id) ?? null) as any;
      },
      async update(args: any) {
        const record = scanRuns.find((scanRun) => scanRun.id === args.where.id);

        if (!record) {
          throw new Error("scan run not found");
        }

        Object.assign(record, args.data, { updatedAt: new Date() });

        return record as any;
      },
    },
    scanFinding: {
      async createMany(args: any) {
        let count = 0;

        for (const row of args.data) {
          const exists = scanFindings.some(
            (finding) =>
              finding.scanRunId === row.scanRunId && finding.productId === row.productId,
          );

          if (exists) {
            continue;
          }

          scanFindings.push({
            scanRunId: row.scanRunId,
            productId: row.productId,
            confidence: row.confidence as MockFinding["confidence"],
            source: row.source,
            aiModel: row.aiModel ?? null,
            aiPromptVersion: row.aiPromptVersion ?? null,
            aiGeneratedAt: row.aiGeneratedAt ? new Date(row.aiGeneratedAt) : null,
            aiSummary: row.aiSummary ?? null,
          });
          count += 1;
        }

        return { count };
      },
      async findMany(args: any) {
        return scanFindings
          .filter((finding) => finding.scanRunId === args.where?.scanRunId)
          .map((finding) => ({ confidence: finding.confidence }));
      },
    },
    ruleDefinition: {
      async upsert(args: any) {
        const existing = ruleDefinitions.find((definition) => definition.key === args.where.key);

        if (existing) {
          existing.version = args.update.version;
          return { ...existing, ...args.update } as any;
        }

        const created = {
          key: args.create.key,
          version: args.create.version,
        };
        ruleDefinitions.push(created);

        return { ...created, ...args.create } as any;
      },
    },
    taxonomyVersion: {
      async findFirst() {
        return taxonomyVersions[0] as any;
      },
      async findUnique(args: any) {
        return (
          taxonomyVersions.find((version) => version.id === args.where.id) ?? null
        ) as any;
      },
    },
    taxonomyCategory: {
      async findMany(args: any) {
        const taxonomyIdIn = args.where?.taxonomyId?.in;
        const taxonomyIdContains = args.where?.OR?.find((entry: any) => entry.taxonomyId)
          ?.taxonomyId?.contains;
        const nameContains = args.where?.OR?.find((entry: any) => entry.name)?.name?.contains;
        const fullPathContains = args.where?.OR?.find((entry: any) => entry.fullPath)
          ?.fullPath?.contains;

        return taxonomyCategories
          .filter((category) => category.taxonomyVersionId === args.where?.taxonomyVersionId)
          .filter((category) => (args.where?.isLeaf ? category.isLeaf === args.where.isLeaf : true))
          .filter((category) => (taxonomyIdIn ? taxonomyIdIn.includes(category.taxonomyId) : true))
          .filter((category) =>
            taxonomyIdContains
              ? category.taxonomyId
                  .toLowerCase()
                  .includes(String(taxonomyIdContains).toLowerCase())
              : true,
          )
          .filter((category) =>
            nameContains
              ? category.name.toLowerCase().includes(String(nameContains).toLowerCase())
              : true,
          )
          .filter((category) =>
            fullPathContains
              ? category.fullPath.toLowerCase().includes(String(fullPathContains).toLowerCase())
              : true,
          )
          .map((category) => ({
            taxonomyId: category.taxonomyId,
            taxonomyGid: category.taxonomyGid,
            name: category.name,
            fullPath: category.fullPath,
            isLeaf: category.isLeaf,
            taxonomyVersion: taxonomyVersions[0],
          }));
      },
    },
    taxonomyCategoryTerm: {
      async findMany(args: any) {
        return taxonomyTerms.filter(
          (term) =>
            term.taxonomyVersionId === args.where?.taxonomyVersionId &&
            (args.where?.category?.isLeaf === undefined
              ? true
              : term.category.isLeaf === args.where.category.isLeaf) &&
            (args.where?.normalizedTerm?.contains
              ? term.normalizedTerm.includes(args.where.normalizedTerm.contains)
              : true),
        ) as any;
      },
    },
    manualOverride: {
      async findMany(args: any) {
        const productIds =
          args.where.OR.find((entry: any) => "productId" in entry)?.productId.in ?? [];
        const productGids =
          args.where.OR.find((entry: any) => "productGid" in entry)?.productGid.in ?? [];

        return manualOverrides.filter(
          (override) =>
            override.shopId === args.where.shopId &&
            override.active &&
            (productIds.includes(override.productId) || productGids.includes(override.productGid)),
        );
      },
    },
    async $transaction(callback: any) {
      return callback(database as Phase3DatabaseClient);
    },
  } as unknown as Phase3DatabaseClient;

  return {
    database,
    scanRuns,
    scanFindings,
    ruleDefinitions,
  };
}

function createOfflineAdminContext(admin: ShopifyAdminApi): OfflineAdminContext {
  return {
    shopRecord: {
      id: "shop_1",
      shop: "demo.myshopify.com",
      offlineSessionId: "offline_demo",
    },
    session: {
      id: "offline_demo",
      shop: "demo.myshopify.com",
    },
    admin: admin as any,
  };
}

describe("phase 3 scan routes", () => {
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  beforeEach(() => {
    mockDatabase = createMockDatabase();
    searchTaxonomyCategoriesMock.mockReset();
    searchTaxonomyCategoriesMock.mockResolvedValue([]);
  });

  it("starts a scan, syncs rule definitions, and rejects duplicate active scans", async () => {
    const admin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            bulkOperationRunQuery: {
              bulkOperation: {
                id: "gid://shopify/BulkOperation/1",
                status: "CREATED",
              },
              userErrors: [],
            },
          },
        }),
      ),
    };
    const getOfflineAdminContext = vi.fn(async () => createOfflineAdminContext(admin));
    const authenticateAdmin = vi.fn(async () => ({
      session: { shop: "demo.myshopify.com" },
    }));

    const startResponse = await createStartScanResponse({
      request: new Request("https://app.categoryfix.com/api/v1/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: "MANUAL" }),
      }),
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext,
    });
    const startPayload = await startResponse.json();

    expect(startResponse.status).toBe(202);
    expect(startPayload.scanRun.status).toBe("RUNNING");
    expect(mockDatabase.ruleDefinitions).toHaveLength(PHASE3_RULE_DEFINITIONS.length);

    const duplicateResponse = await createStartScanResponse({
      request: new Request("https://app.categoryfix.com/api/v1/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: "MANUAL" }),
      }),
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext,
    });

    expect(duplicateResponse.status).toBe(409);
  });

  it("syncs a completed bulk operation into persisted findings", async () => {
    const startAdmin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            bulkOperationRunQuery: {
              bulkOperation: {
                id: "gid://shopify/BulkOperation/2",
                status: "CREATED",
              },
              userErrors: [],
            },
          },
        }),
      ),
    };
    const authenticateAdmin = vi.fn(async () => ({
      session: { shop: "demo.myshopify.com" },
    }));

    const startResponse = await createStartScanResponse({
      request: new Request("https://app.categoryfix.com/api/v1/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: "MANUAL" }),
      }),
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext: async () => createOfflineAdminContext(startAdmin),
    });
    const startPayload = await startResponse.json();

    const syncAdmin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            node: {
              id: "gid://shopify/BulkOperation/2",
              status: "COMPLETED",
              url: "https://example.com/bulk-results.ndjson",
              partialDataUrl: null,
              errorCode: null,
              objectCount: "3",
            },
          },
        }),
      ),
    };
    const ndjson = [
      JSON.stringify({
        id: "gid://shopify/Product/100",
        title: "Winter beanie",
        productType: "beanie",
        vendor: "Cozy Co",
        tags: ["beanie"],
      }),
      JSON.stringify({
        id: "gid://shopify/Product/101",
        title: "Classic novel",
        productType: "Media > Books > Print Books",
        vendor: "Reader Co",
        tags: [],
      }),
      JSON.stringify({
        id: "gid://shopify/Product/102",
        title: "Override beanie",
        productType: "beanie",
        vendor: "Override Co",
        tags: [],
      }),
    ].join("\n");

    const syncResponse = await createScanRunResponse({
      request: new Request(
        `https://app.categoryfix.com/api/v1/scans/${startPayload.scanRun.id}`,
      ),
      scanRunId: startPayload.scanRun.id,
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext: async () => createOfflineAdminContext(syncAdmin),
      fetchImpl: vi.fn(async () => new Response(ndjson, { status: 200 })),
    });
    const syncPayload = await syncResponse.json();

    expect(syncPayload.scanRun.status).toBe("SUCCEEDED");
    expect(syncPayload.scanRun.scannedProductCount).toBe(3);
    expect(syncPayload.scanRun.findingCount).toBe(3);
    expect(syncPayload.confidenceCounts.exact).toBe(1);
    expect(syncPayload.confidenceCounts.strong).toBe(1);
    expect(syncPayload.confidenceCounts.noSafeSuggestion).toBe(1);
    expect(mockDatabase.scanFindings).toHaveLength(3);
  });

  it("persists AI-assisted fallback findings when deterministic output is no-safe", async () => {
    const startAdmin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            bulkOperationRunQuery: {
              bulkOperation: {
                id: "gid://shopify/BulkOperation/phase7-success",
                status: "CREATED",
              },
              userErrors: [],
            },
          },
        }),
      ),
    };
    const authenticateAdmin = vi.fn(async () => ({
      session: { shop: "demo.myshopify.com" },
    }));

    const startResponse = await createStartScanResponse({
      request: new Request("https://app.categoryfix.com/api/v1/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: "MANUAL" }),
      }),
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext: async () => createOfflineAdminContext(startAdmin),
    });
    const startPayload = await startResponse.json();

    const syncAdmin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            node: {
              id: "gid://shopify/BulkOperation/phase7-success",
              status: "COMPLETED",
              url: "https://example.com/bulk-results-ai.ndjson",
              partialDataUrl: null,
              errorCode: null,
              objectCount: "1",
            },
          },
        }),
      ),
    };
    const assistiveAi: AssistiveAiService = {
      config: {
        enabled: true,
        apiKey: "test",
        model: "gpt-5.4-mini",
        promptVersion: "2026-04-01.phase7",
        timeoutMs: 5000,
      },
      suggestFallback: vi.fn(async ({ shortlist }) => ({
        provider: "openai" as const,
        model: "gpt-5.4-mini",
        promptVersion: "2026-04-01.phase7",
        recommendedCategory: shortlist[0]!,
        summary: "This looks closer to one of the shortlist categories.",
        generatedAt: "2026-04-01T09:00:00.000Z",
        inputFields: ["title"] as Array<"title">,
        shortlistCount: shortlist.length,
      })),
    };
    searchTaxonomyCategoriesMock.mockResolvedValue([
      {
        version: "2026-01",
        locale: "en",
        taxonomyId: "aa-2-17",
        taxonomyGid: "gid://shopify/TaxonomyCategory/aa-2-17",
        name: "Hats",
        fullPath: "Apparel & Accessories > Clothing Accessories > Hats",
        parentTaxonomyId: "aa-2",
        level: 3,
        isLeaf: true,
        matchedTerms: ["hats"],
      },
    ]);
    const ndjson = JSON.stringify({
      id: "gid://shopify/Product/200",
      title: "Print Books Bundle",
      productType: "Apparel & Accessories > Clothing Accessories > Hats",
      vendor: "Bundle Co",
      tags: [],
    });

    const syncResponse = await createScanRunResponse({
      request: new Request(
        `https://app.categoryfix.com/api/v1/scans/${startPayload.scanRun.id}`,
      ),
      scanRunId: startPayload.scanRun.id,
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext: async () => createOfflineAdminContext(syncAdmin),
      fetchImpl: vi.fn(async () => new Response(ndjson, { status: 200 })),
      assistiveAi,
    });
    const syncPayload = await syncResponse.json();

    expect(syncPayload.scanRun.status).toBe("SUCCEEDED");
    expect(syncPayload.confidenceCounts.reviewRequired).toBe(1);
    expect(syncPayload.confidenceCounts.noSafeSuggestion).toBe(0);
    expect(mockDatabase.scanFindings[0]?.source).toBe("phase7-ai-fallback");
    expect(mockDatabase.scanFindings[0]?.aiModel).toBe("gpt-5.4-mini");
    expect(mockDatabase.scanFindings[0]?.aiPromptVersion).toBe("2026-04-01.phase7");
    expect(mockDatabase.scanFindings[0]?.aiSummary).toMatch(/shortlist/i);
  });

  it("falls back to deterministic no-safe findings when AI assistance fails", async () => {
    const startAdmin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            bulkOperationRunQuery: {
              bulkOperation: {
                id: "gid://shopify/BulkOperation/phase7-failure",
                status: "CREATED",
              },
              userErrors: [],
            },
          },
        }),
      ),
    };
    const authenticateAdmin = vi.fn(async () => ({
      session: { shop: "demo.myshopify.com" },
    }));

    const startResponse = await createStartScanResponse({
      request: new Request("https://app.categoryfix.com/api/v1/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: "MANUAL" }),
      }),
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext: async () => createOfflineAdminContext(startAdmin),
    });
    const startPayload = await startResponse.json();

    const syncAdmin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            node: {
              id: "gid://shopify/BulkOperation/phase7-failure",
              status: "COMPLETED",
              url: "https://example.com/bulk-results-ai-failure.ndjson",
              partialDataUrl: null,
              errorCode: null,
              objectCount: "1",
            },
          },
        }),
      ),
    };
    const assistiveAi: AssistiveAiService = {
      config: {
        enabled: true,
        apiKey: "test",
        model: "gpt-5.4-mini",
        promptVersion: "2026-04-01.phase7",
        timeoutMs: 5000,
      },
      suggestFallback: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    };
    searchTaxonomyCategoriesMock.mockResolvedValue([
      {
        version: "2026-01",
        locale: "en",
        taxonomyId: "aa-2-17",
        taxonomyGid: "gid://shopify/TaxonomyCategory/aa-2-17",
        name: "Hats",
        fullPath: "Apparel & Accessories > Clothing Accessories > Hats",
        parentTaxonomyId: "aa-2",
        level: 3,
        isLeaf: true,
        matchedTerms: ["hats"],
      },
    ]);
    const ndjson = JSON.stringify({
      id: "gid://shopify/Product/201",
      title: "Print Books Bundle",
      productType: "Apparel & Accessories > Clothing Accessories > Hats",
      vendor: "Bundle Co",
      tags: [],
    });

    const syncResponse = await createScanRunResponse({
      request: new Request(
        `https://app.categoryfix.com/api/v1/scans/${startPayload.scanRun.id}`,
      ),
      scanRunId: startPayload.scanRun.id,
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext: async () => createOfflineAdminContext(syncAdmin),
      fetchImpl: vi.fn(async () => new Response(ndjson, { status: 200 })),
      assistiveAi,
    });
    const syncPayload = await syncResponse.json();

    expect(syncPayload.scanRun.status).toBe("SUCCEEDED");
    expect(syncPayload.confidenceCounts.noSafeSuggestion).toBe(1);
    expect(mockDatabase.scanFindings[0]?.source).toBe("phase3-deterministic-scan");
    expect(mockDatabase.scanFindings[0]?.aiModel).toBeNull();
  });

  it("marks scans failed when Shopify reports a failed bulk operation", async () => {
    const startAdmin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            bulkOperationRunQuery: {
              bulkOperation: {
                id: "gid://shopify/BulkOperation/3",
                status: "CREATED",
              },
              userErrors: [],
            },
          },
        }),
      ),
    };
    const authenticateAdmin = vi.fn(async () => ({
      session: { shop: "demo.myshopify.com" },
    }));

    const startResponse = await createStartScanResponse({
      request: new Request("https://app.categoryfix.com/api/v1/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: "MANUAL" }),
      }),
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext: async () => createOfflineAdminContext(startAdmin),
    });
    const startPayload = await startResponse.json();

    const failedAdmin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            node: {
              id: "gid://shopify/BulkOperation/3",
              status: "FAILED",
              url: null,
              partialDataUrl: null,
              errorCode: "ACCESS_DENIED",
              objectCount: "0",
            },
          },
        }),
      ),
    };

    const failedResponse = await createScanRunResponse({
      request: new Request(
        `https://app.categoryfix.com/api/v1/scans/${startPayload.scanRun.id}`,
      ),
      scanRunId: startPayload.scanRun.id,
      authenticateAdmin,
      database: mockDatabase.database,
      getOfflineAdminContext: async () => createOfflineAdminContext(failedAdmin),
    });
    const failedPayload = await failedResponse.json();

    expect(failedPayload.scanRun.status).toBe("FAILED");
    expect(failedPayload.scanRun.failureSummary).toMatch(/denied access/i);
  });
});
