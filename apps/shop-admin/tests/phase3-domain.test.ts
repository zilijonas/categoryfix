import { describe, expect, it } from "vitest";
import {
  evaluateDeterministicRecommendation,
  normalizeProductSignals,
  type DeterministicTaxonomyReference,
} from "@categoryfix/domain";
import { shopifyTaxonomyBootstrapSnapshot } from "../../../packages/taxonomy-data/src/snapshot.js";

function buildTaxonomyReference(): DeterministicTaxonomyReference {
  const categories = shopifyTaxonomyBootstrapSnapshot.categories.map((category) => ({
    taxonomyId: category.taxonomyId,
    taxonomyGid: category.taxonomyGid,
    name: category.name,
    fullPath: category.fullPath,
    isLeaf: category.isLeaf,
  }));
  const terms = shopifyTaxonomyBootstrapSnapshot.categories.flatMap((category) => {
    const baseTerms = [
      { term: category.name, normalizedTerm: category.name.trim().toLowerCase().replace(/\s+/g, " ") },
      { term: category.fullPath, normalizedTerm: category.fullPath.trim().toLowerCase().replace(/\s+/g, " ") },
      ...(category.terms ?? []).map((term) => ({
        term: term.term,
        normalizedTerm: term.term.trim().toLowerCase().replace(/\s+/g, " "),
      })),
    ];

    return baseTerms.map((term) => ({
      taxonomyId: category.taxonomyId,
      term: term.term,
      normalizedTerm: term.normalizedTerm,
      kind: "TERM",
      category: {
        taxonomyId: category.taxonomyId,
        taxonomyGid: category.taxonomyGid,
        name: category.name,
        fullPath: category.fullPath,
        isLeaf: category.isLeaf,
      },
    }));
  });

  return { categories, terms };
}

describe("phase 3 deterministic rule engine", () => {
  const taxonomy = buildTaxonomyReference();

  it("normalizes catalog signals conservatively", () => {
    const normalized = normalizeProductSignals({
      productId: "100",
      productGid: "gid://shopify/Product/100",
      title: "  Winter   Beanie  ",
      productType: "  Beanie ",
      vendor: "  Cozy Co ",
      tags: [" Warm  Hat "],
      collections: [" Winter  Hats "],
    });

    expect(normalized.titleNormalized).toBe("winter beanie");
    expect(normalized.productTypeNormalized).toBe("beanie");
    expect(normalized.tagsNormalized).toEqual(["warm hat"]);
    expect(normalized.collectionsNormalized).toEqual(["winter hats"]);
  });

  it("returns EXACT for product type taxonomy path matches", () => {
    const recommendation = evaluateDeterministicRecommendation({
      taxonomy,
      product: {
        productId: "101",
        productGid: "gid://shopify/Product/101",
        title: "Classic novel",
        productType: "Media > Books > Print Books",
      },
    });

    expect(recommendation.decision).toBe("EXACT");
    expect(recommendation.recommendedCategory?.taxonomyId).toBe("me-1-3");
    expect(recommendation.explanation.ruleKey).toBe("product_type_exact_path_or_id");
  });

  it("returns STRONG for a unique exact product type term", () => {
    const recommendation = evaluateDeterministicRecommendation({
      taxonomy,
      product: {
        productId: "102",
        productGid: "gid://shopify/Product/102",
        title: "Cozy winter cap",
        productType: "beanie",
      },
    });

    expect(recommendation.decision).toBe("STRONG");
    expect(recommendation.recommendedCategory?.taxonomyId).toBe("aa-2-17");
    expect(recommendation.explanation.ruleKey).toBe("unique_exact_term_from_product_type");
  });

  it("returns STRONG for multi-signal consensus", () => {
    const recommendation = evaluateDeterministicRecommendation({
      taxonomy,
      product: {
        productId: "103",
        productGid: "gid://shopify/Product/103",
        title: "Soft beanie for winter",
        tags: ["beanie"],
      },
    });

    expect(recommendation.decision).toBe("STRONG");
    expect(recommendation.recommendedCategory?.taxonomyId).toBe("aa-2-17");
    expect(recommendation.explanation.ruleKey).toBe("multi_signal_consensus");
  });

  it("returns REVIEW_REQUIRED for a single unique title match", () => {
    const recommendation = evaluateDeterministicRecommendation({
      taxonomy,
      product: {
        productId: "104",
        productGid: "gid://shopify/Product/104",
        title: "Paperback adventure novel",
      },
    });

    expect(recommendation.decision).toBe("REVIEW_REQUIRED");
    expect(recommendation.recommendedCategory?.taxonomyId).toBe("me-1-3");
  });

  it("degrades to NO_SAFE_SUGGESTION for conflicting signals", () => {
    const recommendation = evaluateDeterministicRecommendation({
      taxonomy,
      product: {
        productId: "105",
        productGid: "gid://shopify/Product/105",
        title: "Soft beanie for winter",
        tags: ["vitamins"],
      },
    });

    expect(recommendation.decision).toBe("NO_SAFE_SUGGESTION");
    expect(recommendation.explanation.blockers[0]?.type).toBe("conflicting_leaf_matches");
  });

  it("degrades to NO_SAFE_SUGGESTION for active manual overrides", () => {
    const recommendation = evaluateDeterministicRecommendation({
      taxonomy,
      hasActiveManualOverride: true,
      product: {
        productId: "106",
        productGid: "gid://shopify/Product/106",
        title: "Soft beanie for winter",
        productType: "beanie",
      },
    });

    expect(recommendation.decision).toBe("NO_SAFE_SUGGESTION");
    expect(recommendation.explanation.ruleKey).toBe("manual_override_active");
  });

  it("degrades to NO_SAFE_SUGGESTION when deterministic matches agree with the current category", () => {
    const recommendation = evaluateDeterministicRecommendation({
      taxonomy,
      product: {
        productId: "107",
        productGid: "gid://shopify/Product/107",
        title: "Soft beanie for winter",
        productType: "beanie",
        currentCategory: {
          taxonomyId: "aa-2-17",
          taxonomyGid: "gid://shopify/TaxonomyCategory/aa-2-17",
          name: "Hats",
          fullPath: "Apparel & Accessories > Clothing Accessories > Hats",
        },
      },
    });

    expect(recommendation.decision).toBe("NO_SAFE_SUGGESTION");
    expect(recommendation.explanation.ruleKey).toBe("already_matches_current_category");
  });
});
