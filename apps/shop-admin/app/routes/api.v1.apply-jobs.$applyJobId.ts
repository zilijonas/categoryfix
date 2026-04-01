import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createApplyJobStatusResponse } from "../lib/apply-jobs.server.js";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = withRouteErrorReporting(
  "api.v1.apply-jobs.$applyJobId",
  "loader",
  async ({ params, request }: LoaderFunctionArgs) => {
  const applyJobId = params.applyJobId;

  if (!applyJobId) {
    return Response.json({ error: "Apply job id is required." }, { status: 400 });
  }

  return createApplyJobStatusResponse({
    request,
    applyJobId,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });
  },
);
