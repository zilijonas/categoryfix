import { describe, expect, it } from "vitest";
import {
  buildAssistiveShortlist,
  parseAssistiveSuggestion,
} from "../app/lib/ai-assist.server.js";

describe("phase 7 assistive AI helpers", () => {
  it("dedupes and caps shortlist candidates", async () => {
    const shortlist = await buildAssistiveShortlist({
      product: {
        title: "Hat Book Gift Set",
        productType: null,
        tags: ["hat", "book"],
        collections: [],
        currentCategory: null,
      },
      searchCategories: async (query) =>
        query.toLowerCase().includes("hat")
          ? [
              {
                version: "2026-01",
                locale: "en",
                taxonomyId: "aa-2-17",
                taxonomyGid: "gid://shopify/TaxonomyCategory/aa-2-17",
                name: "Hats",
                fullPath: "Apparel & Accessories > Clothing Accessories > Hats",
                parentTaxonomyId: "aa-2",
                level: 3,
                isLeaf: true,
                matchedTerms: ["hat"],
              },
              {
                version: "2026-01",
                locale: "en",
                taxonomyId: "aa-2-17",
                taxonomyGid: "gid://shopify/TaxonomyCategory/aa-2-17",
                name: "Hats",
                fullPath: "Apparel & Accessories > Clothing Accessories > Hats",
                parentTaxonomyId: "aa-2",
                level: 3,
                isLeaf: true,
                matchedTerms: ["hats"],
              },
            ]
          : query.toLowerCase().includes("book")
            ? [
              {
                version: "2026-01",
                locale: "en",
                taxonomyId: "me-1-3",
                taxonomyGid: "gid://shopify/TaxonomyCategory/me-1-3",
                name: "Print Books",
                fullPath: "Media > Books > Print Books",
                parentTaxonomyId: "me-1",
                level: 3,
                isLeaf: true,
                matchedTerms: ["book"],
              },
            ]
            : [],
      limit: 1,
    });

    expect(shortlist).toHaveLength(1);
    expect(shortlist[0]?.taxonomyId).toBe("aa-2-17");
  });

  it("rejects AI responses that point outside the shortlist", () => {
    const result = parseAssistiveSuggestion({
      parsed: {
        selectedTaxonomyId: "invalid",
        summary: "Best fit.",
        inputFieldsUsed: ["title"],
      },
      shortlist: [
        {
          version: "2026-01",
          locale: "en",
          taxonomyId: "aa-2-17",
          taxonomyGid: "gid://shopify/TaxonomyCategory/aa-2-17",
          name: "Hats",
          fullPath: "Apparel & Accessories > Clothing Accessories > Hats",
          parentTaxonomyId: "aa-2",
          level: 3,
          isLeaf: true,
          matchedTerms: ["hat"],
        },
      ],
      allowedInputFields: ["title"],
      model: "gpt-5.4-mini",
      promptVersion: "2026-04-01.phase7",
    });

    expect(result).toBeNull();
  });
});
