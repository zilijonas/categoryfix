import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createProductWebhookResponse } from "../lib/webhooks.server.js";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { authenticate } from "../shopify.server.js";

export const action = withRouteErrorReporting(
  "webhooks.products.create",
  "action",
  async ({ request }: ActionFunctionArgs) => {
    return createProductWebhookResponse({
      request,
      authenticateWebhook: authenticate.webhook,
      database: prisma,
    });
  },
);
