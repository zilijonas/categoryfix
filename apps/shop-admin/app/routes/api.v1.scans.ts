import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import {
  createLatestScanResponse,
  createStartScanResponse,
} from "../lib/scans.server.js";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = withRouteErrorReporting(
  "api.v1.scans",
  "loader",
  async ({ request }: LoaderFunctionArgs) => {
    return createLatestScanResponse({
      request,
      authenticateAdmin: authenticate.admin,
      database: prisma,
    });
  },
);

export const action = withRouteErrorReporting(
  "api.v1.scans",
  "action",
  async ({ request }: ActionFunctionArgs) => {
    return createStartScanResponse({
      request,
      authenticateAdmin: authenticate.admin,
      database: prisma,
    });
  },
);
