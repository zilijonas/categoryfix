import "@shopify/shopify-app-react-router/adapters/node";
import { prisma } from "./db.server.js";
import {
  createCategoryFixShopifyApp,
  initializeObservability,
} from "@categoryfix/shopify-core";

initializeObservability(process.env, {
  serviceName: "categoryfix-shop-admin",
});

const isE2EMock = process.env.CATEGORYFIX_E2E_MOCK === "1";
const mockShop = process.env.CATEGORYFIX_E2E_SHOP ?? "demo.myshopify.com";
const mockAuthenticate = {
  admin: async () => ({
    session: {
      shop: mockShop,
    },
  }),
  webhook: async () => {
    throw new Error("Webhook authentication is unavailable in e2e mock mode.");
  },
};
const mockAppConfig = {
  apiKey: "categoryfix-e2e-key",
};
const shopifyBundle = isE2EMock
  ? null
  : createCategoryFixShopifyApp({
      env: process.env,
      prisma,
    });
const shopify = shopifyBundle?.app;
const appConfig = (isE2EMock ? mockAppConfig : shopifyBundle!.config) as any;

export { appConfig };
export const addDocumentResponseHeaders =
  shopify?.addDocumentResponseHeaders ?? ((..._args: unknown[]) => new Headers());
export const authenticate = (isE2EMock ? mockAuthenticate : shopify!.authenticate) as any;
export const login = shopify?.login ?? (() => {
  throw new Error("Login is unavailable in e2e mock mode.");
});
export const registerWebhooks = shopify?.registerWebhooks ?? (async () => undefined);
export const sessionStorage = (shopify?.sessionStorage ?? null) as any;
export const unauthenticated = (shopify?.unauthenticated ?? null) as any;
export default shopify as any;
