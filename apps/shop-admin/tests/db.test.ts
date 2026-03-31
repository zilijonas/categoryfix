import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkDatabaseHealth,
  getShopSettings,
  markShopUninstalled,
  upsertShopInstallationFromSession,
  type DatabaseClient,
} from "@categoryfix/db";
import { ShopInstallationState } from "@prisma/client";

function createDatabaseMock(): DatabaseClient {
  return {
    shopInstallation: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(async () => [{ result: 1 }]),
    $transaction: vi.fn(async (queries) => Promise.all(queries)),
  };
}

describe("database helpers", () => {
  let database: DatabaseClient;

  beforeEach(() => {
    database = createDatabaseMock();
  });

  it("checks database connectivity", async () => {
    await expect(checkDatabaseHealth(database)).resolves.toBe(true);
    expect(database.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("persists an installed shop from the offline session", async () => {
    const upsert = vi.mocked(database.shopInstallation.upsert);
    upsert.mockResolvedValue({
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
    });

    const installation = await upsertShopInstallationFromSession(
      {
        session: {
          id: "offline_demo",
          shop: "demo.myshopify.com",
          isOnline: false,
          scope: "read_products,write_products",
        },
        appUrl: "https://app.categoryfix.com",
        scopes: ["read_products", "write_products"],
      },
      database,
    );

    expect(installation.state).toBe(ShopInstallationState.INSTALLED);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shop: "demo.myshopify.com" },
      }),
    );
  });

  it("marks app/uninstalled as idempotent cleanup", async () => {
    const upsert = vi.mocked(database.shopInstallation.upsert);
    const deleteMany = vi.mocked(database.session.deleteMany);
    upsert.mockResolvedValue({
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
    });
    deleteMany.mockResolvedValue({ count: 1 });

    await markShopUninstalled({ shop: "demo.myshopify.com" }, database);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { shop: "demo.myshopify.com" },
    });
    expect(upsert).toHaveBeenCalled();
  });

  it("reads the current installation snapshot", async () => {
    vi.mocked(database.shopInstallation.findUnique).mockResolvedValue({
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
    });

    const installation = await getShopSettings("demo.myshopify.com", database);

    expect(installation).toEqual({
      shop: "demo.myshopify.com",
      state: ShopInstallationState.INSTALLED,
      scopes: ["read_products", "write_products"],
      appUrl: "https://app.categoryfix.com",
      offlineSessionId: "offline_demo",
      installedAt: "2026-03-31T12:00:00.000Z",
      uninstalledAt: null,
    });
  });
});
