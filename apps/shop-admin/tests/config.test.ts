import { describe, expect, it } from "vitest";
import {
  PHASE1_SHOPIFY_SCOPES,
  parseShopifyAppConfig,
} from "@categoryfix/shopify-core";

const baseEnv = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/categoryfix",
  SHOPIFY_API_KEY: "test-key",
  SHOPIFY_API_SECRET: "test-secret",
  SHOPIFY_APP_URL: "https://app.categoryfix.com",
  SHOPIFY_SCOPES: "read_products,write_products",
  SHOPIFY_WEBHOOK_API_VERSION: "2025-10",
} satisfies NodeJS.ProcessEnv;

describe("parseShopifyAppConfig", () => {
  it("accepts the phase 1 env surface", () => {
    const config = parseShopifyAppConfig(baseEnv);

    expect(config.scopes).toEqual(PHASE1_SHOPIFY_SCOPES);
    expect(config.webhookApiVersion).toBe("2025-10");
  });

  it("rejects widened Shopify scopes", () => {
    expect(() =>
      parseShopifyAppConfig({
        ...baseEnv,
        SHOPIFY_SCOPES: "read_products,write_products,read_orders",
      }),
    ).toThrow(/SHOPIFY_SCOPES/);
  });
});
