export type TaxonomySnapshotTermKind = "PRIMARY_NAME" | "KEYWORD" | "ALIAS" | "PATH";

export interface TaxonomySnapshotTermInput {
  kind: TaxonomySnapshotTermKind;
  term: string;
}

export interface TaxonomySnapshotCategoryInput {
  taxonomyId: string;
  taxonomyGid: string;
  name: string;
  fullPath: string;
  parentTaxonomyId?: string;
  level: number;
  isLeaf: boolean;
  terms?: TaxonomySnapshotTermInput[];
}

export interface TaxonomySnapshotInput {
  version: string;
  locale: string;
  source: string;
  sourceUrl: string;
  releasedAt: string;
  categories: TaxonomySnapshotCategoryInput[];
}

export const SHOPIFY_TAXONOMY_RELEASE = "2026-02";
export const SHOPIFY_TAXONOMY_RELEASED_AT = "2026-02-24T00:00:00.000Z";
export const SHOPIFY_TAXONOMY_SOURCE_URL =
  "https://github.com/Shopify/product-taxonomy/releases/tag/2026-02";

export function toShopifyTaxonomyGid(taxonomyId: string): string {
  return `gid://shopify/TaxonomyCategory/${taxonomyId}`;
}

export const shopifyTaxonomyBootstrapSnapshot: TaxonomySnapshotInput = {
  version: SHOPIFY_TAXONOMY_RELEASE,
  locale: "en",
  source: "shopify-standard-product-taxonomy-bootstrap",
  sourceUrl: SHOPIFY_TAXONOMY_SOURCE_URL,
  releasedAt: SHOPIFY_TAXONOMY_RELEASED_AT,
  categories: [
    {
      taxonomyId: "me",
      taxonomyGid: toShopifyTaxonomyGid("me"),
      name: "Media",
      fullPath: "Media",
      level: 0,
      isLeaf: false,
      terms: [{ kind: "KEYWORD", term: "media" }],
    },
    {
      taxonomyId: "me-1",
      taxonomyGid: toShopifyTaxonomyGid("me-1"),
      name: "Books",
      fullPath: "Media > Books",
      parentTaxonomyId: "me",
      level: 1,
      isLeaf: false,
      terms: [{ kind: "KEYWORD", term: "books" }],
    },
    {
      taxonomyId: "me-1-3",
      taxonomyGid: toShopifyTaxonomyGid("me-1-3"),
      name: "Print Books",
      fullPath: "Media > Books > Print Books",
      parentTaxonomyId: "me-1",
      level: 2,
      isLeaf: true,
      terms: [
        { kind: "KEYWORD", term: "book" },
        { kind: "ALIAS", term: "paperback" },
        { kind: "ALIAS", term: "hardcover" },
      ],
    },
    {
      taxonomyId: "hb",
      taxonomyGid: toShopifyTaxonomyGid("hb"),
      name: "Health & Beauty",
      fullPath: "Health & Beauty",
      level: 0,
      isLeaf: false,
      terms: [{ kind: "KEYWORD", term: "health and beauty" }],
    },
    {
      taxonomyId: "hb-1",
      taxonomyGid: toShopifyTaxonomyGid("hb-1"),
      name: "Health Care",
      fullPath: "Health & Beauty > Health Care",
      parentTaxonomyId: "hb",
      level: 1,
      isLeaf: false,
      terms: [{ kind: "KEYWORD", term: "health care" }],
    },
    {
      taxonomyId: "hb-1-9",
      taxonomyGid: toShopifyTaxonomyGid("hb-1-9"),
      name: "Nutrition & Supplements",
      fullPath: "Health & Beauty > Health Care > Nutrition & Supplements",
      parentTaxonomyId: "hb-1",
      level: 2,
      isLeaf: false,
      terms: [
        { kind: "KEYWORD", term: "nutrition" },
        { kind: "KEYWORD", term: "supplements" },
      ],
    },
    {
      taxonomyId: "hb-1-9-6",
      taxonomyGid: toShopifyTaxonomyGid("hb-1-9-6"),
      name: "Vitamins & Supplements",
      fullPath: "Health & Beauty > Health Care > Nutrition & Supplements > Vitamins & Supplements",
      parentTaxonomyId: "hb-1-9",
      level: 3,
      isLeaf: true,
      terms: [
        { kind: "KEYWORD", term: "vitamins" },
        { kind: "KEYWORD", term: "vitamins and supplements" },
        { kind: "ALIAS", term: "dietary supplements" },
      ],
    },
    {
      taxonomyId: "aa",
      taxonomyGid: toShopifyTaxonomyGid("aa"),
      name: "Apparel & Accessories",
      fullPath: "Apparel & Accessories",
      level: 0,
      isLeaf: false,
      terms: [{ kind: "KEYWORD", term: "apparel" }],
    },
    {
      taxonomyId: "aa-2",
      taxonomyGid: toShopifyTaxonomyGid("aa-2"),
      name: "Clothing Accessories",
      fullPath: "Apparel & Accessories > Clothing Accessories",
      parentTaxonomyId: "aa",
      level: 1,
      isLeaf: false,
      terms: [{ kind: "KEYWORD", term: "accessories" }],
    },
    {
      taxonomyId: "aa-2-17",
      taxonomyGid: toShopifyTaxonomyGid("aa-2-17"),
      name: "Hats",
      fullPath: "Apparel & Accessories > Clothing Accessories > Hats",
      parentTaxonomyId: "aa-2",
      level: 2,
      isLeaf: true,
      terms: [
        { kind: "KEYWORD", term: "hat" },
        { kind: "ALIAS", term: "cap" },
        { kind: "ALIAS", term: "beanie" },
        { kind: "ALIAS", term: "headwear" },
      ],
    },
  ],
};
