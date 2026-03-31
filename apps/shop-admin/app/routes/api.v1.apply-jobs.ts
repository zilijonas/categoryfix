import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createApplyJobMutationResponse } from "../lib/apply-jobs.server.js";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }: ActionFunctionArgs) => {
  return createApplyJobMutationResponse({
    request,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });
};
