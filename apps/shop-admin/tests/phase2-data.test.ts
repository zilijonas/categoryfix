import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  TaxonomyCategoryTermKind,
  findTaxonomyCategoryById,
  findTaxonomyCategoryByPath,
  searchTaxonomyCategories,
  seedTaxonomySnapshot,
  type TaxonomyLookupDatabaseClient,
  type TaxonomySeedDatabaseClient,
} from "@categoryfix/db";
import { shopifyTaxonomyBootstrapSnapshot } from "../../../packages/taxonomy-data/src/snapshot.js";

interface VersionRecord {
  id: string;
  version: string;
  locale: string;
  source: string;
  sourceUrl: string | null;
  releasedAt: Date | null;
  importedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryRecord {
  id: string;
  taxonomyVersionId: string;
  taxonomyId: string;
  taxonomyGid: string;
  name: string;
  fullPath: string;
  parentTaxonomyId: string | null;
  level: number;
  isLeaf: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TermRecord {
  id: string;
  taxonomyVersionId: string;
  taxonomyId: string;
  kind: TaxonomyCategoryTermKind;
  term: string;
  normalizedTerm: string;
  createdAt: Date;
}

function createInMemoryTaxonomyDatabase(): TaxonomySeedDatabaseClient & TaxonomyLookupDatabaseClient {
  const versions: VersionRecord[] = [];
  const categories: CategoryRecord[] = [];
  const terms: TermRecord[] = [];
  let versionSequence = 1;
  let categorySequence = 1;
  let termSequence = 1;

  return {
    taxonomyVersion: {
      async upsert(args: any) {
        const existing = versions.find(
          (version) =>
            version.version === args.where.version_locale.version &&
            version.locale === args.where.version_locale.locale,
        );

        if (existing) {
          existing.source = args.update.source ?? existing.source;
          existing.sourceUrl = args.update.sourceUrl ?? null;
          existing.releasedAt = (args.update.releasedAt as Date | null | undefined) ?? null;
          existing.importedAt = (args.update.importedAt as Date | null | undefined) ?? null;
          existing.updatedAt = new Date();

          return existing;
        }

        const now = new Date();
        const record: VersionRecord = {
          id: `version_${versionSequence++}`,
          version: args.create.version,
          locale: args.create.locale,
          source: args.create.source,
          sourceUrl: args.create.sourceUrl ?? null,
          releasedAt: (args.create.releasedAt as Date | null | undefined) ?? null,
          importedAt: (args.create.importedAt as Date | null | undefined) ?? null,
          createdAt: now,
          updatedAt: now,
        };
        versions.push(record);

        return record;
      },
      async findUnique(args: any) {
        return (
          versions.find(
            (version) =>
              version.version === args.where.version_locale?.version &&
              version.locale === args.where.version_locale?.locale,
          ) ?? null
        );
      },
      async findFirst(args: any) {
        const locale = args.where?.locale;
        const matches = versions.filter((version) => !locale || version.locale === locale);

        matches.sort((left, right) => {
          const leftTimestamp = left.releasedAt?.getTime() ?? left.createdAt.getTime();
          const rightTimestamp = right.releasedAt?.getTime() ?? right.createdAt.getTime();

          return rightTimestamp - leftTimestamp;
        });

        return matches[0] ?? null;
      },
    },
    taxonomyCategory: {
      async count(args: any) {
        return categories.filter(
          (category) => category.taxonomyVersionId === args.where?.taxonomyVersionId,
        ).length;
      },
      async createMany(args: any) {
        const data = Array.isArray(args.data) ? args.data : [args.data];

        for (const row of data) {
          categories.push({
            id: `category_${categorySequence++}`,
            taxonomyVersionId: row.taxonomyVersionId,
            taxonomyId: row.taxonomyId,
            taxonomyGid: row.taxonomyGid,
            name: row.name,
            fullPath: row.fullPath,
            parentTaxonomyId: row.parentTaxonomyId ?? null,
            level: row.level,
            isLeaf: row.isLeaf,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return { count: data.length };
      },
      async findUnique(args: any) {
        const lookupById = args.where.taxonomyVersionId_taxonomyId;
        const lookupByPath = args.where.taxonomyVersionId_fullPath;
        const record =
          categories.find((category) => {
            if (lookupById) {
              return (
                category.taxonomyVersionId === lookupById.taxonomyVersionId &&
                category.taxonomyId === lookupById.taxonomyId
              );
            }

            if (lookupByPath) {
              return (
                category.taxonomyVersionId === lookupByPath.taxonomyVersionId &&
                category.fullPath === lookupByPath.fullPath
              );
            }

            return false;
          }) ?? null;

        if (!record) {
          return null;
        }

        const version = versions.find((entry) => entry.id === record.taxonomyVersionId);

        return version ? { ...record, taxonomyVersion: version } : null;
      },
      async findMany(args: any) {
        const scoped = categories.filter(
          (category) => category.taxonomyVersionId === args.where?.taxonomyVersionId,
        );
        const matches = scoped.filter((category) => {
          const filters = args.where?.OR ?? [];

          return filters.some((filter: any) => {
            if (filter.taxonomyId?.contains) {
              return category.taxonomyId
                .toLowerCase()
                .includes(filter.taxonomyId.contains.toLowerCase());
            }

            if (filter.name?.contains) {
              return category.name
                .toLowerCase()
                .includes(filter.name.contains.toLowerCase());
            }

            if (filter.fullPath?.contains) {
              return category.fullPath
                .toLowerCase()
                .includes(filter.fullPath.contains.toLowerCase());
            }

            return false;
          });
        });

        const limited = matches.slice(0, args.take ?? matches.length);

        return limited
          .map((record) => {
            const version = versions.find((entry) => entry.id === record.taxonomyVersionId);

            return version ? { ...record, taxonomyVersion: version } : null;
          })
          .filter((record): record is CategoryRecord & { taxonomyVersion: VersionRecord } =>
            Boolean(record),
          );
      },
    },
    taxonomyCategoryTerm: {
      async count(args: any) {
        return terms.filter((term) => term.taxonomyVersionId === args.where?.taxonomyVersionId).length;
      },
      async createMany(args: any) {
        const data = Array.isArray(args.data) ? args.data : [args.data];

        for (const row of data) {
          terms.push({
            id: `term_${termSequence++}`,
            taxonomyVersionId: row.taxonomyVersionId,
            taxonomyId: row.taxonomyId,
            kind: row.kind,
            term: row.term,
            normalizedTerm: row.normalizedTerm,
            createdAt: new Date(),
          });
        }

        return { count: data.length };
      },
      async findMany(args: any) {
        const matches = terms.filter((term) => {
          const inVersion = term.taxonomyVersionId === args.where?.taxonomyVersionId;
          const contains = args.where?.normalizedTerm?.contains?.toLowerCase() ?? "";

          return inVersion && term.normalizedTerm.includes(contains);
        });

        return matches.slice(0, args.take ?? matches.length).flatMap((term) => {
          const category = categories.find(
            (candidate) =>
              candidate.taxonomyVersionId === term.taxonomyVersionId &&
              candidate.taxonomyId === term.taxonomyId,
          );
          const version = versions.find((entry) => entry.id === term.taxonomyVersionId);

          if (!category || !version) {
            return [];
          }

          return [{ ...term, category: { ...category, taxonomyVersion: version } }];
        });
      },
    },
    async $transaction(queries: Promise<unknown>[]) {
      return Promise.all(queries);
    },
  } as unknown as TaxonomySeedDatabaseClient & TaxonomyLookupDatabaseClient;
}

describe("phase 2 taxonomy and schema contracts", () => {
  let database: TaxonomySeedDatabaseClient & TaxonomyLookupDatabaseClient;

  beforeEach(() => {
    database = createInMemoryTaxonomyDatabase();
  });

  it("seeds the bootstrap taxonomy snapshot idempotently", async () => {
    const firstSeed = await seedTaxonomySnapshot(shopifyTaxonomyBootstrapSnapshot, database);
    const secondSeed = await seedTaxonomySnapshot(shopifyTaxonomyBootstrapSnapshot, database);

    expect(firstSeed.created).toBe(true);
    expect(firstSeed.categoryCount).toBe(shopifyTaxonomyBootstrapSnapshot.categories.length);
    expect(firstSeed.termCount).toBeGreaterThan(firstSeed.categoryCount);
    expect(secondSeed.created).toBe(false);
    expect(secondSeed.categoryCount).toBe(firstSeed.categoryCount);
    expect(secondSeed.termCount).toBe(firstSeed.termCount);
  });

  it("finds taxonomy categories by stable taxonomy id", async () => {
    await seedTaxonomySnapshot(shopifyTaxonomyBootstrapSnapshot, database);

    const category = await findTaxonomyCategoryById("hb-1-9-6", {}, database);

    expect(category).toMatchObject({
      taxonomyId: "hb-1-9-6",
      name: "Vitamins & Supplements",
      fullPath:
        "Health & Beauty > Health Care > Nutrition & Supplements > Vitamins & Supplements",
    });
  });

  it("finds taxonomy categories by exact path", async () => {
    await seedTaxonomySnapshot(shopifyTaxonomyBootstrapSnapshot, database);

    const category = await findTaxonomyCategoryByPath(
      "Media > Books > Print Books",
      {},
      database,
    );

    expect(category).toMatchObject({
      taxonomyId: "me-1-3",
      name: "Print Books",
    });
  });

  it("searches taxonomy categories by keyword and alias", async () => {
    await seedTaxonomySnapshot(shopifyTaxonomyBootstrapSnapshot, database);

    const matches = await searchTaxonomyCategories("beanie", { limit: 5 }, database);

    expect(matches[0]).toMatchObject({
      taxonomyId: "aa-2-17",
      name: "Hats",
      matchedTerms: ["beanie"],
    });
  });

  it("records the phase 2 migration as a rename plus new data foundation tables", async () => {
    const migration = await readFile(
      resolve(
        "/Users/lj/projects/categoryfix/packages/db/prisma/migrations/20260331153000_phase2_data_foundation/migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain('ALTER TABLE "ShopInstallation" RENAME TO "Shop";');
    expect(migration).toContain('CREATE TABLE "ScanFinding"');
    expect(migration).toContain('CREATE TABLE "TaxonomyCategoryTerm"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "TaxonomyVersion_version_locale_key" ON "TaxonomyVersion"("version", "locale");',
    );
  });

  it("stores normalized evidence and explanation fields without raw product payload columns", async () => {
    const schema = await readFile(
      resolve("/Users/lj/projects/categoryfix/packages/db/prisma/schema.prisma"),
      "utf8",
    );

    expect(schema).toContain("evidence               Json");
    expect(schema).toContain("explanation            Json");
    expect(schema).not.toContain("rawProductPayload");
    expect(schema).not.toContain("rawShopifyProduct");
  });
});
