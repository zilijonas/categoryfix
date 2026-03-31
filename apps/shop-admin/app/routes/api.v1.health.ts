import type { LoaderFunctionArgs } from "react-router";
import { prisma } from "../db.server.js";
import { createHealthResponse } from "../lib/health.server.js";
import { appConfig } from "../shopify.server.js";

export const loader = async (_args: LoaderFunctionArgs) => {
  return createHealthResponse({
    appConfig,
    database: prisma,
  });
};
