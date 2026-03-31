import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import { prisma } from "../db.server.js";

export interface OfflineShopRecord {
  id: string;
  shop: string;
  offlineSessionId: string | null;
}

export interface OfflineSessionRecord {
  id: string;
  shop: string;
}

export interface OfflineAdminContext {
  shopRecord: OfflineShopRecord;
  session: OfflineSessionRecord;
  admin: {
    graphql: AdminGraphqlClient;
  };
}

export interface OfflineAdminDatabaseClient {
  shop: {
    findUnique(args: {
      where: { shop: string };
      select: { id: true; shop: true; offlineSessionId: true };
    }): Promise<OfflineShopRecord | null>;
  };
}

async function loadShopifyOfflineHelpers() {
  const shopify = await import("../shopify.server.js");

  return {
    sessionStorage: shopify.sessionStorage,
    unauthenticated: shopify.unauthenticated,
  };
}

export async function resolveOfflineAdminContext(
  args: {
    shop: string;
    database?: OfflineAdminDatabaseClient;
    loadOfflineSession?: (offlineSessionId: string) => Promise<OfflineSessionRecord | null>;
    getUnauthenticatedAdmin?: (
      shop: string,
    ) => Promise<{ session: OfflineSessionRecord; admin: { graphql: AdminGraphqlClient } }>;
  },
): Promise<OfflineAdminContext> {
  const database = args.database ?? prisma;
  const shopifyHelpers =
    args.loadOfflineSession || args.getUnauthenticatedAdmin
      ? null
      : await loadShopifyOfflineHelpers();
  const loadOfflineSession =
    args.loadOfflineSession ??
    (async (offlineSessionId: string) =>
      (await shopifyHelpers?.sessionStorage.loadSession(offlineSessionId)) as
        | OfflineSessionRecord
        | null);
  const getUnauthenticatedAdmin =
    args.getUnauthenticatedAdmin ?? shopifyHelpers?.unauthenticated.admin;

  const shopRecord = await database.shop.findUnique({
    where: { shop: args.shop },
    select: { id: true, shop: true, offlineSessionId: true },
  });

  if (!shopRecord) {
    throw new Error(`Shop ${args.shop} is not installed.`);
  }

  if (!shopRecord.offlineSessionId) {
    throw new Error(`Shop ${args.shop} does not have an offline session.`);
  }

  const storedSession = await loadOfflineSession(shopRecord.offlineSessionId);

  if (!storedSession) {
    throw new Error(`Offline session ${shopRecord.offlineSessionId} could not be loaded.`);
  }

  if (storedSession.shop !== shopRecord.shop) {
    throw new Error(`Offline session ${shopRecord.offlineSessionId} does not belong to ${args.shop}.`);
  }

  if (!getUnauthenticatedAdmin) {
    throw new Error("Shopify unauthenticated admin context is unavailable.");
  }

  const context = await getUnauthenticatedAdmin(shopRecord.shop);

  if (context.session.id !== shopRecord.offlineSessionId) {
    throw new Error(`Offline session mismatch for ${args.shop}.`);
  }

  return {
    shopRecord,
    session: storedSession,
    admin: context.admin,
  };
}
