import { describe, expect, it, vi } from "vitest";
import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import { createHealthResponse } from "../app/lib/health.server.js";
import { createShopSettingsResponse } from "../app/lib/shop-settings.server.js";
import {
  createAppUninstalledResponse,
  createComplianceWebhookResponse,
  createProductWebhookResponse,
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
        deploymentTargets: {
          stagingAppUrl: "https://staging-app.categoryfix.com",
          productionAppUrl: "https://app.categoryfix.com",
        },
        observability: {
          enabled: false,
          environment: "test",
          release: null,
        },
      },
      database: {
        shop: {
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
        shop: {
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
        shop: {
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
      shop: {
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

  it("records product webhook deliveries and coalesces a debounce job", async () => {
    const deliveries: Array<{ shopId: string; topic: string; webhookId: string }> = [];
    const jobs: Array<{ id: string; shopId: string; topic?: string; availableAt: Date }> = [];
    const database = {
      shop: {
        findUnique: vi.fn(async () => ({
          id: "shop_1",
          shop: "demo.myshopify.com",
        })),
      },
      scanRun: {
        findFirst: vi.fn(async () => null),
      },
      webhookDelivery: {
        create: vi.fn(async (args) => {
          const exists = deliveries.find(
            (delivery) =>
              delivery.shopId === args.data.shopId &&
              delivery.topic === args.data.topic &&
              delivery.webhookId === args.data.webhookId,
          );

          if (exists) {
            const error = new Error("duplicate") as Error & { code?: string };
            error.code = "P2002";
            throw error;
          }

          deliveries.push({
            shopId: args.data.shopId,
            topic: args.data.topic,
            webhookId: args.data.webhookId,
          });

          return {
            id: `delivery_${deliveries.length}`,
            shopId: args.data.shopId,
            topic: args.data.topic,
            webhookId: args.data.webhookId,
            productId: args.data.productId ?? null,
            productGid: args.data.productGid ?? null,
            productHandle: args.data.productHandle ?? null,
            productTitle: args.data.productTitle ?? null,
            status: args.data.status,
            failureSummary: null,
            createdAt: new Date("2026-04-01T10:00:00.000Z"),
            updatedAt: new Date("2026-04-01T10:00:00.000Z"),
          };
        }),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
      },
      backgroundJob: {
        create: vi.fn(async (args) => {
          const record = {
            id: `job_${jobs.length + 1}`,
            shopId: args.data.shopId,
            kind: args.data.kind,
            status: args.data.status,
            dedupeKey: args.data.dedupeKey ?? null,
            payload: args.data.payload ?? null,
            attemptCount: 0,
            availableAt: args.data.availableAt,
            lockedAt: null,
            leaseExpiresAt: null,
            workerId: null,
            lastError: null,
            startedAt: null,
            completedAt: null,
            createdAt: new Date("2026-04-01T10:00:00.000Z"),
            updatedAt: new Date("2026-04-01T10:00:00.000Z"),
            shop: { shop: "demo.myshopify.com" },
          };
          jobs.push({
            id: record.id,
            shopId: record.shopId,
            topic: record.payload?.latestTopic,
            availableAt: record.availableAt,
          });

          return record;
        }),
        findFirst: vi.fn(async () => {
          const latest = jobs[jobs.length - 1];

          return latest
            ? {
                id: latest.id,
                shopId: latest.shopId,
                kind: "AUTO_SCAN_START",
                status: "PENDING",
                dedupeKey: "auto-scan-start:shop_1",
                payload: {
                  latestTopic: latest.topic ?? "products/update",
                },
                attemptCount: 0,
                availableAt: latest.availableAt,
                lockedAt: null,
                leaseExpiresAt: null,
                workerId: null,
                lastError: null,
                startedAt: null,
                completedAt: null,
                createdAt: new Date("2026-04-01T10:00:00.000Z"),
                updatedAt: new Date("2026-04-01T10:00:00.000Z"),
                shop: { shop: "demo.myshopify.com" },
              }
            : null;
        }),
        findMany: vi.fn(async () => []),
        findUnique: vi.fn(async () => null),
        update: vi.fn(async (args) => ({
          id: args.where.id,
          shopId: "shop_1",
          kind: "AUTO_SCAN_START",
          status: args.data.status ?? "PENDING",
          dedupeKey: "auto-scan-start:shop_1",
          payload: args.data.payload ?? null,
          attemptCount: 0,
          availableAt: args.data.availableAt,
          lockedAt: null,
          leaseExpiresAt: null,
          workerId: null,
          lastError: null,
          startedAt: null,
          completedAt: null,
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          updatedAt: new Date("2026-04-01T10:01:00.000Z"),
          shop: { shop: "demo.myshopify.com" },
        })),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      async $transaction(callback: any) {
        return callback(database);
      },
    };

    const request = new Request("https://app.categoryfix.com/webhooks/products/update", {
      method: "POST",
      headers: {
        "x-shopify-event-id": "event_1",
      },
    });

    const response = await createProductWebhookResponse({
      request,
      authenticateWebhook: vi.fn(async () => ({
        shop: "demo.myshopify.com",
        topic: "products/update",
        payload: {
          id: 100,
          admin_graphql_api_id: "gid://shopify/Product/100",
          handle: "wool-beanie",
          title: "Wool Beanie",
        },
      })),
      database: database as any,
    });

    expect(response.status).toBe(200);
    expect(deliveries).toHaveLength(1);
    expect(database.backgroundJob.create).toHaveBeenCalledTimes(1);

    const duplicateResponse = await createProductWebhookResponse({
      request,
      authenticateWebhook: vi.fn(async () => ({
        shop: "demo.myshopify.com",
        topic: "products/update",
        payload: {
          id: 100,
        },
      })),
      database: database as any,
    });

    expect(duplicateResponse.status).toBe(200);
    expect(deliveries).toHaveLength(1);
    expect(database.backgroundJob.create).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid product webhook signatures with a 401 response", async () => {
    const response = await createProductWebhookResponse({
      request: new Request("https://app.categoryfix.com/webhooks/products/update", {
        method: "POST",
      }),
      authenticateWebhook: vi.fn(async () => {
        throw new Response(null, { status: 401 });
      }),
      database: {
        shop: {
          findUnique: vi.fn(),
        },
        scanRun: {
          findFirst: vi.fn(),
        },
        webhookDelivery: {
          create: vi.fn(),
          findMany: vi.fn(async () => []),
          update: vi.fn(),
        },
        backgroundJob: {
          create: vi.fn(),
          findFirst: vi.fn(async () => null),
          findMany: vi.fn(async () => []),
          findUnique: vi.fn(async () => null),
          update: vi.fn(),
          updateMany: vi.fn(async () => ({ count: 0 })),
        },
        $transaction: vi.fn(),
      } as any,
    });

    expect(response.status).toBe(401);
  });
});
