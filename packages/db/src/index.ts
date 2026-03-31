import {
  Prisma,
  ShopInstallationState,
  TaxonomyCategoryTermKind,
  type Shop,
  type TaxonomyVersion,
} from "@prisma/client";
import { prisma } from "./client.js";

export * from "./scans.js";
export * from "./jobs.js";
export * from "./background-jobs.js";

type TaxonomyCategoryWithVersion = Prisma.TaxonomyCategoryGetPayload<{
  include: { taxonomyVersion: true };
}>;

type TaxonomyCategoryTermWithCategory = Prisma.TaxonomyCategoryTermGetPayload<{
  include: { category: { include: { taxonomyVersion: true } } };
}>;

export interface DatabaseClient {
  shop: {
    upsert(args: Prisma.ShopUpsertArgs): Promise<Shop>;
    findUnique(args: Prisma.ShopFindUniqueArgs): Promise<Shop | null>;
  };
  session: {
    deleteMany(args: Prisma.SessionDeleteManyArgs): Promise<unknown>;
  };
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  $transaction(queries: Promise<unknown>[]): Promise<unknown[]>;
}

export interface TaxonomyLookupDatabaseClient {
  taxonomyVersion: {
    findUnique(args: Prisma.TaxonomyVersionFindUniqueArgs): Promise<TaxonomyVersion | null>;
    findFirst(args: Prisma.TaxonomyVersionFindFirstArgs): Promise<TaxonomyVersion | null>;
  };
  taxonomyCategory: {
    findUnique(args: Prisma.TaxonomyCategoryFindUniqueArgs): Promise<unknown>;
    findMany(args: Prisma.TaxonomyCategoryFindManyArgs): Promise<unknown[]>;
  };
  taxonomyCategoryTerm: {
    findMany(args: Prisma.TaxonomyCategoryTermFindManyArgs): Promise<unknown[]>;
  };
}

export interface TaxonomySeedDatabaseClient extends TaxonomyLookupDatabaseClient {
  taxonomyVersion: TaxonomyLookupDatabaseClient["taxonomyVersion"] & {
    upsert(args: Prisma.TaxonomyVersionUpsertArgs): Promise<TaxonomyVersion>;
  };
  taxonomyCategory: TaxonomyLookupDatabaseClient["taxonomyCategory"] & {
    count(args: Prisma.TaxonomyCategoryCountArgs): Promise<number>;
    createMany(args: Prisma.TaxonomyCategoryCreateManyArgs): Promise<{ count: number }>;
  };
  taxonomyCategoryTerm: TaxonomyLookupDatabaseClient["taxonomyCategoryTerm"] & {
    count(args: Prisma.TaxonomyCategoryTermCountArgs): Promise<number>;
    createMany(args: Prisma.TaxonomyCategoryTermCreateManyArgs): Promise<{ count: number }>;
  };
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

export interface TaxonomySnapshotTermInput {
  kind: TaxonomyCategoryTermKind;
  term: string;
}

export interface TaxonomySnapshotCategoryInput {
  taxonomyId: string;
  taxonomyGid: string;
  name: string;
  fullPath: string;
  parentTaxonomyId?: string | null;
  level: number;
  isLeaf: boolean;
  terms?: readonly TaxonomySnapshotTermInput[];
}

export interface TaxonomyVersionSnapshotInput {
  version: string;
  locale: string;
  source: string;
  sourceUrl?: string | null;
  releasedAt?: string | Date | null;
  categories: readonly TaxonomySnapshotCategoryInput[];
}

export interface SeedTaxonomySnapshotResult {
  version: string;
  locale: string;
  created: boolean;
  categoryCount: number;
  termCount: number;
}

export interface TaxonomyCategoryLookup {
  version: string;
  locale: string;
  taxonomyId: string;
  taxonomyGid: string;
  name: string;
  fullPath: string;
  parentTaxonomyId: string | null;
  level: number;
  isLeaf: boolean;
  matchedTerms: string[];
}

export interface TaxonomyLookupOptions {
  version?: string;
  locale?: string;
}

export interface TaxonomySearchOptions extends TaxonomyLookupOptions {
  limit?: number;
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

function normalizeTaxonomyTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toSnapshot(record: Shop): ShopSettingsSnapshot {
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

function coerceDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

function toTaxonomyLookup(
  record: TaxonomyCategoryWithVersion,
  matchedTerms: string[] = [],
): TaxonomyCategoryLookup {
  return {
    version: record.taxonomyVersion.version,
    locale: record.taxonomyVersion.locale,
    taxonomyId: record.taxonomyId,
    taxonomyGid: record.taxonomyGid,
    name: record.name,
    fullPath: record.fullPath,
    parentTaxonomyId: record.parentTaxonomyId,
    level: record.level,
    isLeaf: record.isLeaf,
    matchedTerms,
  };
}

function buildTaxonomyTermRows(
  versionId: string,
  categories: readonly TaxonomySnapshotCategoryInput[],
): Prisma.TaxonomyCategoryTermCreateManyInput[] {
  const rows: Prisma.TaxonomyCategoryTermCreateManyInput[] = [];

  for (const category of categories) {
    const uniqueTerms = new Map<string, Prisma.TaxonomyCategoryTermCreateManyInput>();
    const candidateTerms: TaxonomySnapshotTermInput[] = [
      { kind: TaxonomyCategoryTermKind.PRIMARY_NAME, term: category.name },
      { kind: TaxonomyCategoryTermKind.PATH, term: category.fullPath },
      ...(category.terms ?? []),
    ];

    for (const candidate of candidateTerms) {
      const normalizedTerm = normalizeTaxonomyTerm(candidate.term);

      if (!normalizedTerm) {
        continue;
      }

      const dedupeKey = [
        versionId,
        category.taxonomyId,
        candidate.kind,
        normalizedTerm,
      ].join(":");

      uniqueTerms.set(dedupeKey, {
        taxonomyVersionId: versionId,
        taxonomyId: category.taxonomyId,
        kind: candidate.kind,
        term: candidate.term.trim(),
        normalizedTerm,
      });
    }

    rows.push(...uniqueTerms.values());
  }

  return rows;
}

async function resolveTaxonomyVersion(
  options: TaxonomyLookupOptions,
  database: TaxonomyLookupDatabaseClient,
) {
  const locale = options.locale ?? "en";

  if (options.version) {
    return database.taxonomyVersion.findUnique({
      where: {
        version_locale: {
          version: options.version,
          locale,
        },
      },
    });
  }

  return database.taxonomyVersion.findFirst({
    where: { locale },
    orderBy: [{ releasedAt: "desc" }, { createdAt: "desc" }],
  });
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
  const record = await database.shop.upsert({
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
    database.shop.upsert({
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
  const record = await database.shop.findUnique({
    where: { shop },
  });

  if (!record) {
    return null;
  }

  return toSnapshot(record);
}

export async function seedTaxonomySnapshot(
  snapshot: TaxonomyVersionSnapshotInput,
  database: TaxonomySeedDatabaseClient = prisma,
): Promise<SeedTaxonomySnapshotResult> {
  const versionRecord = await database.taxonomyVersion.upsert({
    where: {
      version_locale: {
        version: snapshot.version,
        locale: snapshot.locale,
      },
    },
    create: {
      version: snapshot.version,
      locale: snapshot.locale,
      source: snapshot.source,
      sourceUrl: snapshot.sourceUrl ?? null,
      releasedAt: coerceDate(snapshot.releasedAt),
      importedAt: new Date(),
    },
    update: {
      source: snapshot.source,
      sourceUrl: snapshot.sourceUrl ?? null,
      releasedAt: coerceDate(snapshot.releasedAt),
      importedAt: new Date(),
    },
  });

  const existingCategoryCount = await database.taxonomyCategory.count({
    where: { taxonomyVersionId: versionRecord.id },
  });

  if (existingCategoryCount > 0) {
    const existingTermCount = await database.taxonomyCategoryTerm.count({
      where: { taxonomyVersionId: versionRecord.id },
    });

    return {
      version: snapshot.version,
      locale: snapshot.locale,
      created: false,
      categoryCount: existingCategoryCount,
      termCount: existingTermCount,
    };
  }

  const categoryRows: Prisma.TaxonomyCategoryCreateManyInput[] = snapshot.categories.map(
    (category) => ({
      taxonomyVersionId: versionRecord.id,
      taxonomyId: category.taxonomyId,
      taxonomyGid: category.taxonomyGid,
      name: category.name,
      fullPath: category.fullPath,
      parentTaxonomyId: category.parentTaxonomyId ?? null,
      level: category.level,
      isLeaf: category.isLeaf,
    }),
  );

  const termRows = buildTaxonomyTermRows(versionRecord.id, snapshot.categories);

  await database.$transaction([
    database.taxonomyCategory.createMany({
      data: categoryRows,
    }),
    database.taxonomyCategoryTerm.createMany({
      data: termRows,
    }),
  ]);

  return {
    version: snapshot.version,
    locale: snapshot.locale,
    created: true,
    categoryCount: categoryRows.length,
    termCount: termRows.length,
  };
}

export async function findTaxonomyCategoryById(
  taxonomyId: string,
  options: TaxonomyLookupOptions = {},
  database: TaxonomyLookupDatabaseClient = prisma,
): Promise<TaxonomyCategoryLookup | null> {
  const version = await resolveTaxonomyVersion(options, database);

  if (!version) {
    return null;
  }

  const record = await database.taxonomyCategory.findUnique({
    where: {
      taxonomyVersionId_taxonomyId: {
        taxonomyVersionId: version.id,
        taxonomyId,
      },
    },
    include: {
      taxonomyVersion: true,
    },
  });

  return record ? toTaxonomyLookup(record as TaxonomyCategoryWithVersion) : null;
}

export async function findTaxonomyCategoryByPath(
  fullPath: string,
  options: TaxonomyLookupOptions = {},
  database: TaxonomyLookupDatabaseClient = prisma,
): Promise<TaxonomyCategoryLookup | null> {
  const version = await resolveTaxonomyVersion(options, database);

  if (!version) {
    return null;
  }

  const record = await database.taxonomyCategory.findUnique({
    where: {
      taxonomyVersionId_fullPath: {
        taxonomyVersionId: version.id,
        fullPath: fullPath.trim(),
      },
    },
    include: {
      taxonomyVersion: true,
    },
  });

  return record ? toTaxonomyLookup(record as TaxonomyCategoryWithVersion) : null;
}

export async function searchTaxonomyCategories(
  query: string,
  options: TaxonomySearchOptions = {},
  database: TaxonomyLookupDatabaseClient = prisma,
): Promise<TaxonomyCategoryLookup[]> {
  const normalizedQuery = normalizeTaxonomyTerm(query);

  if (!normalizedQuery) {
    return [];
  }

  const version = await resolveTaxonomyVersion(options, database);

  if (!version) {
    return [];
  }

  const limit = options.limit ?? 10;
  const results = new Map<string, TaxonomyCategoryLookup>();

  const termMatches = (await database.taxonomyCategoryTerm.findMany({
    where: {
      taxonomyVersionId: version.id,
      normalizedTerm: {
        contains: normalizedQuery,
      },
    },
    include: {
      category: {
        include: {
          taxonomyVersion: true,
        },
      },
    },
    take: limit,
  })) as TaxonomyCategoryTermWithCategory[];

  for (const match of termMatches) {
    results.set(
      match.category.taxonomyId,
      toTaxonomyLookup(match.category, [match.term]),
    );
  }

  if (results.size < limit) {
    const categoryMatches = (await database.taxonomyCategory.findMany({
      where: {
        taxonomyVersionId: version.id,
        OR: [
          { taxonomyId: { contains: normalizedQuery, mode: "insensitive" } },
          { name: { contains: query.trim(), mode: "insensitive" } },
          { fullPath: { contains: query.trim(), mode: "insensitive" } },
        ],
      },
      include: {
        taxonomyVersion: true,
      },
      take: limit - results.size,
    })) as TaxonomyCategoryWithVersion[];

    for (const match of categoryMatches) {
      results.set(match.taxonomyId, toTaxonomyLookup(match));
    }
  }

  return Array.from(results.values()).slice(0, limit);
}

export { ShopInstallationState, TaxonomyCategoryTermKind, prisma };
