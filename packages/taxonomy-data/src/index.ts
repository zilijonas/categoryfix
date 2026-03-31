import {
  seedTaxonomySnapshot,
  type SeedTaxonomySnapshotResult,
  type TaxonomySeedDatabaseClient,
  type TaxonomyVersionSnapshotInput,
} from "@categoryfix/db";
import {
  SHOPIFY_TAXONOMY_RELEASE,
  SHOPIFY_TAXONOMY_RELEASED_AT,
  SHOPIFY_TAXONOMY_SOURCE_URL,
  shopifyTaxonomyBootstrapSnapshot,
  toShopifyTaxonomyGid,
} from "./snapshot.js";

export {
  SHOPIFY_TAXONOMY_RELEASE,
  SHOPIFY_TAXONOMY_RELEASED_AT,
  SHOPIFY_TAXONOMY_SOURCE_URL,
  shopifyTaxonomyBootstrapSnapshot,
  toShopifyTaxonomyGid,
};

export async function seedBootstrapTaxonomy(
  database: TaxonomySeedDatabaseClient,
): Promise<SeedTaxonomySnapshotResult> {
  return seedTaxonomySnapshot(
    shopifyTaxonomyBootstrapSnapshot as TaxonomyVersionSnapshotInput,
    database,
  );
}
