import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createRollbackJobMutationResponse } from "../lib/apply-jobs.server.js";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { authenticate } from "../shopify.server.js";

export const action = withRouteErrorReporting(
  "api.v1.rollback-jobs",
  "action",
  async ({ request }: ActionFunctionArgs) => {
  return createRollbackJobMutationResponse({
    request,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });
  },
);
