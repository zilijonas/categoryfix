import { describe, expect, it } from "vitest";
import {
  PHASE1_SHOPIFY_SCOPES,
  parseObservabilityConfig,
  parseShopifyAppConfig,
} from "@categoryfix/shopify-core";
import { parseAssistiveAiConfig } from "../app/lib/ai-assist.server.js";

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
    expect(config.deploymentTargets).toEqual({
      stagingAppUrl: null,
      productionAppUrl: null,
    });
    expect(config.observability.enabled).toBe(false);
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

describe("parseObservabilityConfig", () => {
  it("defaults to disabled when no Sentry DSN is set", () => {
    const config = parseObservabilityConfig(baseEnv);

    expect(config.enabled).toBe(false);
    expect(config.dsn).toBeNull();
  });

  it("accepts the sentry env surface", () => {
    const config = parseObservabilityConfig({
      ...baseEnv,
      NODE_ENV: "production",
      SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      SENTRY_ENVIRONMENT: "staging",
      SENTRY_RELEASE: "2026.04.01",
    });

    expect(config.enabled).toBe(true);
    expect(config.environment).toBe("staging");
    expect(config.release).toBe("2026.04.01");
  });
});

describe("parseAssistiveAiConfig", () => {
  it("defaults to disabled when the AI flag is absent", () => {
    const config = parseAssistiveAiConfig(baseEnv);

    expect(config.enabled).toBe(false);
    expect(config.model).toBeNull();
  });

  it("requires both the key and model when AI is enabled", () => {
    expect(() =>
      parseAssistiveAiConfig({
        ...baseEnv,
        CATEGORYFIX_AI_ENABLED: "true",
      }),
    ).toThrow(/OPENAI_API_KEY/);

    expect(() =>
      parseAssistiveAiConfig({
        ...baseEnv,
        CATEGORYFIX_AI_ENABLED: "true",
        OPENAI_API_KEY: "test-openai-key",
      }),
    ).toThrow(/CATEGORYFIX_OPENAI_MODEL/);
  });
});
