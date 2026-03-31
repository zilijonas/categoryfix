import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import {
  createLatestScanResponse,
  createStartScanResponse,
} from "../lib/scans.server.js";
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return createLatestScanResponse({
    request,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return createStartScanResponse({
    request,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });
};
