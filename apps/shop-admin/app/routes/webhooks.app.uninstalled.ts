import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createAppUninstalledResponse } from "../lib/webhooks.server.js";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }: ActionFunctionArgs) => {
  return createAppUninstalledResponse({
    request,
    authenticateWebhook: authenticate.webhook,
    database: prisma,
  });
};
