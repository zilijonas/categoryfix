import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createShopSettingsResponse } from "../lib/shop-settings.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return createShopSettingsResponse({
    request,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });
};
