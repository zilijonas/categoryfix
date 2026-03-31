import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createScanRunResponse } from "../lib/scans.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const scanRunId = params.scanRunId;

  if (!scanRunId) {
    return Response.json({ error: "Scan run id is required." }, { status: 400 });
  }

  return createScanRunResponse({
    request,
    scanRunId,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });
};
