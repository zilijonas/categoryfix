import { ShopInstallationState, type Prisma, type ShopInstallation } from "@prisma/client";
import { prisma } from "./client.js";

export interface DatabaseClient {
  shopInstallation: {
    upsert(args: Prisma.ShopInstallationUpsertArgs): Promise<ShopInstallation>;
    findUnique(args: Prisma.ShopInstallationFindUniqueArgs): Promise<ShopInstallation | null>;
  };
  session: {
    deleteMany(args: Prisma.SessionDeleteManyArgs): Promise<unknown>;
  };
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  $transaction(queries: Promise<unknown>[]): Promise<unknown[]>;
}

export interface AuthenticatedShopSession {
  id: string;
  shop: string;
  scope?: string | null;
  expires?: Date | null;
  isOnline: boolean;
}

export interface ShopSettingsSnapshot {
  shop: string;
  state: ShopInstallationState;
  scopes: string[];
  appUrl: string | null;
  offlineSessionId: string | null;
  installedAt: string;
  uninstalledAt: string | null;
}

function splitScopes(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function toSnapshot(record: ShopInstallation): ShopSettingsSnapshot {
  return {
    shop: record.shop,
    state: record.state,
    scopes: splitScopes(record.scopes),
    appUrl: record.appUrl,
    offlineSessionId: record.offlineSessionId,
    installedAt: record.installedAt.toISOString(),
    uninstalledAt: record.uninstalledAt?.toISOString() ?? null,
  };
}

export async function checkDatabaseHealth(database: DatabaseClient = prisma): Promise<boolean> {
  await database.$queryRaw`SELECT 1`;

  return true;
}

export async function upsertShopInstallationFromSession(
  args: {
    session: AuthenticatedShopSession;
    appUrl: string;
    scopes: readonly string[];
  },
  database: DatabaseClient = prisma,
): Promise<ShopSettingsSnapshot> {
  const record = await database.shopInstallation.upsert({
    where: { shop: args.session.shop },
    create: {
      shop: args.session.shop,
      state: ShopInstallationState.INSTALLED,
      scopes: args.session.scope ?? args.scopes.join(","),
      appUrl: args.appUrl,
      offlineSessionId: args.session.isOnline ? null : args.session.id,
      accessTokenExpiresAt: args.session.expires ?? null,
    },
    update: {
      state: ShopInstallationState.INSTALLED,
      scopes: args.session.scope ?? args.scopes.join(","),
      appUrl: args.appUrl,
      offlineSessionId: args.session.isOnline ? null : args.session.id,
      accessTokenExpiresAt: args.session.expires ?? null,
      uninstalledAt: null,
    },
  });

  return toSnapshot(record);
}

export async function markShopUninstalled(
  args: { shop: string },
  database: DatabaseClient = prisma,
): Promise<void> {
  const now = new Date();

  await database.$transaction([
    database.session.deleteMany({ where: { shop: args.shop } }),
    database.shopInstallation.upsert({
      where: { shop: args.shop },
      create: {
        shop: args.shop,
        state: ShopInstallationState.UNINSTALLED,
        uninstalledAt: now,
      },
      update: {
        state: ShopInstallationState.UNINSTALLED,
        offlineSessionId: null,
        accessTokenExpiresAt: null,
        uninstalledAt: now,
      },
    }),
  ]);
}

export async function getShopSettings(
  shop: string,
  database: DatabaseClient = prisma,
): Promise<ShopSettingsSnapshot | null> {
  const record = await database.shopInstallation.findUnique({
    where: { shop },
  });

  if (!record) {
    return null;
  }

  return toSnapshot(record);
}

export { prisma };
