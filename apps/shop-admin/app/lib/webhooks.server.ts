import type { BackgroundJobsDatabaseClient, DatabaseClient } from "@categoryfix/db";
import {
  markShopUninstalled,
  recordWebhookDeliveryAndScheduleAutoScan,
} from "@categoryfix/db";
import {
  authenticateWebhookRequest,
  logStructuredEvent,
} from "@categoryfix/shopify-core";

export interface AuthenticatedWebhookContext {
  shop: string;
  topic: string;
  payload?: Record<string, unknown> | null;
  session?: {
    id: string;
  } | null | undefined;
}

export type ProductWebhookDatabaseClient = BackgroundJobsDatabaseClient;

function readWebhookId(request: Request) {
  return (
    request.headers.get("x-shopify-event-id") ??
    request.headers.get("x-shopify-webhook-id")
  );
}

function extractProductWebhookMetadata(payload: Record<string, unknown> | null | undefined) {
  if (!payload) {
    return {
      productId: null,
      productGid: null,
      productHandle: null,
      productTitle: null,
    };
  }

  const numericId =
    typeof payload.id === "number"
      ? String(payload.id)
      : typeof payload.id === "string"
        ? payload.id
        : null;
  const productGid =
    typeof payload.admin_graphql_api_id === "string"
      ? payload.admin_graphql_api_id
      : numericId
        ? `gid://shopify/Product/${numericId}`
        : null;

  return {
    productId: numericId,
    productGid,
    productHandle: typeof payload.handle === "string" ? payload.handle : null,
    productTitle: typeof payload.title === "string" ? payload.title : null,
  };
}

export async function createAppUninstalledResponse(args: {
  request: Request;
  authenticateWebhook: (request: Request) => Promise<AuthenticatedWebhookContext>;
  database: DatabaseClient;
}): Promise<Response> {
  const authenticated = await authenticateWebhookRequest(
    args.request,
    args.authenticateWebhook,
  );

  if (authenticated instanceof Response) {
    return authenticated;
  }

  await markShopUninstalled({ shop: authenticated.shop }, args.database);

  logStructuredEvent("shopify.webhook.app_uninstalled", {
    shopId: authenticated.shop,
    topic: authenticated.topic,
    hadSession: Boolean(authenticated.session),
  });

  return new Response(null, { status: 200 });
}

export async function createComplianceWebhookResponse(args: {
  request: Request;
  authenticateWebhook: (request: Request) => Promise<AuthenticatedWebhookContext>;
}): Promise<Response> {
  const authenticated = await authenticateWebhookRequest(
    args.request,
    args.authenticateWebhook,
  );

  if (authenticated instanceof Response) {
    return authenticated;
  }

  logStructuredEvent("shopify.webhook.compliance", {
    shopId: authenticated.shop,
    topic: authenticated.topic,
  });

  return new Response(null, { status: 200 });
}

export async function createProductWebhookResponse(args: {
  request: Request;
  authenticateWebhook: (request: Request) => Promise<AuthenticatedWebhookContext>;
  database: ProductWebhookDatabaseClient;
}): Promise<Response> {
  const authenticated = await authenticateWebhookRequest(
    args.request,
    args.authenticateWebhook,
  );

  if (authenticated instanceof Response) {
    return authenticated;
  }

  const webhookId = readWebhookId(args.request);

  if (!webhookId) {
    logStructuredEvent("shopify.webhook.product_missing_id", {
      shopId: authenticated.shop,
      topic: authenticated.topic,
    });

    return new Response(null, { status: 400 });
  }

  const shopRecord = await args.database.shop.findUnique({
    where: { shop: authenticated.shop },
    select: { id: true, shop: true },
  }) as { id: string; shop: string } | null;

  if (!shopRecord) {
    logStructuredEvent("shopify.webhook.product_no_shop_record", {
      shopId: authenticated.shop,
      topic: authenticated.topic,
      webhookId,
    });

    return new Response(null, { status: 200 });
  }

  const metadata = extractProductWebhookMetadata(authenticated.payload);
  const result = await recordWebhookDeliveryAndScheduleAutoScan(
    {
      shopId: shopRecord.id,
      topic: authenticated.topic,
      webhookId,
      productId: metadata.productId,
      productGid: metadata.productGid,
      productHandle: metadata.productHandle,
      productTitle: metadata.productTitle,
    },
    args.database,
  );

  logStructuredEvent("shopify.webhook.product_received", {
    shopId: authenticated.shop,
    topic: authenticated.topic,
    webhookId,
    duplicate: result.duplicate,
    productId: metadata.productId,
    queuedJobId: result.job?.id ?? null,
  });

  return new Response(null, { status: 200 });
}
