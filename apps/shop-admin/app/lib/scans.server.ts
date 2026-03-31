import {
  createScanFindings,
  createScanRun,
  findActiveScanRunForShop,
  getLatestScanRunForShop,
  getLatestTaxonomyVersion,
  getScanRunById,
  loadTaxonomyReferenceSnapshot,
  markScanRunFailed,
  markScanRunRunning,
  markScanRunSucceeded,
  syncRuleDefinitions,
  type ScanConfidenceCounts,
  type ScanDatabaseClient,
  type ScanRunDetail,
} from "@categoryfix/db";
import {
  PHASE3_RULE_DEFINITIONS,
  evaluateDeterministicRecommendation,
  type DeterministicDecision,
  type DeterministicTaxonomyReference,
} from "@categoryfix/domain";
import {
  Prisma,
  ScanFindingConfidence,
  ScanRunStatus,
  ScanRunTrigger,
} from "@prisma/client";
import { z } from "zod";
import { resolveOfflineAdminContext, type OfflineAdminDatabaseClient } from "./offline-admin.server.js";

export const SCAN_SOURCE = "phase3-deterministic-scan";

const BULK_PRODUCTS_QUERY = `{
  products {
    edges {
      node {
        id
        handle
        title
        productType
        vendor
        tags
        category {
          id
          name
          fullName
        }
        collections(first: 25) {
          edges {
            node {
              id
              title
            }
          }
        }
      }
    }
  }
}`;

const startScanSchema = z.object({
  trigger: z.literal("MANUAL").default("MANUAL"),
});

export interface AuthenticatedAdminContext {
  session: {
    shop: string;
  };
}

export interface ManualOverrideLookupClient {
  manualOverride: {
    findMany(args: {
      where: {
        shopId: string;
        active: true;
        OR: Array<
          | { productId: { in: string[] } }
          | { productGid: { in: string[] } }
        >;
      };
      select: {
        productId: true;
        productGid: true;
      };
    }): Promise<Array<{ productId: string; productGid: string }>>;
  };
}

export type Phase3DatabaseClient = ScanDatabaseClient &
  OfflineAdminDatabaseClient &
  ManualOverrideLookupClient;

export interface ShopifyAdminApi {
  graphql(query: string, options?: { variables?: Record<string, unknown> }): Promise<Response>;
}

export interface BulkOperationSnapshot {
  id: string;
  status: string;
  url: string | null;
  partialDataUrl: string | null;
  errorCode: string | null;
  objectCount: string | null;
}

interface BulkProductLine {
  id?: string;
  __parentId?: string;
  handle?: string | null;
  title?: string;
  productType?: string | null;
  vendor?: string | null;
  tags?: string[];
  category?: {
    id?: string;
    name?: string | null;
    fullName?: string | null;
  } | null;
  collections?: {
    edges?: Array<{
      node?: {
        id?: string;
        title?: string;
      };
    }>;
  };
}

interface BulkCollectionLine {
  id?: string;
  __parentId?: string;
  title?: string;
}

interface NormalizedBulkProduct {
  productId: string;
  productGid: string;
  handle: string | null;
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
}

export interface SyncRunningScanResult {
  outcome: "RUNNING" | "SUCCEEDED" | "FAILED" | "RETRYABLE_ERROR";
  scanRun: ScanRunDetail;
  errorMessage: string | null;
}

function emptyConfidenceCounts(): ScanConfidenceCounts {
  return {
    exact: 0,
    strong: 0,
    reviewRequired: 0,
    noSafeSuggestion: 0,
  };
}

export function serializeScanPayload(scanRun: ScanRunDetail | null) {
  return {
    scanRun: scanRun
      ? {
          id: scanRun.id,
          status: scanRun.status,
          trigger: scanRun.trigger,
          source: scanRun.source,
          startedAt: scanRun.startedAt,
          completedAt: scanRun.completedAt,
          scannedProductCount: scanRun.scannedProductCount,
          findingCount: scanRun.findingCount,
          acceptedFindingCount: scanRun.acceptedFindingCount,
          rejectedFindingCount: scanRun.rejectedFindingCount,
          failureSummary: scanRun.failureSummary,
        }
      : null,
    confidenceCounts: scanRun?.confidenceCounts ?? emptyConfidenceCounts(),
  };
}

function decisionToConfidence(decision: DeterministicDecision): ScanFindingConfidence {
  switch (decision) {
    case "EXACT":
      return ScanFindingConfidence.EXACT;
    case "STRONG":
      return ScanFindingConfidence.STRONG;
    case "REVIEW_REQUIRED":
      return ScanFindingConfidence.REVIEW_REQUIRED;
    case "NO_SAFE_SUGGESTION":
    default:
      return ScanFindingConfidence.NO_SAFE_SUGGESTION;
  }
}

function toMerchantSafeFailure(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The scan could not complete. Please try again.";
}

function extractResourceId(gid: string) {
  const parts = gid.split("/");
  return parts[parts.length - 1] ?? gid;
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

export async function startBulkProductScan(admin: ShopifyAdminApi) {
  const response = await admin.graphql(
    `#graphql
      mutation RunDeterministicScan($query: String!) {
        bulkOperationRunQuery(query: $query) {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        query: BULK_PRODUCTS_QUERY,
      },
    },
  );

  const payload = (await response.json()) as {
    data?: {
      bulkOperationRunQuery?: {
        bulkOperation?: { id?: string; status?: string | null } | null;
        userErrors?: Array<{ message?: string | null }> | null;
      } | null;
    };
  };

  const result = payload.data?.bulkOperationRunQuery;
  const errorMessage = result?.userErrors?.find((error) => error.message)?.message;

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const operationId = result?.bulkOperation?.id;

  if (!operationId) {
    throw new Error("Shopify did not return a bulk operation id.");
  }

  return {
    id: operationId,
    status: result?.bulkOperation?.status ?? "CREATED",
  };
}

async function getBulkOperationSnapshot(admin: ShopifyAdminApi, operationId: string) {
  const response = await admin.graphql(
    `#graphql
      query BulkOperationStatus($id: ID!) {
        node(id: $id) {
          ... on BulkOperation {
            id
            status
            url
            partialDataUrl
            errorCode
            objectCount
          }
        }
      }`,
    {
      variables: { id: operationId },
    },
  );

  const payload = (await response.json()) as {
    data?: {
      node?: BulkOperationSnapshot | null;
    };
  };

  return payload.data?.node ?? null;
}

async function* streamNdjson(response: Response) {
  if (!response.body) {
    const text = await response.text();

    for (const line of text.split("\n")) {
      const trimmed = line.trim();

      if (trimmed) {
        yield trimmed;
      }
    }

    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed) {
        yield trimmed;
      }
    }
  }

  buffer += decoder.decode();

  const trailing = buffer.trim();

  if (trailing) {
    yield trailing;
  }
}

async function loadBulkProducts(
  url: string,
  fetchImpl: typeof fetch,
): Promise<NormalizedBulkProduct[]> {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Bulk result download failed with status ${response.status}.`);
  }

  const products = new Map<string, NormalizedBulkProduct>();

  for await (const line of streamNdjson(response)) {
    const parsed = JSON.parse(line) as BulkProductLine | BulkCollectionLine;

    if (parsed.__parentId && parsed.title) {
      const parent = products.get(parsed.__parentId);

      if (parent) {
        parent.collections.push(parsed.title);
      }

      continue;
    }

    if (!parsed.id || !("title" in parsed) || !parsed.title) {
      continue;
    }

    const lineRecord = parsed as BulkProductLine;
    const productGid = parsed.id;
    const productTitle = parsed.title;
    const existing = products.get(productGid);
    const collections =
      lineRecord.collections?.edges
        ?.flatMap((edge) => (edge.node?.title ? [edge.node.title] : [])) ?? [];

    products.set(productGid, {
      productId: extractResourceId(productGid),
      productGid,
      handle: lineRecord.handle ?? existing?.handle ?? null,
      title: productTitle,
      productType: lineRecord.productType ?? null,
      vendor: lineRecord.vendor ?? null,
      tags: lineRecord.tags ?? [],
      collections: [...(existing?.collections ?? []), ...collections],
      currentCategory: lineRecord.category?.id
        ? {
            taxonomyId: extractResourceId(lineRecord.category.id),
            taxonomyGid: lineRecord.category.id,
            name: lineRecord.category.name ?? null,
            fullPath: lineRecord.category.fullName ?? null,
          }
        : null,
    });
  }

  return [...products.values()].map((product) => ({
    ...product,
    tags: [...new Set(product.tags)],
    collections: [...new Set(product.collections)],
  }));
}

async function findManualOverrideProductIds(
  args: {
    shopId: string;
    products: readonly NormalizedBulkProduct[];
    database: Phase3DatabaseClient;
  },
) {
  if (!args.products.length) {
    return new Set<string>();
  }

  const overrides = await args.database.manualOverride.findMany({
    where: {
      shopId: args.shopId,
      active: true,
      OR: [
        {
          productId: {
            in: args.products.map((product) => product.productId),
          },
        },
        {
          productGid: {
            in: args.products.map((product) => product.productGid),
          },
        },
      ],
    },
    select: {
      productId: true,
      productGid: true,
    },
  });

  return new Set<string>(
    overrides.flatMap((override) => [override.productId, override.productGid]),
  );
}

async function ingestBulkResults(args: {
  scanRun: ScanRunDetail;
  taxonomy: DeterministicTaxonomyReference;
  products: readonly NormalizedBulkProduct[];
  database: Phase3DatabaseClient;
}) {
  let createdCount = 0;
  const batchSize = 100;

  for (let start = 0; start < args.products.length; start += batchSize) {
    const batch = args.products.slice(start, start + batchSize);
    const manualOverrideIds = await findManualOverrideProductIds({
      shopId: args.scanRun.shopId,
      products: batch,
      database: args.database,
    });

    const findings = batch.map((product) => {
      const recommendation = evaluateDeterministicRecommendation({
        product: {
          productId: product.productId,
          productGid: product.productGid,
          handle: product.handle,
          title: product.title,
          productType: product.productType,
          vendor: product.vendor,
          tags: product.tags,
          collections: product.collections,
          currentCategory: product.currentCategory,
        },
        taxonomy: args.taxonomy,
        hasActiveManualOverride:
          manualOverrideIds.has(product.productId) || manualOverrideIds.has(product.productGid),
      });

      return {
        shopId: args.scanRun.shopId,
        scanRunId: args.scanRun.id,
        productId: product.productId,
        productGid: product.productGid,
        productHandle: product.handle,
        productTitle: product.title,
        evidence: recommendation.evidence as unknown as Prisma.InputJsonValue,
        explanation: recommendation.explanation as unknown as Prisma.InputJsonValue,
        currentCategoryId: product.currentCategory?.taxonomyId ?? null,
        currentCategoryGid: product.currentCategory?.taxonomyGid ?? null,
        recommendedCategoryId: recommendation.recommendedCategory?.taxonomyId ?? null,
        recommendedCategoryGid: recommendation.recommendedCategory?.taxonomyGid ?? null,
        confidence: decisionToConfidence(recommendation.decision),
        source: SCAN_SOURCE,
      };
    });

    createdCount += await createScanFindings({ findings }, args.database);
  }

  return createdCount;
}

export async function startDeterministicScanRun(args: {
  shop: string;
  trigger: ScanRunTrigger;
  database: Phase3DatabaseClient;
  getOfflineAdminContext?: typeof resolveOfflineAdminContext;
}): Promise<ScanRunDetail> {
  const resolveContext = args.getOfflineAdminContext ?? resolveOfflineAdminContext;
  const offlineAdmin = await resolveContext({
    shop: args.shop,
    database: args.database,
  });
  const taxonomyVersion = await getLatestTaxonomyVersion("en", args.database);

  if (!taxonomyVersion) {
    throw new Error("No taxonomy snapshot is available for scanning.");
  }

  await syncRuleDefinitions(
    {
      definitions: PHASE3_RULE_DEFINITIONS.map((definition) => ({
        key: definition.key,
        version: definition.version,
        description: definition.description,
        priority: definition.priority,
        configuration: definition.configuration,
      })),
    },
    args.database,
  );

  const scanRun = await createScanRun(
    {
      shopId: offlineAdmin.shopRecord.id,
      trigger: args.trigger,
      source: SCAN_SOURCE,
      taxonomyVersionId: taxonomyVersion.id,
    },
    args.database,
  );
  const operation = await startBulkProductScan(offlineAdmin.admin);

  return markScanRunRunning(
    {
      scanRunId: scanRun.id,
      externalOperationId: operation.id,
      externalOperationStatus: operation.status,
    },
    args.database,
  );
}

export async function syncRunningScan(args: {
  scanRun: ScanRunDetail;
  shop: string;
  database: Phase3DatabaseClient;
  getOfflineAdminContext?: typeof resolveOfflineAdminContext;
  fetchImpl?: typeof fetch;
}): Promise<SyncRunningScanResult> {
  if (
    args.scanRun.status !== ScanRunStatus.PENDING &&
    args.scanRun.status !== ScanRunStatus.RUNNING
  ) {
    return {
      outcome: args.scanRun.status === ScanRunStatus.SUCCEEDED ? "SUCCEEDED" : "FAILED",
      scanRun: args.scanRun,
      errorMessage: args.scanRun.failureSummary ?? null,
    };
  }

  if (!args.scanRun.externalOperationId) {
    const scanRun = await markScanRunFailed(
      {
        scanRunId: args.scanRun.id,
        failureSummary: "The scan could not find its Shopify bulk operation.",
      },
      args.database,
    );

    return {
      outcome: "FAILED",
      scanRun,
      errorMessage: scanRun.failureSummary ?? null,
    };
  }

  const resolveContext = args.getOfflineAdminContext ?? resolveOfflineAdminContext;
  const fetchImpl = args.fetchImpl ?? fetch;

  try {
    const offlineAdmin = await resolveContext({
      shop: args.shop,
      database: args.database,
    });
    const operation = await getBulkOperationSnapshot(
      offlineAdmin.admin,
      args.scanRun.externalOperationId,
    );

    if (!operation) {
      const scanRun = await markScanRunFailed(
        {
          scanRunId: args.scanRun.id,
          failureSummary: "Shopify could not find the requested bulk operation.",
        },
        args.database,
      );

      return {
        outcome: "FAILED",
        scanRun,
        errorMessage: scanRun.failureSummary ?? null,
      };
    }

    if (operation.status === "CREATED" || operation.status === "RUNNING") {
      return {
        outcome: "RUNNING",
        scanRun: {
          ...args.scanRun,
          externalOperationStatus: operation.status,
        },
        errorMessage: null,
      };
    }

    if (operation.status === "COMPLETED") {
      const downloadUrl = operation.url ?? operation.partialDataUrl;

      if (!downloadUrl) {
        const scanRun = await markScanRunFailed(
          {
            scanRunId: args.scanRun.id,
            failureSummary: "The scan finished but Shopify did not provide a result file.",
          },
          args.database,
        );

        return {
          outcome: "FAILED",
          scanRun,
          errorMessage: scanRun.failureSummary ?? null,
        };
      }

      const taxonomySnapshot = args.scanRun.taxonomyVersionId
        ? await loadTaxonomyReferenceSnapshot(args.scanRun.taxonomyVersionId, args.database)
        : null;

      if (!taxonomySnapshot) {
        const scanRun = await markScanRunFailed(
          {
            scanRunId: args.scanRun.id,
            failureSummary: "The scan could not load its taxonomy snapshot.",
          },
          args.database,
        );

        return {
          outcome: "FAILED",
          scanRun,
          errorMessage: scanRun.failureSummary ?? null,
        };
      }

      try {
        const products = await loadBulkProducts(downloadUrl, fetchImpl);

        await ingestBulkResults({
          scanRun: args.scanRun,
          taxonomy: {
            categories: taxonomySnapshot.categories,
            terms: taxonomySnapshot.terms,
          },
          products,
          database: args.database,
        });

        const scanRun = await markScanRunSucceeded(
          {
            scanRunId: args.scanRun.id,
            scannedProductCount: products.length,
            findingCount: products.length,
            externalOperationStatus: operation.status,
          },
          args.database,
        );

        return {
          outcome: "SUCCEEDED",
          scanRun,
          errorMessage: null,
        };
      } catch (error) {
        return {
          outcome: "RETRYABLE_ERROR",
          scanRun: args.scanRun,
          errorMessage: toMerchantSafeFailure(error),
        };
      }
    }

    const scanRun = await markScanRunFailed(
      {
        scanRunId: args.scanRun.id,
        failureSummary:
          operation.errorCode === "ACCESS_DENIED"
            ? "Shopify denied access while reading catalog data."
            : "Shopify could not complete the catalog scan.",
        externalOperationStatus: operation.status,
      },
      args.database,
    );

    return {
      outcome: "FAILED",
      scanRun,
      errorMessage: scanRun.failureSummary ?? null,
    };
  } catch (error) {
    return {
      outcome: "RETRYABLE_ERROR",
      scanRun: args.scanRun,
      errorMessage: toMerchantSafeFailure(error),
    };
  }
}

export async function createLatestScanResponse(args: {
  request: Request;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: Phase3DatabaseClient;
}): Promise<Response> {
  const { session } = await args.authenticateAdmin(args.request);
  const context = await resolveOfflineAdminContext({
    shop: session.shop,
    database: args.database,
  }).catch(() => null);

  const shopId = context?.shopRecord.id;

  if (!shopId) {
    return Response.json(serializeScanPayload(null));
  }

  const latestScanRun = await getLatestScanRunForShop(shopId, args.database);

  return Response.json(serializeScanPayload(latestScanRun));
}

export async function createStartScanResponse(args: {
  request: Request;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: Phase3DatabaseClient;
  getOfflineAdminContext?: typeof resolveOfflineAdminContext;
}): Promise<Response> {
  const { session } = await args.authenticateAdmin(args.request);
  const body = await readJsonBody(args.request);
  const parsed = startScanSchema.parse(body);
  const resolveContext = args.getOfflineAdminContext ?? resolveOfflineAdminContext;
  const offlineAdmin = await resolveContext({
    shop: session.shop,
    database: args.database,
  });
  const activeScanRun = await findActiveScanRunForShop(offlineAdmin.shopRecord.id, args.database);

  if (activeScanRun) {
    return Response.json(serializeScanPayload(activeScanRun), { status: 409 });
  }

  try {
    const runningScanRun = await startDeterministicScanRun({
      shop: session.shop,
      trigger: parsed.trigger as ScanRunTrigger,
      database: args.database,
      ...(args.getOfflineAdminContext
        ? { getOfflineAdminContext: args.getOfflineAdminContext }
        : {}),
    });

    return Response.json(serializeScanPayload(runningScanRun), { status: 202 });
  } catch (error) {
    const message = toMerchantSafeFailure(error);
    const status = message.includes("No taxonomy snapshot") ? 503 : 500;

    return Response.json({ error: message }, { status });
  }
}

export async function createScanRunResponse(args: {
  request: Request;
  scanRunId: string;
  authenticateAdmin: (request: Request) => Promise<AuthenticatedAdminContext>;
  database: Phase3DatabaseClient;
  getOfflineAdminContext?: typeof resolveOfflineAdminContext;
  fetchImpl?: typeof fetch;
}): Promise<Response> {
  const { session } = await args.authenticateAdmin(args.request);
  const resolveContext = args.getOfflineAdminContext ?? resolveOfflineAdminContext;
  const offlineAdmin = await resolveContext({
    shop: session.shop,
    database: args.database,
  });
  const scanRun = await getScanRunById(
    {
      shopId: offlineAdmin.shopRecord.id,
      scanRunId: args.scanRunId,
    },
    args.database,
  );

  if (!scanRun) {
    return Response.json({ error: "Scan run not found." }, { status: 404 });
  }

  const syncedRun = await syncRunningScan({
    scanRun,
    shop: session.shop,
    database: args.database,
    ...(args.getOfflineAdminContext
      ? { getOfflineAdminContext: args.getOfflineAdminContext }
      : {}),
    ...(args.fetchImpl ? { fetchImpl: args.fetchImpl } : {}),
  });

  if (syncedRun.outcome === "RETRYABLE_ERROR") {
    const failedRun = await markScanRunFailed(
      {
        scanRunId: scanRun.id,
        failureSummary: syncedRun.errorMessage ?? "The scan could not complete. Please try again.",
      },
      args.database,
    );

    return Response.json(serializeScanPayload(failedRun));
  }

  return Response.json(serializeScanPayload(syncedRun.scanRun));
}
