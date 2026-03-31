import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import { z } from "zod";

export const PHASE1_SHOPIFY_SCOPES = ["read_products", "write_products"] as const;
export const MANDATORY_WEBHOOKS = [
  { topic: "app/uninstalled", path: "/webhooks/app/uninstalled" },
  { topic: "customers/data_request", path: "/webhooks/customers/data_request" },
  { topic: "customers/redact", path: "/webhooks/customers/redact" },
  { topic: "shop/redact", path: "/webhooks/shop/redact" },
] as const;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SHOPIFY_API_KEY: z.string().min(1, "SHOPIFY_API_KEY is required"),
  SHOPIFY_API_SECRET: z.string().min(1, "SHOPIFY_API_SECRET is required"),
  SHOPIFY_APP_URL: z.string().url("SHOPIFY_APP_URL must be a valid URL"),
  SHOPIFY_SCOPES: z.string().min(1, "SHOPIFY_SCOPES is required"),
  SHOPIFY_WEBHOOK_API_VERSION: z.literal("2025-10"),
});

export interface CategoryFixShopifyConfig {
  apiKey: string;
  apiSecret: string;
  appUrl: string;
  databaseUrl: string;
  scopes: readonly string[];
  webhookApiVersion: "2025-10";
  apiVersion: ApiVersion.October25;
}

function normalizeScopes(rawScopes: string): readonly string[] {
  const scopes = rawScopes
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
    .sort();

  const expectedScopes = [...PHASE1_SHOPIFY_SCOPES].sort();

  if (
    scopes.length !== expectedScopes.length ||
    scopes.some((scope, index) => scope !== expectedScopes[index])
  ) {
    throw new Error(
      `SHOPIFY_SCOPES must be exactly ${expectedScopes.join(",")} for phase 1.`,
    );
  }

  return [...PHASE1_SHOPIFY_SCOPES];
}

export function parseShopifyAppConfig(
  env: NodeJS.ProcessEnv,
): CategoryFixShopifyConfig {
  const parsed = envSchema.parse(env);

  return {
    apiKey: parsed.SHOPIFY_API_KEY,
    apiSecret: parsed.SHOPIFY_API_SECRET,
    appUrl: parsed.SHOPIFY_APP_URL,
    databaseUrl: parsed.DATABASE_URL,
    scopes: normalizeScopes(parsed.SHOPIFY_SCOPES),
    webhookApiVersion: parsed.SHOPIFY_WEBHOOK_API_VERSION,
    apiVersion: ApiVersion.October25,
  };
}
