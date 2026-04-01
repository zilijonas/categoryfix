import type { ActionFunctionArgs } from "react-router";
import { createComplianceWebhookResponse } from "../lib/webhooks.server.js";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { authenticate } from "../shopify.server.js";

export const action = withRouteErrorReporting(
  "webhooks.customers.redact",
  "action",
  async ({ request }: ActionFunctionArgs) => {
    return createComplianceWebhookResponse({
      request,
      authenticateWebhook: authenticate.webhook,
    });
  },
);
