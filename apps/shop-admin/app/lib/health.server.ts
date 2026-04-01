import type { DatabaseClient } from "@categoryfix/db";
import { checkDatabaseHealth } from "@categoryfix/db";
import {
  logStructuredError,
  type CategoryFixShopifyConfig,
} from "@categoryfix/shopify-core";

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
        deploymentTargets: args.appConfig.deploymentTargets,
        scopes: args.appConfig.scopes,
        webhookApiVersion: args.appConfig.webhookApiVersion,
      },
      observability: {
        enabled: args.appConfig.observability.enabled,
        environment: args.appConfig.observability.environment,
        release: args.appConfig.observability.release,
      },
      database: {
        status: "ok",
      },
    });
  } catch (error) {
    logStructuredError(
      "categoryfix.health.degraded",
      {
        appUrl: args.appConfig.appUrl,
      },
      error,
    );

    return Response.json(
      {
        status: "degraded",
        app: {
          appUrl: args.appConfig.appUrl,
          deploymentTargets: args.appConfig.deploymentTargets,
          scopes: args.appConfig.scopes,
          webhookApiVersion: args.appConfig.webhookApiVersion,
        },
        observability: {
          enabled: args.appConfig.observability.enabled,
          environment: args.appConfig.observability.environment,
          release: args.appConfig.observability.release,
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
