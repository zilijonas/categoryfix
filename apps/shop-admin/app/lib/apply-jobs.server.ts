import { JobStatus } from "@prisma/client";
import {
  createApplyJobFromFindings,
  createRollbackJobFromApplyJob,
  finalizeApplyJob,
  finalizeRollbackJob,
  getApplyJobById,
  getRollbackJobById,
  listPendingApplyJobItems,
  listPendingRollbackJobItems,
  markApplyJobRunning,
  markRollbackJobRunning,
  recordApplyJobItemResult,
  recordRollbackJobItemResult,
  type ApplyJobsDatabaseClient,
  type ProductCategoryStateSnapshot,
} from "@categoryfix/db";
import { logStructuredEvent } from "@categoryfix/shopify-core";
import { z } from "zod";
import {
  resolveOfflineAdminContext,
  type OfflineAdminContext,
  type OfflineAdminDatabaseClient,
} from "./offline-admin.server.js";
import {
  mockReadLiveProductState,
  mockWriteProductCategory,
  getMockReviewDatabase,
} from "./scan-review.mock.server.js";

const APPLY_JOB_SOURCE = "phase5-apply-job";
const ROLLBACK_JOB_SOURCE = "phase5-rollback-job";
const APPLY_CONCURRENCY = 3;

const createApplyJobSchema = z.object({
  scanRunId: z.string().min(1),
  findingIds: z.array(z.string().min(1)).optional(),
  reason: z.string().trim().max(250).optional(),
});

const createRollbackJobSchema = z.object({
  applyJobId: z.string().min(1),
  reason: z.string().trim().max(250).optional(),
});

export interface AuthenticatedAdminContext {
  session: {
    shop: string;
  };
}

export type ApplyJobsRouteDatabaseClient = ApplyJobsDatabaseClient &
  OfflineAdminDatabaseClient & {
    shop: {
      findUnique(args: unknown): Promise<unknown>;
    };
  };

interface LiveProductState {
  productId: string;
  productGid: string;
  productTitle: string | null;
  category: {
    taxonomyId: string | null;
    taxonomyGid: string | null;
    name: string | null;
    fullPath: string | null;
  } | null;
}

interface ApplyExecutionDependencies {
  resolveOfflineContext: (shop: string) => Promise<OfflineAdminContext>;
  readLiveProductState: (
    admin: OfflineAdminContext["admin"],
    productGid: string,
  ) => Promise<LiveProductState>;
  writeProductCategory: (
    admin: OfflineAdminContext["admin"],
    productGid: string,
    categoryGid: string | null,
  ) => Promise<LiveProductState>;
}

function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

async function readJsonBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    return await request.json();
  } catch {
    return {};
  }
}

function compareCategoryStates(
  left: ProductCategoryStateSnapshot["category"] | null,
  right: ProductCategoryStateSnapshot["category"] | null,
) {
  const leftKey = left?.taxonomyGid ?? left?.taxonomyId ?? null;
  const rightKey = right?.taxonomyGid ?? right?.taxonomyId ?? null;

  return leftKey === rightKey;
}

function toProductCategoryStateSnapshot(state: LiveProductState): ProductCategoryStateSnapshot {
  return {
    productId: state.productId,
    productGid: state.productGid,
    productTitle: state.productTitle,
    category: state.category
      ? {
          taxonomyId: state.category.taxonomyId ?? null,
          taxonomyGid: state.category.taxonomyGid ?? null,
          name: state.category.name ?? null,
          fullPath: state.category.fullPath ?? null,
        }
      : null,
  };
}

async function requireShopRecord(shop: string, database: ApplyJobsRouteDatabaseClient) {
  return database.shop.findUnique({
    where: { shop },
    select: { id: true, shop: true },
  }) as Promise<{ id: string; shop: string } | null>;
}

async function readLiveProductState(
  admin: OfflineAdminContext["admin"],
  productGid: string,
): Promise<LiveProductState> {
  const response = await admin.graphql(
    `#graphql
      query CategoryFixProductCategory($id: ID!) {
        product(id: $id) {
          id
          title
          category {
            id
            name
            fullName
          }
        }
      }`,
    {
      variables: { id: productGid },
    },
  );
  const payload = (await response.json()) as {
    data?: {
      product?: {
        id?: string;
        title?: string | null;
        category?: {
          id?: string | null;
          name?: string | null;
          fullName?: string | null;
        } | null;
      } | null;
    };
    errors?: Array<{ message?: string }>;
  };

  const errorMessage = payload.errors?.find((error) => error.message)?.message;

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const product = payload.data?.product;

  if (!product?.id) {
    throw new Error("Shopify did not return the product.");
  }

  return {
    productId: product.id.split("/").pop() ?? product.id,
    productGid: product.id,
    productTitle: product.title ?? null,
    category: product.category
      ? {
          taxonomyId: product.category.id?.split("/").pop() ?? null,
          taxonomyGid: product.category.id ?? null,
          name: product.category.name ?? null,
          fullPath: product.category.fullName ?? null,
        }
      : null,
  };
}

async function writeProductCategory(
  admin: OfflineAdminContext["admin"],
  productGid: string,
  categoryGid: string | null,
): Promise<LiveProductState> {
  const response = await admin.graphql(
    `#graphql
      mutation CategoryFixProductSet($productId: ID!, $categoryId: ID) {
        productSet(
          synchronous: true
          input: {
            id: $productId
            category: $categoryId
          }
        ) {
          product {
            id
            title
            category {
              id
              name
              fullName
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        productId: productGid,
        categoryId: categoryGid,
      },
    },
  );
  const payload = (await response.json()) as {
    data?: {
      productSet?: {
        product?: {
          id?: string;
          title?: string | null;
          category?: {
            id?: string | null;
            name?: string | null;
            fullName?: string | null;
          } | null;
        } | null;
        userErrors?: Array<{ message?: string | null }> | null;
      } | null;
    };
    errors?: Array<{ message?: string }>;
  };

  const transportError = payload.errors?.find((error) => error.message)?.message;
  const userError = payload.data?.productSet?.userErrors?.find((error) => error.message)?.message;

  if (transportError || userError) {
    throw new Error(userError ?? transportError ?? "Shopify rejected the category update.");
  }

  const product = payload.data?.productSet?.product;

  if (!product?.id) {
    throw new Error("Shopify did not return the updated product.");
  }

  return {
    productId: product.id.split("/").pop() ?? product.id,
    productGid: product.id,
    productTitle: product.title ?? null,
    category: product.category
      ? {
          taxonomyId: product.category.id?.split("/").pop() ?? null,
          taxonomyGid: product.category.id ?? null,
          name: product.category.name ?? null,
          fullPath: product.category.fullName ?? null,
        }
      : null,
  };
}

async function runWithConcurrency<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  concurrency = APPLY_CONCURRENCY,
) {
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );
}

function resolveExecutionDependencies(
  database: ApplyJobsRouteDatabaseClient,
): ApplyExecutionDependencies {
  if (process.env.CATEGORYFIX_E2E_MOCK === "1") {
    return {
      resolveOfflineContext: async (shop: string) =>
        ({
          shopRecord: {
            id: "shop_1",
            shop,
            offlineSessionId: "offline_demo",
          },
          session: {
            id: "offline_demo",
            shop,
          },
          admin: {
            graphql: {} as never,
          },
        }) satisfies OfflineAdminContext,
      readLiveProductState: async (_admin, productGid) => mockReadLiveProductState(productGid),
      writeProductCategory: async (_admin, productGid, categoryGid) =>
        mockWriteProductCategory(productGid, categoryGid),
    };
  }

  return {
    resolveOfflineContext: async (shop: string) =>
      resolveOfflineAdminContext({ shop, database }),
    readLiveProductState,
    writeProductCategory,
  };
}

async function executeApplyJob(args: {
  shopId: string;
  shop: string;
  applyJobId: string;
  actor: string;
  requestId: string;
  database: ApplyJobsRouteDatabaseClient;
}) {
  const dependencies = resolveExecutionDependencies(args.database);
  const runningJob = await markApplyJobRunning(
    {
      shopId: args.shopId,
      applyJobId: args.applyJobId,
    },
    args.database,
  );

  if (!runningJob) {
    throw new Error("Apply job not found.");
  }

  const items = await listPendingApplyJobItems(
    {
      shopId: args.shopId,
      applyJobId: args.applyJobId,
    },
    args.database,
  );

  if (!items) {
    throw new Error("Apply job items could not be loaded.");
  }

  const offlineContext = await dependencies.resolveOfflineContext(args.shop);

  logStructuredEvent("categoryfix.apply_job.started", {
    requestId: args.requestId,
    shopId: args.shopId,
    applyJobId: args.applyJobId,
    itemCount: items.length,
  });

  await runWithConcurrency(items, async (item) => {
    try {
      const liveState = await dependencies.readLiveProductState(
        offlineContext.admin,
        item.productGid,
      );

      if (!compareCategoryStates(liveState.category, item.before.category)) {
        await recordApplyJobItemResult(
          {
            shopId: args.shopId,
            applyJobId: args.applyJobId,
            applyJobItemId: item.id,
            status: JobStatus.FAILED,
            errorMessage:
              "The product category changed in Shopify after review. Re-run the scan before applying this item.",
            actor: args.actor,
            source: APPLY_JOB_SOURCE,
          },
          args.database,
        );

        logStructuredEvent("categoryfix.apply_job.item_failed", {
          requestId: args.requestId,
          shopId: args.shopId,
          applyJobId: args.applyJobId,
          applyJobItemId: item.id,
          productId: item.productId,
          reason: "stale_product_category",
        });
        return;
      }

      const updatedState = await dependencies.writeProductCategory(
        offlineContext.admin,
        item.productGid,
        item.after.category?.taxonomyGid ?? null,
      );

      await recordApplyJobItemResult(
        {
          shopId: args.shopId,
          applyJobId: args.applyJobId,
          applyJobItemId: item.id,
          status: JobStatus.SUCCEEDED,
          afterSnapshot: toProductCategoryStateSnapshot(updatedState),
          actor: args.actor,
          source: APPLY_JOB_SOURCE,
        },
        args.database,
      );

      logStructuredEvent("categoryfix.apply_job.item_succeeded", {
        requestId: args.requestId,
        shopId: args.shopId,
        applyJobId: args.applyJobId,
        applyJobItemId: item.id,
        productId: item.productId,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "CategoryFix could not update this product category.";

      await recordApplyJobItemResult(
        {
          shopId: args.shopId,
          applyJobId: args.applyJobId,
          applyJobItemId: item.id,
          status: JobStatus.FAILED,
          errorMessage: message,
          actor: args.actor,
          source: APPLY_JOB_SOURCE,
        },
        args.database,
      );

      logStructuredEvent("categoryfix.apply_job.item_failed", {
        requestId: args.requestId,
        shopId: args.shopId,
        applyJobId: args.applyJobId,
        applyJobItemId: item.id,
        productId: item.productId,
        errorMessage: message,
      });
    }
  });

  const finalizedJob = await finalizeApplyJob(
    {
      shopId: args.shopId,
      applyJobId: args.applyJobId,
      actor: args.actor,
      source: APPLY_JOB_SOURCE,
    },
    args.database,
  );

  logStructuredEvent("categoryfix.apply_job.completed", {
    requestId: args.requestId,
    shopId: args.shopId,
    applyJobId: args.applyJobId,
    status: finalizedJob?.status ?? runningJob.status,
    appliedCount: finalizedJob?.appliedCount ?? 0,
    failedCount: finalizedJob?.failedCount ?? 0,
  });

  return finalizedJob;
}

async function executeRollbackJob(args: {
  shopId: string;
  shop: string;
  rollbackJobId: string;
  actor: string;
  requestId: string;
  database: ApplyJobsRouteDatabaseClient;
}) {
  const dependencies = resolveExecutionDependencies(args.database);
  const runningJob = await markRollbackJobRunning(
    {
      shopId: args.shopId,
      rollbackJobId: args.rollbackJobId,
    },
    args.database,
  );

  if (!runningJob) {
    throw new Error("Rollback job not found.");
  }

  const items = await listPendingRollbackJobItems(
    {
      shopId: args.shopId,
      rollbackJobId: args.rollbackJobId,
    },
    args.database,
  );

  if (!items) {
    throw new Error("Rollback job items could not be loaded.");
  }

  const offlineContext = await dependencies.resolveOfflineContext(args.shop);

  logStructuredEvent("categoryfix.rollback_job.started", {
    requestId: args.requestId,
    shopId: args.shopId,
    rollbackJobId: args.rollbackJobId,
    itemCount: items.length,
  });

  await runWithConcurrency(items, async (item) => {
    try {
      const liveState = await dependencies.readLiveProductState(
        offlineContext.admin,
        item.productGid,
      );

      if (!compareCategoryStates(liveState.category, item.before.category)) {
        await recordRollbackJobItemResult(
          {
            shopId: args.shopId,
            rollbackJobId: args.rollbackJobId,
            rollbackJobItemId: item.id,
            status: JobStatus.FAILED,
            errorMessage:
              "The product category changed again in Shopify, so this rollback item was skipped.",
            actor: args.actor,
            source: ROLLBACK_JOB_SOURCE,
          },
          args.database,
        );

        logStructuredEvent("categoryfix.rollback_job.item_failed", {
          requestId: args.requestId,
          shopId: args.shopId,
          rollbackJobId: args.rollbackJobId,
          rollbackJobItemId: item.id,
          productId: item.productId,
          reason: "stale_product_category",
        });
        return;
      }

      await dependencies.writeProductCategory(
        offlineContext.admin,
        item.productGid,
        item.after.category?.taxonomyGid ?? null,
      );

      await recordRollbackJobItemResult(
        {
          shopId: args.shopId,
          rollbackJobId: args.rollbackJobId,
          rollbackJobItemId: item.id,
          status: JobStatus.SUCCEEDED,
          actor: args.actor,
          source: ROLLBACK_JOB_SOURCE,
        },
        args.database,
      );

      logStructuredEvent("categoryfix.rollback_job.item_succeeded", {
        requestId: args.requestId,
        shopId: args.shopId,
        rollbackJobId: args.rollbackJobId,
        rollbackJobItemId: item.id,
        productId: item.productId,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "CategoryFix could not roll back this product category.";

      await recordRollbackJobItemResult(
        {
          shopId: args.shopId,
          rollbackJobId: args.rollbackJobId,
          rollbackJobItemId: item.id,
          status: JobStatus.FAILED,
          errorMessage: message,
          actor: args.actor,
          source: ROLLBACK_JOB_SOURCE,
        },
        args.database,
      );

      logStructuredEvent("categoryfix.rollback_job.item_failed", {
        requestId: args.requestId,
        shopId: args.shopId,
        rollbackJobId: args.rollbackJobId,
        rollbackJobItemId: item.id,
        productId: item.productId,
        errorMessage: message,
      });
    }
  });

  const finalizedJob = await finalizeRollbackJob(
    {
      shopId: args.shopId,
      rollbackJobId: args.rollbackJobId,
      actor: args.actor,
      source: ROLLBACK_JOB_SOURCE,
    },
    args.database,
  );

  logStructuredEvent("categoryfix.rollback_job.completed", {
    requestId: args.requestId,
    shopId: args.shopId,
    rollbackJobId: args.rollbackJobId,
    status: finalizedJob?.status ?? runningJob.status,
    rolledBackCount: finalizedJob?.rolledBackCount ?? 0,
    failedCount: finalizedJob?.failedCount ?? 0,
  });

  return finalizedJob;
}

export async function createApplyJobMutationResponse(args: {
  request: Request;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: ApplyJobsRouteDatabaseClient;
}): Promise<Response> {
  const database =
    process.env.CATEGORYFIX_E2E_MOCK === "1"
      ? (getMockReviewDatabase() as ApplyJobsRouteDatabaseClient)
      : args.database;
  const requestId = getRequestId(args.request);
  const { session } = await args.authenticateAdmin(args.request);
  const shopRecord = await requireShopRecord(session.shop, database);

  if (!shopRecord) {
    return Response.json({ error: "Shop installation not found." }, { status: 404 });
  }

  const parsed = createApplyJobSchema.safeParse(await readJsonBody(args.request));

  if (!parsed.success) {
    return Response.json({ error: "The apply job payload is invalid." }, { status: 400 });
  }

  const reason = parsed.data.reason?.trim() || "Merchant approved category changes.";
  const applyJob = await createApplyJobFromFindings(
    {
      shopId: shopRecord.id,
      scanRunId: parsed.data.scanRunId,
      ...(parsed.data.findingIds ? { findingIds: parsed.data.findingIds } : {}),
      source: APPLY_JOB_SOURCE,
      reason,
      actor: session.shop,
    },
    database,
  );

  if (!applyJob) {
    return Response.json(
      { error: "No accepted findings were eligible for apply." },
      { status: 409 },
    );
  }

  const finalizedJob = await executeApplyJob({
    shopId: shopRecord.id,
    shop: session.shop,
    applyJobId: applyJob.id,
    actor: session.shop,
    requestId,
    database,
  });

  return Response.json({ job: finalizedJob ?? applyJob, requestId });
}

export async function createApplyJobStatusResponse(args: {
  request: Request;
  applyJobId: string;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: ApplyJobsRouteDatabaseClient;
}): Promise<Response> {
  const database =
    process.env.CATEGORYFIX_E2E_MOCK === "1"
      ? (getMockReviewDatabase() as ApplyJobsRouteDatabaseClient)
      : args.database;
  const { session } = await args.authenticateAdmin(args.request);
  const shopRecord = await requireShopRecord(session.shop, database);

  if (!shopRecord) {
    return Response.json({ error: "Shop installation not found." }, { status: 404 });
  }

  const job = await getApplyJobById(
    {
      shopId: shopRecord.id,
      applyJobId: args.applyJobId,
    },
    database,
  );

  if (!job) {
    return Response.json({ error: "Apply job not found." }, { status: 404 });
  }

  return Response.json({ job });
}

export async function createRollbackJobMutationResponse(args: {
  request: Request;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: ApplyJobsRouteDatabaseClient;
}): Promise<Response> {
  const database =
    process.env.CATEGORYFIX_E2E_MOCK === "1"
      ? (getMockReviewDatabase() as ApplyJobsRouteDatabaseClient)
      : args.database;
  const requestId = getRequestId(args.request);
  const { session } = await args.authenticateAdmin(args.request);
  const shopRecord = await requireShopRecord(session.shop, database);

  if (!shopRecord) {
    return Response.json({ error: "Shop installation not found." }, { status: 404 });
  }

  const parsed = createRollbackJobSchema.safeParse(await readJsonBody(args.request));

  if (!parsed.success) {
    return Response.json({ error: "The rollback job payload is invalid." }, { status: 400 });
  }

  const reason = parsed.data.reason?.trim() || "Merchant requested a rollback.";
  const rollbackJob = await createRollbackJobFromApplyJob(
    {
      shopId: shopRecord.id,
      applyJobId: parsed.data.applyJobId,
      source: ROLLBACK_JOB_SOURCE,
      reason,
      actor: session.shop,
    },
    database,
  );

  if (!rollbackJob) {
    return Response.json(
      { error: "No applied items were eligible for rollback." },
      { status: 409 },
    );
  }

  const finalizedJob = await executeRollbackJob({
    shopId: shopRecord.id,
    shop: session.shop,
    rollbackJobId: rollbackJob.id,
    actor: session.shop,
    requestId,
    database,
  });

  return Response.json({ job: finalizedJob ?? rollbackJob, requestId });
}

export async function createRollbackJobStatusResponse(args: {
  request: Request;
  rollbackJobId: string;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: ApplyJobsRouteDatabaseClient;
}): Promise<Response> {
  const database =
    process.env.CATEGORYFIX_E2E_MOCK === "1"
      ? (getMockReviewDatabase() as ApplyJobsRouteDatabaseClient)
      : args.database;
  const { session } = await args.authenticateAdmin(args.request);
  const shopRecord = await requireShopRecord(session.shop, database);

  if (!shopRecord) {
    return Response.json({ error: "Shop installation not found." }, { status: 404 });
  }

  const job = await getRollbackJobById(
    {
      shopId: shopRecord.id,
      rollbackJobId: args.rollbackJobId,
    },
    database,
  );

  if (!job) {
    return Response.json({ error: "Rollback job not found." }, { status: 404 });
  }

  return Response.json({ job });
}
