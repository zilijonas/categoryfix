import { beforeEach, describe, expect, it } from "vitest";
import {
  BackgroundJobKind,
  BackgroundJobStatus,
  RuleDefinitionState,
  ScanFindingStatus,
  ScanRunStatus,
  ShopInstallationState,
  TaxonomyCategoryTermKind,
  WebhookDeliveryStatus,
} from "@prisma/client";
import {
  claimNextBackgroundJob,
  createAutoScanSyncDedupeKey,
  getScanRunById,
  recordWebhookDeliveryAndScheduleAutoScan,
  type BackgroundJobsDatabaseClient,
  type ScanDatabaseClient,
} from "@categoryfix/db";
import { runBackgroundWorkerOnce } from "../app/lib/background-worker.server.js";
import { shopifyTaxonomyBootstrapSnapshot } from "../../../packages/taxonomy-data/src/snapshot.js";

function normalizeTerm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function createPhase6Database() {
  const shops = [
    {
      id: "shop_1",
      shop: "demo.myshopify.com",
      state: ShopInstallationState.INSTALLED,
      scopes: "read_products,write_products",
      appUrl: "https://app.categoryfix.com",
      offlineSessionId: "offline_demo",
      installedAt: new Date("2026-04-01T09:00:00.000Z"),
      uninstalledAt: null,
      createdAt: new Date("2026-04-01T09:00:00.000Z"),
      updatedAt: new Date("2026-04-01T09:00:00.000Z"),
    },
  ];
  const webhookDeliveries: any[] = [];
  const backgroundJobs: any[] = [];
  const scanRuns: any[] = [];
  const scanFindings: any[] = [];
  const ruleDefinitions: any[] = [];
  const taxonomyVersion = {
    id: "taxonomy_version_1",
    version: shopifyTaxonomyBootstrapSnapshot.version,
    locale: shopifyTaxonomyBootstrapSnapshot.locale,
    source: shopifyTaxonomyBootstrapSnapshot.source,
    sourceUrl: shopifyTaxonomyBootstrapSnapshot.sourceUrl,
    releasedAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
    importedAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
    createdAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
    updatedAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
  };
  const taxonomyCategories = shopifyTaxonomyBootstrapSnapshot.categories.map((category) => ({
    id: `category_${category.taxonomyId}`,
    taxonomyVersionId: taxonomyVersion.id,
    taxonomyId: category.taxonomyId,
    taxonomyGid: category.taxonomyGid,
    name: category.name,
    fullPath: category.fullPath,
    parentTaxonomyId: null,
    level: 1,
    isLeaf: category.isLeaf,
    createdAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
    updatedAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
  }));
  const taxonomyTerms = shopifyTaxonomyBootstrapSnapshot.categories.flatMap((category) => {
    const terms = [
      { kind: TaxonomyCategoryTermKind.PRIMARY_NAME, term: category.name },
      { kind: TaxonomyCategoryTermKind.PATH, term: category.fullPath },
      ...(category.terms ?? []).map((term) => ({
        kind: term.kind as TaxonomyCategoryTermKind,
        term: term.term,
      })),
    ];

    return terms.map((term, index) => ({
      id: `${category.taxonomyId}_${index}`,
      taxonomyVersionId: taxonomyVersion.id,
      taxonomyId: category.taxonomyId,
      kind: term.kind,
      term: term.term,
      normalizedTerm: normalizeTerm(term.term),
      createdAt: new Date(shopifyTaxonomyBootstrapSnapshot.releasedAt),
    }));
  });
  let webhookSequence = 1;
  let backgroundJobSequence = 1;
  let scanRunSequence = 1;

  const database: any = {
    shop: {
      async findUnique(args: any) {
        if (args.where?.shop) {
          const record = shops.find((shop) => shop.shop === args.where.shop) ?? null;

          if (!record) {
            return null;
          }

          if (args.select) {
            return Object.fromEntries(
              Object.keys(args.select).map((key) => [key, (record as any)[key]]),
            );
          }

          return record;
        }

        if (args.where?.id) {
          const record = shops.find((shop) => shop.id === args.where.id) ?? null;

          if (!record) {
            return null;
          }

          if (args.select) {
            return Object.fromEntries(
              Object.keys(args.select).map((key) => [key, (record as any)[key]]),
            );
          }

          return record;
        }

        return null;
      },
    },
    manualOverride: {
      async findMany() {
        return [];
      },
    },
    webhookDelivery: {
      async create(args: any) {
        const duplicate = webhookDeliveries.find(
          (delivery) =>
            delivery.shopId === args.data.shopId &&
            delivery.topic === args.data.topic &&
            delivery.webhookId === args.data.webhookId,
        );

        if (duplicate) {
          const error = new Error("duplicate delivery") as Error & { code?: string };
          error.code = "P2002";
          throw error;
        }

        const timestamp = new Date(`2026-04-01T10:00:${String(webhookSequence).padStart(2, "0")}.000Z`);
        const record = {
          id: `delivery_${webhookSequence++}`,
          shopId: args.data.shopId,
          topic: args.data.topic,
          webhookId: args.data.webhookId,
          productId: args.data.productId ?? null,
          productGid: args.data.productGid ?? null,
          productHandle: args.data.productHandle ?? null,
          productTitle: args.data.productTitle ?? null,
          status: args.data.status ?? WebhookDeliveryStatus.RECEIVED,
          failureSummary: args.data.failureSummary ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        webhookDeliveries.push(record);

        return record;
      },
      async findMany(args: any) {
        return webhookDeliveries
          .filter((delivery) => (args.where?.shopId ? delivery.shopId === args.where.shopId : true))
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take ?? webhookDeliveries.length);
      },
      async update(args: any) {
        const record = webhookDeliveries.find((delivery) => delivery.id === args.where.id);

        if (!record) {
          throw new Error("webhook delivery not found");
        }

        Object.assign(record, args.data, { updatedAt: new Date() });
        return record;
      },
    },
    backgroundJob: {
      async create(args: any) {
        const timestamp = new Date(`2026-04-01T10:10:${String(backgroundJobSequence).padStart(2, "0")}.000Z`);
        const record = {
          id: `job_${backgroundJobSequence++}`,
          shopId: args.data.shopId,
          kind: args.data.kind,
          status: args.data.status ?? BackgroundJobStatus.PENDING,
          dedupeKey: args.data.dedupeKey ?? null,
          payload: args.data.payload ?? null,
          attemptCount: args.data.attemptCount ?? 0,
          availableAt: args.data.availableAt ?? timestamp,
          lockedAt: args.data.lockedAt ?? null,
          leaseExpiresAt: args.data.leaseExpiresAt ?? null,
          workerId: args.data.workerId ?? null,
          lastError: args.data.lastError ?? null,
          startedAt: args.data.startedAt ?? null,
          completedAt: args.data.completedAt ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        backgroundJobs.push(record);

        return {
          ...record,
          shop: {
            shop: shops[0]!.shop,
          },
        };
      },
      async findFirst(args: any) {
        const where = args.where ?? {};
        const records = backgroundJobs
          .filter((job) => (where.shopId ? job.shopId === where.shopId : true))
          .filter((job) => {
            if (where.kind?.in) {
              return where.kind.in.includes(job.kind);
            }

            if (where.kind) {
              return job.kind === where.kind;
            }

            return true;
          })
          .filter((job) => {
            if (where.dedupeKey) {
              return job.dedupeKey === where.dedupeKey;
            }

            return true;
          })
          .filter((job) => {
            if (where.status?.in) {
              return where.status.in.includes(job.status);
            }

            if (typeof where.status === "string") {
              return job.status === where.status;
            }

            return true;
          })
          .filter((job) =>
            where.availableAt?.lte ? job.availableAt <= where.availableAt.lte : true,
          )
          .filter((job) => {
            if (!Array.isArray(where.OR) || !where.OR.length) {
              return true;
            }

            return where.OR.some((clause: any) => {
              if (clause.status?.in) {
                return clause.status.in.includes(job.status);
              }

              if (typeof clause.status === "string") {
                if (job.status !== clause.status) {
                  return false;
                }

                if (clause.leaseExpiresAt?.lte) {
                  return (job.leaseExpiresAt ?? new Date(0)) <= clause.leaseExpiresAt.lte;
                }

                return true;
              }

              return false;
            });
          })
          .sort((left, right) => {
            const leftAvailable = left.availableAt.getTime();
            const rightAvailable = right.availableAt.getTime();

            if (leftAvailable !== rightAvailable) {
              return leftAvailable - rightAvailable;
            }

            return left.createdAt.getTime() - right.createdAt.getTime();
          });
        const record = records[0];

        return record
          ? {
              ...record,
              shop: {
                shop: shops[0]!.shop,
              },
            }
          : null;
      },
      async findMany(args: any) {
        return backgroundJobs
          .filter((job) => (args.where?.shopId ? job.shopId === args.where.shopId : true))
          .filter((job) =>
            args.where?.kind?.in ? args.where.kind.in.includes(job.kind) : true,
          )
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take ?? backgroundJobs.length)
          .map((job) => ({
            ...job,
            shop: {
              shop: shops[0]!.shop,
            },
          }));
      },
      async findUnique(args: any) {
        const record = backgroundJobs.find((job) => job.id === args.where.id) ?? null;

        return record
          ? {
              ...record,
              shop: {
                shop: shops[0]!.shop,
              },
            }
          : null;
      },
      async update(args: any) {
        const record = backgroundJobs.find((job) => job.id === args.where.id);

        if (!record) {
          throw new Error("background job not found");
        }

        Object.assign(record, args.data, { updatedAt: new Date() });

        return {
          ...record,
          shop: {
            shop: shops[0]!.shop,
          },
        };
      },
      async updateMany(args: any) {
        const matches = backgroundJobs.filter((job) => {
          if (args.where?.id && job.id !== args.where.id) {
            return false;
          }

          if (args.where?.availableAt?.lte && job.availableAt > args.where.availableAt.lte) {
            return false;
          }

          if (!Array.isArray(args.where?.OR) || !args.where.OR.length) {
            return true;
          }

          return args.where.OR.some((clause: any) => {
            if (clause.status?.in) {
              return clause.status.in.includes(job.status);
            }

            if (typeof clause.status === "string") {
              if (job.status !== clause.status) {
                return false;
              }

              if (clause.leaseExpiresAt?.lte) {
                return (job.leaseExpiresAt ?? new Date(0)) <= clause.leaseExpiresAt.lte;
              }

              return true;
            }

            return false;
          });
        });

        for (const match of matches) {
          Object.assign(match, args.data, { updatedAt: new Date() });
        }

        return { count: matches.length };
      },
    },
    scanRun: {
      async create(args: any) {
        const timestamp = new Date(`2026-04-01T10:20:${String(scanRunSequence).padStart(2, "0")}.000Z`);
        const record = {
          id: `scan_run_${scanRunSequence++}`,
          shopId: args.data.shopId,
          status: ScanRunStatus.PENDING,
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
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        scanRuns.push(record);

        return record;
      },
      async findFirst(args: any) {
        const records = scanRuns
          .filter((scanRun) => (args.where?.shopId ? scanRun.shopId === args.where.shopId : true))
          .filter((scanRun) =>
            args.where?.status?.in ? args.where.status.in.includes(scanRun.status) : true,
          )
          .filter((scanRun) =>
            args.where?.trigger ? scanRun.trigger === args.where.trigger : true,
          )
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

        return records[0] ?? null;
      },
      async findMany(args: any) {
        return scanRuns
          .filter((scanRun) => (args.where?.shopId ? scanRun.shopId === args.where.shopId : true))
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take ?? scanRuns.length);
      },
      async findUnique(args: any) {
        return scanRuns.find((scanRun) => scanRun.id === args.where.id) ?? null;
      },
      async update(args: any) {
        const record = scanRuns.find((scanRun) => scanRun.id === args.where.id);

        if (!record) {
          throw new Error("scan run not found");
        }

        Object.assign(record, args.data, { updatedAt: new Date() });
        return record;
      },
    },
    scanFinding: {
      async count(args: any) {
        return scanFindings.filter((finding) => finding.scanRunId === args.where?.scanRunId).length;
      },
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
            ...row,
            id: `finding_${scanFindings.length + 1}`,
            createdAt: new Date(),
          });
          count += 1;
        }

        return { count };
      },
      async findMany(args: any) {
        if (args.select?.confidence) {
          return scanFindings
            .filter((finding) => finding.scanRunId === args.where?.scanRunId)
            .map((finding) => ({ confidence: finding.confidence }));
        }

        return scanFindings.filter((finding) => finding.scanRunId === args.where?.scanRunId);
      },
      async findUnique(args: any) {
        return scanFindings.find((finding) => finding.id === args.where.id) ?? null;
      },
      async updateMany() {
        return { count: 0 };
      },
    },
    ruleDefinition: {
      async upsert(args: any) {
        const existing = ruleDefinitions.find((definition) => definition.key === args.where.key);

        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }

        const created = {
          key: args.create.key,
          version: args.create.version,
          description: args.create.description,
          priority: args.create.priority,
          state: args.create.state ?? RuleDefinitionState.ACTIVE,
          configuration: args.create.configuration,
        };
        ruleDefinitions.push(created);

        return created;
      },
    },
    taxonomyVersion: {
      async findFirst() {
        return taxonomyVersion;
      },
      async findUnique(args: any) {
        return args.where?.id === taxonomyVersion.id ? taxonomyVersion : null;
      },
    },
    taxonomyCategory: {
      async findMany(args: any) {
        return taxonomyCategories
          .filter((category) =>
            args.where?.taxonomyVersionId ? category.taxonomyVersionId === args.where.taxonomyVersionId : true,
          )
          .filter((category) => (args.where?.isLeaf !== undefined ? category.isLeaf === args.where.isLeaf : true))
          .filter((category) =>
            args.where?.taxonomyId?.in ? args.where.taxonomyId.in.includes(category.taxonomyId) : true,
          )
          .sort((left, right) => left.taxonomyId.localeCompare(right.taxonomyId))
          .map((category) =>
            args.select
              ? Object.fromEntries(
                  Object.keys(args.select).map((key) => [key, (category as any)[key]]),
                )
              : category,
          );
      },
    },
    taxonomyCategoryTerm: {
      async findMany(args: any) {
        return taxonomyTerms
          .filter((term) => term.taxonomyVersionId === args.where?.taxonomyVersionId)
          .map((term) => ({
            ...term,
            category: taxonomyCategories.find(
              (category) =>
                category.taxonomyVersionId === term.taxonomyVersionId &&
                category.taxonomyId === term.taxonomyId,
            ),
          }))
          .filter((term) => term.category?.isLeaf);
      },
    },
    async $transaction(callback: any): Promise<any> {
      return callback(database);
    },
  } satisfies ScanDatabaseClient & BackgroundJobsDatabaseClient & { manualOverride: any };

  return {
    database,
    backgroundJobs,
    scanRuns,
    scanFindings,
    webhookDeliveries,
  };
}

describe("phase 6 worker-driven freshness", () => {
  let mock: ReturnType<typeof createPhase6Database>;
  let bulkOperationStatus: "RUNNING" | "COMPLETED";
  let fetchImpl: typeof fetch;

  beforeEach(() => {
    mock = createPhase6Database();
    bulkOperationStatus = "RUNNING";
    fetchImpl = async (input) => {
      const url = String(input);

      if (url.includes("bulk-results")) {
        return new Response(
          [
            JSON.stringify({
              id: "gid://shopify/Product/100",
              handle: "wool-beanie",
              title: "Wool Beanie",
              productType: "Hat",
              vendor: "CategoryFix",
              tags: ["warm"],
              category: null,
              collections: { edges: [] },
            }),
          ].join("\n"),
          {
            status: 200,
            headers: {
              "content-type": "application/x-ndjson",
            },
          },
        );
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    };
  });

  function createOfflineContext() {
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
      admin: {
        graphql: async (query: string) => {
          if (query.includes("bulkOperationRunQuery")) {
            return new Response(
              JSON.stringify({
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
            );
          }

          if (query.includes("BulkOperationStatus")) {
            return new Response(
              JSON.stringify({
                data: {
                  node: {
                    id: "gid://shopify/BulkOperation/1",
                    status: bulkOperationStatus,
                    url:
                      bulkOperationStatus === "COMPLETED"
                        ? "https://files.categoryfix.test/bulk-results.ndjson"
                        : null,
                    partialDataUrl: null,
                    errorCode: null,
                    objectCount: "1",
                  },
                },
              }),
            );
          }

          throw new Error(`Unexpected GraphQL query: ${query}`);
        },
      },
    };
  }

  it("coalesces webhook deliveries and claims one leased job", async () => {
    const first = await recordWebhookDeliveryAndScheduleAutoScan(
      {
        shopId: "shop_1",
        topic: "products/update",
        webhookId: "event_1",
        productId: "100",
      },
      mock.database,
    );
    const second = await recordWebhookDeliveryAndScheduleAutoScan(
      {
        shopId: "shop_1",
        topic: "products/update",
        webhookId: "event_2",
        productId: "101",
      },
      mock.database,
    );
    const duplicate = await recordWebhookDeliveryAndScheduleAutoScan(
      {
        shopId: "shop_1",
        topic: "products/update",
        webhookId: "event_2",
        productId: "101",
      },
      mock.database,
    );

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(mock.webhookDeliveries).toHaveLength(2);
    expect(mock.backgroundJobs).toHaveLength(1);

    mock.backgroundJobs[0]!.availableAt = new Date(0);
    const claimed = await claimNextBackgroundJob(
      {
        workerId: "worker-1",
      },
      mock.database,
    );
    const secondClaim = await claimNextBackgroundJob(
      {
        workerId: "worker-2",
      },
      mock.database,
    );

    expect(claimed?.status).toBe(BackgroundJobStatus.RUNNING);
    expect(secondClaim).toBeNull();
  });

  it("starts a webhook-triggered scan, requeues while running, and succeeds on completion", async () => {
    await recordWebhookDeliveryAndScheduleAutoScan(
      {
        shopId: "shop_1",
        topic: "products/update",
        webhookId: "event_start",
        productId: "100",
      },
      mock.database,
    );
    mock.backgroundJobs[0]!.availableAt = new Date(0);

    await runBackgroundWorkerOnce({
      database: mock.database as any,
      workerId: "worker-1",
      resolveOfflineContext: async () => createOfflineContext() as any,
      fetchImpl,
    });

    expect(mock.scanRuns).toHaveLength(1);
    expect(mock.scanRuns[0]?.trigger).toBe("WEBHOOK");
    expect(mock.scanRuns[0]?.status).toBe(ScanRunStatus.RUNNING);
    expect(mock.backgroundJobs.some((job) => job.kind === BackgroundJobKind.AUTO_SCAN_SYNC)).toBe(true);

    const syncJob = mock.backgroundJobs.find(
      (job) => job.kind === BackgroundJobKind.AUTO_SCAN_SYNC,
    )!;
    syncJob.availableAt = new Date(0);

    bulkOperationStatus = "RUNNING";
    await runBackgroundWorkerOnce({
      database: mock.database as any,
      workerId: "worker-1",
      resolveOfflineContext: async () => createOfflineContext() as any,
      fetchImpl,
    });

    expect(syncJob.status).toBe(BackgroundJobStatus.PENDING);

    syncJob.availableAt = new Date(0);
    bulkOperationStatus = "COMPLETED";
    await runBackgroundWorkerOnce({
      database: mock.database as any,
      workerId: "worker-1",
      resolveOfflineContext: async () => createOfflineContext() as any,
      fetchImpl,
    });

    const scanRun = await getScanRunById(
      {
        shopId: "shop_1",
        scanRunId: mock.scanRuns[0]!.id,
      },
      mock.database,
    );

    expect(scanRun?.status).toBe(ScanRunStatus.SUCCEEDED);
    expect(mock.scanFindings).toHaveLength(1);
    expect(syncJob.status).toBe(BackgroundJobStatus.SUCCEEDED);
    expect(mock.scanFindings[0]?.status).toBe(ScanFindingStatus.OPEN);
    expect(syncJob.dedupeKey).toBe(createAutoScanSyncDedupeKey(mock.scanRuns[0]!.id));
  });

  it("retries transient sync failures and dead-letters after exhaustion", async () => {
    mock.scanRuns.push({
      id: "scan_retry",
      shopId: "shop_1",
      status: ScanRunStatus.RUNNING,
      trigger: "WEBHOOK",
      source: "phase3-deterministic-scan",
      externalOperationId: "gid://shopify/BulkOperation/1",
      externalOperationStatus: "RUNNING",
      taxonomyVersionId: "taxonomy_version_1",
      scannedProductCount: 0,
      findingCount: 0,
      acceptedFindingCount: 0,
      rejectedFindingCount: 0,
      failureSummary: null,
      startedAt: new Date("2026-04-01T10:30:00.000Z"),
      completedAt: null,
      createdAt: new Date("2026-04-01T10:30:00.000Z"),
      updatedAt: new Date("2026-04-01T10:30:00.000Z"),
    });
    mock.backgroundJobs.push({
      id: "job_retry",
      shopId: "shop_1",
      kind: BackgroundJobKind.AUTO_SCAN_SYNC,
      status: BackgroundJobStatus.PENDING,
      dedupeKey: createAutoScanSyncDedupeKey("scan_retry"),
      payload: {
        scanRunId: "scan_retry",
      },
      attemptCount: 0,
      availableAt: new Date(0),
      lockedAt: null,
      leaseExpiresAt: null,
      workerId: null,
      lastError: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date("2026-04-01T10:30:00.000Z"),
      updatedAt: new Date("2026-04-01T10:30:00.000Z"),
    });

    bulkOperationStatus = "COMPLETED";
    const failingFetch: typeof fetch = async () => {
      throw new Error("temporary download failure");
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const job = mock.backgroundJobs.find((entry) => entry.id === "job_retry")!;
      job.availableAt = new Date(0);

      await runBackgroundWorkerOnce({
        database: mock.database as any,
        workerId: "worker-1",
        resolveOfflineContext: async () => createOfflineContext() as any,
        fetchImpl: failingFetch,
      });
    }

    const job = mock.backgroundJobs.find((entry) => entry.id === "job_retry")!;
    const scanRun = mock.scanRuns.find((entry) => entry.id === "scan_retry")!;

    expect(job.status).toBe(BackgroundJobStatus.DEAD_LETTER);
    expect(job.attemptCount).toBe(5);
    expect(job.lastError).toContain("temporary download failure");
    expect(scanRun.status).toBe(ScanRunStatus.FAILED);
  });
});
