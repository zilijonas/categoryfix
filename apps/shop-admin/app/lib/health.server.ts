import type { DatabaseClient } from "@categoryfix/db";
import { checkDatabaseHealth } from "@categoryfix/db";
import type { CategoryFixShopifyConfig } from "@categoryfix/shopify-core";

export async function createHealthResponse(args: {
  appConfig: CategoryFixShopifyConfig;
  database: DatabaseClient;
}): Promise<Response> {
  try {
    await checkDatabaseHealth(args.database);

    return Response.json({
      status: "ok",
      app: {
        appUrl: args.appConfig.appUrl,
        scopes: args.appConfig.scopes,
        webhookApiVersion: args.appConfig.webhookApiVersion,
      },
      database: {
        status: "ok",
      },
    });
  } catch (error) {
    return Response.json(
      {
        status: "degraded",
        app: {
          appUrl: args.appConfig.appUrl,
          scopes: args.appConfig.scopes,
          webhookApiVersion: args.appConfig.webhookApiVersion,
        },
        database: {
          status: "error",
          message: error instanceof Error ? error.message : "Unknown database error",
        },
      },
      { status: 503 },
    );
  }
}
