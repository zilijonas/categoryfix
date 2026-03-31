export type SignalSource =
  | "title"
  | "productType"
  | "vendor"
  | "tags"
  | "collections"
  | "currentCategory";

export type SignalMatchType = "EXACT_TAXONOMY_ID" | "EXACT_PATH" | "TERM";

export type DeterministicDecision =
  | "EXACT"
  | "STRONG"
  | "REVIEW_REQUIRED"
  | "NO_SAFE_SUGGESTION";

export interface ProductCategorySignal {
  taxonomyId: string | null;
  taxonomyGid: string | null;
  name: string | null;
  fullPath: string | null;
}

export interface ProductSignalsInput {
  productId: string;
  productGid: string;
  handle?: string | null;
  title: string;
  productType?: string | null;
  vendor?: string | null;
  tags?: readonly string[];
  collections?: readonly string[];
  currentCategory?: ProductCategorySignal | null;
}

export interface NormalizedProductSignals {
  productId: string;
  productGid: string;
  handle: string | null;
  title: string;
  titleNormalized: string;
  productType: string | null;
  productTypeNormalized: string | null;
  vendor: string | null;
  vendorNormalized: string | null;
  tags: string[];
  tagsNormalized: string[];
  collections: string[];
  collectionsNormalized: string[];
  currentCategory: ProductCategorySignal | null;
  currentCategoryNormalized: {
    taxonomyId: string | null;
    taxonomyGid: string | null;
    name: string | null;
    fullPath: string | null;
  } | null;
}

export interface TaxonomyLeafCategory {
  taxonomyId: string;
  taxonomyGid: string;
  name: string;
  fullPath: string;
  isLeaf: boolean;
}

export interface TaxonomyLeafTerm {
  taxonomyId: string;
  term: string;
  normalizedTerm: string;
  kind: string;
  category: TaxonomyLeafCategory;
}

export interface DeterministicTaxonomyReference {
  categories: readonly TaxonomyLeafCategory[];
  terms: readonly TaxonomyLeafTerm[];
}

export interface SignalMatch {
  source: SignalSource;
  rawValue: string;
  normalizedValue: string;
  matchedTerm: string;
  matchType: SignalMatchType;
  taxonomyId: string;
  taxonomyGid: string;
  taxonomyName: string;
  taxonomyFullPath: string;
}

export interface FindingEvidencePayload {
  title: string;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  collections: string[];
  currentCategory: ProductCategorySignal | null;
  normalized: {
    title: string;
    productType: string | null;
    vendor: string | null;
    tags: string[];
    collections: string[];
    currentCategory: {
      taxonomyId: string | null;
      taxonomyGid: string | null;
      name: string | null;
      fullPath: string | null;
    } | null;
  };
  matchedSignals: SignalMatch[];
}

export interface ExplanationBasisItem {
  source: SignalSource;
  rawValue: string;
  normalizedValue: string;
  matchType: SignalMatchType;
  matchedTerm: string;
  taxonomyId: string;
  taxonomyGid: string;
  taxonomyName: string;
  taxonomyFullPath: string;
}

export interface ExplanationBlockerItem {
  type:
    | "manual_override_active"
    | "already_matches_current_category"
    | "conflicting_leaf_matches"
    | "no_safe_match";
  message: string;
  taxonomyIds: string[];
}

export interface FindingExplanationPayload {
  ruleKey: string;
  ruleVersion: string;
  decision: DeterministicDecision;
  basis: ExplanationBasisItem[];
  blockers: ExplanationBlockerItem[];
}

export interface DeterministicRecommendation {
  decision: DeterministicDecision;
  recommendedCategory: TaxonomyLeafCategory | null;
  evidence: FindingEvidencePayload;
  explanation: FindingExplanationPayload;
}

export interface EvaluateDeterministicRecommendationInput {
  product: ProductSignalsInput;
  taxonomy: DeterministicTaxonomyReference;
  hasActiveManualOverride?: boolean;
}

export interface Phase3RuleDefinition {
  key: string;
  version: string;
  description: string;
  priority: number;
  configuration: {
    decision: DeterministicDecision;
    sources: SignalSource[];
  };
}

export const PHASE3_RULE_VERSION = "2026-03-31.phase3";

export const PHASE3_RULE_DEFINITIONS: readonly Phase3RuleDefinition[] = [
  {
    key: "manual_override_active",
    version: PHASE3_RULE_VERSION,
    description: "Suppress generated recommendations when an active manual override exists.",
    priority: 10,
    configuration: {
      decision: "NO_SAFE_SUGGESTION",
      sources: ["currentCategory"],
    },
  },
  {
    key: "already_matches_current_category",
    version: PHASE3_RULE_VERSION,
    description: "Suppress recommendations when deterministic matches agree with the current category.",
    priority: 20,
    configuration: {
      decision: "NO_SAFE_SUGGESTION",
      sources: ["productType", "title", "tags", "collections", "currentCategory"],
    },
  },
  {
    key: "product_type_exact_path_or_id",
    version: PHASE3_RULE_VERSION,
    description: "Promote exact product type taxonomy path or id matches to EXACT.",
    priority: 30,
    configuration: {
      decision: "EXACT",
      sources: ["productType"],
    },
  },
  {
    key: "unique_exact_term_from_product_type",
    version: PHASE3_RULE_VERSION,
    description: "Promote a unique exact product type term match to STRONG.",
    priority: 40,
    configuration: {
      decision: "STRONG",
      sources: ["productType"],
    },
  },
  {
    key: "multi_signal_consensus",
    version: PHASE3_RULE_VERSION,
    description: "Require title plus tags or collections agreement for strong consensus matches.",
    priority: 50,
    configuration: {
      decision: "STRONG",
      sources: ["title", "tags", "collections"],
    },
  },
  {
    key: "single_signal_unique_match",
    version: PHASE3_RULE_VERSION,
    description: "Allow unique title, tag, or collection matches only as review-required suggestions.",
    priority: 60,
    configuration: {
      decision: "REVIEW_REQUIRED",
      sources: ["title", "tags", "collections"],
    },
  },
] as const;

function normalizePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeList(values: readonly string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => normalizePhrase(value));
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function matchPhraseInText(text: string, phrase: string) {
  if (!text || !phrase) {
    return false;
  }

  if (text === phrase) {
    return true;
  }

  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");

  return pattern.test(text);
}

function createCategoryIndexes(reference: DeterministicTaxonomyReference) {
  const leafCategories = reference.categories.filter((category) => category.isLeaf);
  const byTaxonomyId = new Map<string, TaxonomyLeafCategory>();
  const byFullPath = new Map<string, TaxonomyLeafCategory>();
  const byNormalizedTerm = new Map<string, TaxonomyLeafTerm[]>();

  for (const category of leafCategories) {
    byTaxonomyId.set(category.taxonomyId, category);
    byFullPath.set(normalizePhrase(category.fullPath), category);
  }

  for (const term of reference.terms) {
    if (!term.category.isLeaf) {
      continue;
    }

    const bucket = byNormalizedTerm.get(term.normalizedTerm) ?? [];
    bucket.push(term);
    byNormalizedTerm.set(term.normalizedTerm, bucket);
  }

  return {
    byTaxonomyId,
    byFullPath,
    byNormalizedTerm,
  };
}

function toBasis(match: SignalMatch): ExplanationBasisItem {
  return {
    source: match.source,
    rawValue: match.rawValue,
    normalizedValue: match.normalizedValue,
    matchType: match.matchType,
    matchedTerm: match.matchedTerm,
    taxonomyId: match.taxonomyId,
    taxonomyGid: match.taxonomyGid,
    taxonomyName: match.taxonomyName,
    taxonomyFullPath: match.taxonomyFullPath,
  };
}

function buildNoSafeSuggestion(args: {
  ruleKey: string;
  evidence: FindingEvidencePayload;
  blockers: ExplanationBlockerItem[];
}): DeterministicRecommendation {
  return {
    decision: "NO_SAFE_SUGGESTION",
    recommendedCategory: null,
    evidence: args.evidence,
    explanation: {
      ruleKey: args.ruleKey,
      ruleVersion: PHASE3_RULE_VERSION,
      decision: "NO_SAFE_SUGGESTION",
      basis: [],
      blockers: args.blockers,
    },
  };
}

function buildRecommendation(args: {
  ruleKey: string;
  decision: Exclude<DeterministicDecision, "NO_SAFE_SUGGESTION">;
  category: TaxonomyLeafCategory;
  matches: readonly SignalMatch[];
  evidence: FindingEvidencePayload;
}): DeterministicRecommendation {
  return {
    decision: args.decision,
    recommendedCategory: args.category,
    evidence: args.evidence,
    explanation: {
      ruleKey: args.ruleKey,
      ruleVersion: PHASE3_RULE_VERSION,
      decision: args.decision,
      basis: args.matches.map(toBasis),
      blockers: [],
    },
  };
}

function collectSourceMatches(args: {
  source: Exclude<SignalSource, "vendor" | "currentCategory">;
  rawValues: readonly string[];
  normalizedValues: readonly string[];
  terms: readonly TaxonomyLeafTerm[];
}) {
  const matches: SignalMatch[] = [];

  for (let index = 0; index < args.normalizedValues.length; index += 1) {
    const normalizedValue = args.normalizedValues[index];
    const rawValue = args.rawValues[index] ?? args.rawValues[0] ?? "";

    if (!normalizedValue) {
      continue;
    }

    for (const term of args.terms) {
      if (
        normalizedValue === term.normalizedTerm ||
        (args.source === "title" || args.source === "collections"
          ? matchPhraseInText(normalizedValue, term.normalizedTerm)
          : false)
      ) {
        matches.push({
          source: args.source,
          rawValue,
          normalizedValue,
          matchedTerm: term.term,
          matchType: "TERM",
          taxonomyId: term.category.taxonomyId,
          taxonomyGid: term.category.taxonomyGid,
          taxonomyName: term.category.name,
          taxonomyFullPath: term.category.fullPath,
        });
      }
    }
  }

  return matches;
}

function uniqueMatches(matches: readonly SignalMatch[]) {
  const seen = new Map<string, SignalMatch>();

  for (const match of matches) {
    const key = [
      match.source,
      match.matchType,
      match.taxonomyId,
      match.normalizedValue,
      match.matchedTerm,
    ].join(":");

    if (!seen.has(key)) {
      seen.set(key, match);
    }
  }

  return [...seen.values()];
}

function uniqueCategoryIds(matches: readonly SignalMatch[]) {
  return unique(matches.map((match) => match.taxonomyId));
}

function categoryFromMatches(
  matches: readonly SignalMatch[],
  byTaxonomyId: Map<string, TaxonomyLeafCategory>,
) {
  const categoryIds = uniqueCategoryIds(matches);
  const [categoryId] = categoryIds;

  if (categoryIds.length !== 1 || !categoryId) {
    return null;
  }

  return byTaxonomyId.get(categoryId) ?? null;
}

export function normalizeProductSignals(input: ProductSignalsInput): NormalizedProductSignals {
  const title = input.title.trim();
  const productType = input.productType?.trim() ?? null;
  const vendor = input.vendor?.trim() ?? null;
  const tags = input.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
  const collections =
    input.collections?.map((collection) => collection.trim()).filter(Boolean) ?? [];

  return {
    productId: input.productId,
    productGid: input.productGid,
    handle: input.handle?.trim() ?? null,
    title,
    titleNormalized: normalizePhrase(title),
    productType,
    productTypeNormalized: productType ? normalizePhrase(productType) : null,
    vendor,
    vendorNormalized: vendor ? normalizePhrase(vendor) : null,
    tags,
    tagsNormalized: normalizeList(tags),
    collections,
    collectionsNormalized: normalizeList(collections),
    currentCategory: input.currentCategory ?? null,
    currentCategoryNormalized: input.currentCategory
      ? {
          taxonomyId: input.currentCategory.taxonomyId
            ? normalizePhrase(input.currentCategory.taxonomyId)
            : null,
          taxonomyGid: input.currentCategory.taxonomyGid ?? null,
          name: input.currentCategory.name ? normalizePhrase(input.currentCategory.name) : null,
          fullPath: input.currentCategory.fullPath
            ? normalizePhrase(input.currentCategory.fullPath)
            : null,
        }
      : null,
  };
}

export function evaluateDeterministicRecommendation(
  input: EvaluateDeterministicRecommendationInput,
): DeterministicRecommendation {
  const normalized = normalizeProductSignals(input.product);
  const indexes = createCategoryIndexes(input.taxonomy);
  const productTypeNormalized = normalized.productTypeNormalized ?? "";
  const currentCategoryById = normalized.currentCategoryNormalized?.taxonomyId
    ? indexes.byTaxonomyId.get(normalized.currentCategoryNormalized.taxonomyId)
    : null;
  const currentCategoryByPath = normalized.currentCategoryNormalized?.fullPath
    ? indexes.byFullPath.get(normalized.currentCategoryNormalized.fullPath)
    : null;
  const currentCategory = currentCategoryById ?? currentCategoryByPath ?? null;

  const exactProductTypeMatches = uniqueMatches(
    indexes.byTaxonomyId.has(productTypeNormalized)
      ? [
          {
            source: "productType",
            rawValue: normalized.productType ?? "",
            normalizedValue: productTypeNormalized,
            matchedTerm: normalized.productType ?? "",
            matchType: "EXACT_TAXONOMY_ID",
            taxonomyId: productTypeNormalized,
            taxonomyGid: indexes.byTaxonomyId.get(productTypeNormalized)?.taxonomyGid ?? "",
            taxonomyName: indexes.byTaxonomyId.get(productTypeNormalized)?.name ?? "",
            taxonomyFullPath: indexes.byTaxonomyId.get(productTypeNormalized)?.fullPath ?? "",
          } satisfies SignalMatch,
        ]
      : [],
  ).concat(
    indexes.byFullPath.has(productTypeNormalized)
      ? [
          {
            source: "productType",
            rawValue: normalized.productType ?? "",
            normalizedValue: productTypeNormalized,
            matchedTerm: normalized.productType ?? "",
            matchType: "EXACT_PATH",
            taxonomyId: indexes.byFullPath.get(productTypeNormalized)?.taxonomyId ?? "",
            taxonomyGid: indexes.byFullPath.get(productTypeNormalized)?.taxonomyGid ?? "",
            taxonomyName: indexes.byFullPath.get(productTypeNormalized)?.name ?? "",
            taxonomyFullPath: indexes.byFullPath.get(productTypeNormalized)?.fullPath ?? "",
          } satisfies SignalMatch,
        ]
      : [],
  );

  const productTypeTermMatches = uniqueMatches(
    collectSourceMatches({
      source: "productType",
      rawValues: normalized.productType ? [normalized.productType] : [],
      normalizedValues: normalized.productTypeNormalized ? [normalized.productTypeNormalized] : [],
      terms: input.taxonomy.terms,
    }),
  );

  const titleMatches = uniqueMatches(
    collectSourceMatches({
      source: "title",
      rawValues: [normalized.title],
      normalizedValues: [normalized.titleNormalized],
      terms: input.taxonomy.terms,
    }),
  );

  const tagMatches = uniqueMatches(
    collectSourceMatches({
      source: "tags",
      rawValues: normalized.tags,
      normalizedValues: normalized.tagsNormalized,
      terms: input.taxonomy.terms,
    }),
  );

  const collectionMatches = uniqueMatches(
    collectSourceMatches({
      source: "collections",
      rawValues: normalized.collections,
      normalizedValues: normalized.collectionsNormalized,
      terms: input.taxonomy.terms,
    }),
  );

  const allMatches = uniqueMatches([
    ...exactProductTypeMatches,
    ...productTypeTermMatches,
    ...titleMatches,
    ...tagMatches,
    ...collectionMatches,
  ]);

  const evidence: FindingEvidencePayload = {
    title: normalized.title,
    productType: normalized.productType,
    vendor: normalized.vendor,
    tags: normalized.tags,
    collections: normalized.collections,
    currentCategory: normalized.currentCategory,
    normalized: {
      title: normalized.titleNormalized,
      productType: normalized.productTypeNormalized,
      vendor: normalized.vendorNormalized,
      tags: normalized.tagsNormalized,
      collections: normalized.collectionsNormalized,
      currentCategory: normalized.currentCategoryNormalized,
    },
    matchedSignals: allMatches,
  };

  if (input.hasActiveManualOverride) {
    return buildNoSafeSuggestion({
      ruleKey: "manual_override_active",
      evidence,
      blockers: [
        {
          type: "manual_override_active",
          message: "An active manual override exists for this product.",
          taxonomyIds: [],
        },
      ],
    });
  }

  const matchedCategoryIds = uniqueCategoryIds(allMatches);

  if (currentCategory && matchedCategoryIds.includes(currentCategory.taxonomyId)) {
    return buildNoSafeSuggestion({
      ruleKey: "already_matches_current_category",
      evidence,
      blockers: [
        {
          type: "already_matches_current_category",
          message: "Deterministic matches agree with the current category.",
          taxonomyIds: [currentCategory.taxonomyId],
        },
      ],
    });
  }

  if (matchedCategoryIds.length > 1) {
    return buildNoSafeSuggestion({
      ruleKey: "single_signal_unique_match",
      evidence,
      blockers: [
        {
          type: "conflicting_leaf_matches",
          message: "Signals matched multiple leaf taxonomy categories.",
          taxonomyIds: matchedCategoryIds,
        },
      ],
    });
  }

  const exactCategory = categoryFromMatches(exactProductTypeMatches, indexes.byTaxonomyId);

  if (exactCategory) {
    return buildRecommendation({
      ruleKey: "product_type_exact_path_or_id",
      decision: "EXACT",
      category: exactCategory,
      matches: exactProductTypeMatches,
      evidence,
    });
  }

  const productTypeCategory = categoryFromMatches(productTypeTermMatches, indexes.byTaxonomyId);

  if (productTypeCategory) {
    return buildRecommendation({
      ruleKey: "unique_exact_term_from_product_type",
      decision: "STRONG",
      category: productTypeCategory,
      matches: productTypeTermMatches,
      evidence,
    });
  }

  const consensusMatches = uniqueMatches(
    titleMatches.filter((titleMatch) =>
      [...tagMatches, ...collectionMatches].some(
        (secondaryMatch) => secondaryMatch.taxonomyId === titleMatch.taxonomyId,
      ),
    ),
  );
  const consensusCategory = categoryFromMatches(consensusMatches, indexes.byTaxonomyId);

  if (consensusCategory) {
    const supportingMatches = uniqueMatches([
      ...consensusMatches,
      ...tagMatches.filter((match) => match.taxonomyId === consensusCategory.taxonomyId),
      ...collectionMatches.filter((match) => match.taxonomyId === consensusCategory.taxonomyId),
    ]);

    return buildRecommendation({
      ruleKey: "multi_signal_consensus",
      decision: "STRONG",
      category: consensusCategory,
      matches: supportingMatches,
      evidence,
    });
  }

  const titleCategory = categoryFromMatches(titleMatches, indexes.byTaxonomyId);
  const tagCategory = categoryFromMatches(tagMatches, indexes.byTaxonomyId);
  const collectionCategory = categoryFromMatches(collectionMatches, indexes.byTaxonomyId);
  const singleSignalCategory = titleCategory ?? tagCategory ?? collectionCategory;

  if (singleSignalCategory) {
    const supportingMatches = uniqueMatches(
      [...titleMatches, ...tagMatches, ...collectionMatches].filter(
        (match) => match.taxonomyId === singleSignalCategory.taxonomyId,
      ),
    );

    return buildRecommendation({
      ruleKey: "single_signal_unique_match",
      decision: "REVIEW_REQUIRED",
      category: singleSignalCategory,
      matches: supportingMatches,
      evidence,
    });
  }

  return buildNoSafeSuggestion({
    ruleKey: "single_signal_unique_match",
    evidence,
    blockers: [
      {
        type: "no_safe_match",
        message: "No deterministic leaf match met the phase 3 safety threshold.",
        taxonomyIds: [],
      },
    ],
  });
}
