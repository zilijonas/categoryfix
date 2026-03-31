import {
  AppDistribution,
  shopifyApp,
  type Session,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { PrismaClient } from "@prisma/client";
import { upsertShopInstallationFromSession } from "@categoryfix/db";
import { type CategoryFixShopifyConfig, parseShopifyAppConfig } from "./config.js";
import { logStructuredEvent } from "./logger.js";

export function createCategoryFixShopifyApp(args: {
  env: NodeJS.ProcessEnv;
  prisma: PrismaClient;
}): {
  app: ReturnType<typeof shopifyApp>;
  config: CategoryFixShopifyConfig;
} {
  const config = parseShopifyAppConfig(args.env);

  const app = shopifyApp({
    apiKey: config.apiKey,
    apiSecretKey: config.apiSecret,
    apiVersion: config.apiVersion,
    scopes: [...config.scopes],
    appUrl: config.appUrl,
    authPathPrefix: "/auth",
    sessionStorage: new PrismaSessionStorage(args.prisma),
    distribution: AppDistribution.AppStore,
    future: {
      expiringOfflineAccessTokens: true,
    },
    hooks: {
      afterAuth: async ({ session }: { session: Session }) => {
        await upsertShopInstallationFromSession(
          {
            session: {
              id: session.id,
              shop: session.shop,
              scope: session.scope ?? null,
              expires: session.expires ?? null,
              isOnline: session.isOnline,
            },
            appUrl: config.appUrl,
            scopes: config.scopes,
          },
          args.prisma,
        );

        logStructuredEvent("shopify.auth.after_auth", {
          shopId: session.shop,
          sessionId: session.id,
          isOnline: session.isOnline,
        });
      },
    },
  });

  return { app, config };
}

export async function authenticateWebhookRequest<T>(
  request: Request,
  authenticateWebhook: (request: Request) => Promise<T>,
): Promise<T | Response> {
  try {
    return await authenticateWebhook(request);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    throw error;
  }
}

export { parseShopifyAppConfig };
