import "@shopify/shopify-app-react-router/adapters/node";
import { prisma } from "./db.server.js";
import { createCategoryFixShopifyApp } from "@categoryfix/shopify-core";

const { app: shopify, config: appConfig } = createCategoryFixShopifyApp({
  env: process.env,
  prisma,
});

export { appConfig };
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
export const unauthenticated = shopify.unauthenticated;
export default shopify;
