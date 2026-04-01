import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createHealthResponse } from "../lib/health.server.js";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { appConfig } from "../shopify.server.js";

export const loader = withRouteErrorReporting(
  "api.v1.health",
  "loader",
  async (_args: LoaderFunctionArgs) => {
  return createHealthResponse({
    appConfig,
    database: prisma,
  });
  },
);
