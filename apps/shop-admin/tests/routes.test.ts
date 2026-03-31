import { describe, expect, it, vi } from "vitest";
import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import { createHealthResponse } from "../app/lib/health.server.js";
import { createShopSettingsResponse } from "../app/lib/shop-settings.server.js";
import {
  createAppUninstalledResponse,
  createComplianceWebhookResponse,
} from "../app/lib/webhooks.server.js";
import { ShopInstallationState } from "@prisma/client";

describe("phase 1 route helpers", () => {
  it("returns a healthy response when the database is reachable", async () => {
    const response = await createHealthResponse({
      appConfig: {
        apiKey: "test-key",
        apiSecret: "test-secret",
        appUrl: "https://app.categoryfix.com",
        databaseUrl: "postgresql://user:password@localhost:5432/categoryfix",
        scopes: ["read_products", "write_products"],
        webhookApiVersion: "2025-10",
        apiVersion: ApiVersion.October25,
      },
      database: {
        shopInstallation: {
          findUnique: vi.fn(),
          upsert: vi.fn(),
        },
        session: {
          deleteMany: vi.fn(),
        },
        $queryRaw: vi.fn(async () => [{ result: 1 }]),
        $transaction: vi.fn(async (queries) => Promise.all(queries)),
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
    });
  });

  it("returns authenticated shop settings", async () => {
    const response = await createShopSettingsResponse({
      request: new Request("https://app.categoryfix.com/api/v1/shop/settings"),
      authenticateAdmin: vi.fn(async () => ({
        session: { shop: "demo.myshopify.com" },
      })),
      database: {
        shopInstallation: {
          findUnique: vi.fn(async () => ({
            id: "install_1",
            shop: "demo.myshopify.com",
            state: ShopInstallationState.INSTALLED,
            scopes: "read_products,write_products",
            appUrl: "https://app.categoryfix.com",
            offlineSessionId: "offline_demo",
            accessTokenExpiresAt: null,
            installedAt: new Date("2026-03-31T12:00:00.000Z"),
            uninstalledAt: null,
            createdAt: new Date("2026-03-31T12:00:00.000Z"),
            updatedAt: new Date("2026-03-31T12:00:00.000Z"),
          })),
          upsert: vi.fn(),
        },
        session: {
          deleteMany: vi.fn(),
        },
        $queryRaw: vi.fn(async () => [{ result: 1 }]),
        $transaction: vi.fn(async (queries) => Promise.all(queries)),
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      shop: "demo.myshopify.com",
      installation: {
        state: ShopInstallationState.INSTALLED,
      },
    });
  });

  it("rejects invalid webhook signatures with a 401 response", async () => {
    const response = await createAppUninstalledResponse({
      request: new Request("https://app.categoryfix.com/webhooks/app/uninstalled", {
        method: "POST",
      }),
      authenticateWebhook: vi.fn(async () => {
        throw new Response(null, { status: 401 });
      }),
      database: {
        shopInstallation: {
          findUnique: vi.fn(),
          upsert: vi.fn(),
        },
        session: {
          deleteMany: vi.fn(),
        },
        $queryRaw: vi.fn(async () => [{ result: 1 }]),
        $transaction: vi.fn(async (queries) => Promise.all(queries)),
      },
    });

    expect(response.status).toBe(401);
  });

  it("handles app/uninstalled with idempotent cleanup", async () => {
    const database = {
      shopInstallation: {
        findUnique: vi.fn(),
        upsert: vi.fn(async () => ({
          id: "install_1",
          shop: "demo.myshopify.com",
          state: ShopInstallationState.UNINSTALLED,
          scopes: null,
          appUrl: null,
          offlineSessionId: null,
          accessTokenExpiresAt: null,
          installedAt: new Date("2026-03-31T12:00:00.000Z"),
          uninstalledAt: new Date("2026-03-31T12:30:00.000Z"),
          createdAt: new Date("2026-03-31T12:00:00.000Z"),
          updatedAt: new Date("2026-03-31T12:30:00.000Z"),
        })),
      },
      session: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
      $queryRaw: vi.fn(async () => [{ result: 1 }]),
      $transaction: vi.fn(async (queries) => Promise.all(queries)),
    };

    const response = await createAppUninstalledResponse({
      request: new Request("https://app.categoryfix.com/webhooks/app/uninstalled", {
        method: "POST",
      }),
      authenticateWebhook: vi.fn(async () => ({
        shop: "demo.myshopify.com",
        topic: "app/uninstalled",
        session: null,
      })),
      database,
    });

    expect(response.status).toBe(200);
    expect(database.session.deleteMany).toHaveBeenCalled();
  });

  it("acknowledges compliance webhooks without storing payloads", async () => {
    const response = await createComplianceWebhookResponse({
      request: new Request(
        "https://app.categoryfix.com/webhooks/customers/redact",
        { method: "POST" },
      ),
      authenticateWebhook: vi.fn(async () => ({
        shop: "demo.myshopify.com",
        topic: "customers/redact",
      })),
    });

    expect(response.status).toBe(200);
  });
});
