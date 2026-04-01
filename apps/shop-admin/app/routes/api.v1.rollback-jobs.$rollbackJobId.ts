import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createRollbackJobStatusResponse } from "../lib/apply-jobs.server.js";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = withRouteErrorReporting(
  "api.v1.rollback-jobs.$rollbackJobId",
  "loader",
  async ({ params, request }: LoaderFunctionArgs) => {
  const rollbackJobId = params.rollbackJobId;

  if (!rollbackJobId) {
    return Response.json({ error: "Rollback job id is required." }, { status: 400 });
  }

  return createRollbackJobStatusResponse({
    request,
    rollbackJobId,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });
  },
);
