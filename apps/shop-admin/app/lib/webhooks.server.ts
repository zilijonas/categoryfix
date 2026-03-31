import type { DatabaseClient } from "@categoryfix/db";
import { markShopUninstalled } from "@categoryfix/db";
import {
  authenticateWebhookRequest,
  logStructuredEvent,
} from "@categoryfix/shopify-core";

export interface AuthenticatedWebhookContext {
  shop: string;
  topic: string;
  session?: {
    id: string;
  } | null | undefined;
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
