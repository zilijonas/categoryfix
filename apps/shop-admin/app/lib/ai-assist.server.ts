import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { TaxonomyCategoryLookup } from "@categoryfix/db";

export const PHASE7_AI_SOURCE = "phase7-ai-fallback";
export const PHASE7_AI_PROMPT_VERSION = "2026-04-01.phase7";
const OPENAI_PROVIDER = "openai";
const SHORTLIST_LIMIT = 8;
const AI_TIMEOUT_MS = 8000;

const enabledLiterals = new Set(["1", "true", "yes", "on"]);
const assistiveInputFieldSchema = z.enum([
  "title",
  "productType",
  "tags",
  "collections",
  "currentCategory",
]);

const assistiveSuggestionSchema = z.object({
  selectedTaxonomyId: z.string().min(1),
  summary: z.string().min(1).max(280),
  inputFieldsUsed: z.array(assistiveInputFieldSchema).min(1).max(5),
});

const envSchema = z.object({
  CATEGORYFIX_AI_ENABLED: z.string().optional(),
  CATEGORYFIX_OPENAI_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export interface AssistiveAiConfig {
  enabled: boolean;
  apiKey: string | null;
  model: string | null;
  promptVersion: string;
  timeoutMs: number;
}

export interface AssistiveAiProductContext {
  title: string;
  productType: string | null;
  tags: string[];
  collections: string[];
  currentCategory: {
    taxonomyId: string | null;
    name: string | null;
    fullPath: string | null;
  } | null;
}

export interface AssistiveTaxonomyTerm {
  term: string;
  normalizedTerm: string;
  category: {
    taxonomyId: string;
    taxonomyGid: string;
    name: string;
    fullPath: string;
    isLeaf: boolean;
  };
}

export interface AssistiveSuggestion {
  provider: typeof OPENAI_PROVIDER;
  model: string;
  promptVersion: string;
  recommendedCategory: TaxonomyCategoryLookup;
  summary: string;
  generatedAt: string;
  inputFields: Array<z.infer<typeof assistiveInputFieldSchema>>;
  shortlistCount: number;
}

export interface AssistiveAiService {
  config: AssistiveAiConfig;
  suggestFallback(args: {
    shop: string;
    product: AssistiveAiProductContext;
    shortlist: readonly TaxonomyCategoryLookup[];
  }): Promise<AssistiveSuggestion | null>;
}

function isEnabled(value: string | undefined) {
  if (!value) {
    return false;
  }

  return enabledLiterals.has(value.trim().toLowerCase());
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function tokenizeForSearch(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return normalizeWhitespace(value)
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildPrompt(args: {
  product: AssistiveAiProductContext;
  shortlist: readonly TaxonomyCategoryLookup[];
}) {
  return JSON.stringify(
    {
      task: "Pick the single best Shopify taxonomy category from the provided shortlist.",
      rules: [
        "Use only the provided product fields.",
        "Use only the provided shortlist candidates.",
        "Do not invent or modify taxonomy ids.",
        "Prefer concise merchant-safe language.",
        "Return the fields exactly as requested.",
      ],
      product: args.product,
      candidates: args.shortlist.map((candidate) => ({
        taxonomyId: candidate.taxonomyId,
        name: candidate.name,
        fullPath: candidate.fullPath,
        matchedTerms: candidate.matchedTerms,
      })),
    },
    null,
    2,
  );
}

export function parseAssistiveAiConfig(env: NodeJS.ProcessEnv): AssistiveAiConfig {
  const parsed = envSchema.parse(env);
  const enabled = isEnabled(parsed.CATEGORYFIX_AI_ENABLED);

  if (!enabled) {
    return {
      enabled: false,
      apiKey: null,
      model: null,
      promptVersion: PHASE7_AI_PROMPT_VERSION,
      timeoutMs: AI_TIMEOUT_MS,
    };
  }

  const apiKey = parsed.OPENAI_API_KEY?.trim();
  const model = parsed.CATEGORYFIX_OPENAI_MODEL?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when CATEGORYFIX_AI_ENABLED is enabled.");
  }

  if (!model) {
    throw new Error(
      "CATEGORYFIX_OPENAI_MODEL is required when CATEGORYFIX_AI_ENABLED is enabled.",
    );
  }

  return {
    enabled: true,
    apiKey,
    model,
    promptVersion: PHASE7_AI_PROMPT_VERSION,
    timeoutMs: AI_TIMEOUT_MS,
  };
}

export function buildAssistiveShortlist(args: {
  product: AssistiveAiProductContext;
  searchCategories: (query: string) => Promise<readonly TaxonomyCategoryLookup[]>;
  limit?: number;
}): Promise<TaxonomyCategoryLookup[]> {
  const limit = args.limit ?? SHORTLIST_LIMIT;
  const queries = unique(
    [
      args.product.title,
      args.product.productType,
      args.product.currentCategory?.name,
      args.product.currentCategory?.fullPath,
      ...tokenizeForSearch(args.product.title),
      ...tokenizeForSearch(args.product.productType),
      ...args.product.tags,
      ...args.product.collections,
    ]
      .filter((value): value is string => Boolean(value))
      .map(normalizeWhitespace)
      .filter((value) => value.length >= 2),
  );

  return (async () => {
    const shortlist = new Map<string, TaxonomyCategoryLookup>();

    for (const query of queries) {
      const matches = await args.searchCategories(query);

      for (const match of matches) {
        if (!match.isLeaf) {
          continue;
        }

        if (
          args.product.currentCategory?.taxonomyId &&
          match.taxonomyId === args.product.currentCategory.taxonomyId
        ) {
          continue;
        }

        shortlist.set(match.taxonomyId, match);

        if (shortlist.size >= limit) {
          return [...shortlist.values()].slice(0, limit);
        }
      }
    }

    return [...shortlist.values()].slice(0, limit);
  })();
}

export function buildAssistiveShortlistFromTerms(args: {
  product: AssistiveAiProductContext;
  taxonomyTerms: readonly AssistiveTaxonomyTerm[];
  limit?: number;
}): TaxonomyCategoryLookup[] {
  const limit = args.limit ?? SHORTLIST_LIMIT;
  const queries = unique(
    [
      args.product.title,
      args.product.productType,
      ...tokenizeForSearch(args.product.title),
      ...tokenizeForSearch(args.product.productType),
      ...args.product.tags,
      ...args.product.collections,
      args.product.currentCategory?.name,
      args.product.currentCategory?.fullPath,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeWhitespace(value).toLowerCase())
      .filter((value) => value.length >= 2),
  );
  const shortlist = new Map<string, TaxonomyCategoryLookup>();

  for (const query of queries) {
    for (const term of args.taxonomyTerms) {
      if (!term.category.isLeaf) {
        continue;
      }

      if (
        args.product.currentCategory?.taxonomyId &&
        term.category.taxonomyId === args.product.currentCategory.taxonomyId
      ) {
        continue;
      }

      if (
        !term.normalizedTerm.includes(query) &&
        !query.includes(term.normalizedTerm)
      ) {
        continue;
      }

      shortlist.set(term.category.taxonomyId, {
        version: "local",
        locale: "en",
        taxonomyId: term.category.taxonomyId,
        taxonomyGid: term.category.taxonomyGid,
        name: term.category.name,
        fullPath: term.category.fullPath,
        parentTaxonomyId: null,
        level: 0,
        isLeaf: term.category.isLeaf,
        matchedTerms: [term.term],
      });

      if (shortlist.size >= limit) {
        return [...shortlist.values()].slice(0, limit);
      }
    }
  }

  return [...shortlist.values()].slice(0, limit);
}

export function parseAssistiveSuggestion(args: {
  parsed: unknown;
  shortlist: readonly TaxonomyCategoryLookup[];
  allowedInputFields: readonly z.infer<typeof assistiveInputFieldSchema>[];
  model: string;
  promptVersion: string;
}): AssistiveSuggestion | null {
  const candidate = assistiveSuggestionSchema.parse(args.parsed);
  const recommendedCategory =
    args.shortlist.find((entry) => entry.taxonomyId === candidate.selectedTaxonomyId) ?? null;

  if (!recommendedCategory) {
    return null;
  }

  const inputFields = unique(candidate.inputFieldsUsed).filter((field) =>
    args.allowedInputFields.includes(field),
  );

  if (!inputFields.length) {
    return null;
  }

  return {
    provider: OPENAI_PROVIDER,
    model: args.model,
    promptVersion: args.promptVersion,
    recommendedCategory,
    summary: normalizeWhitespace(candidate.summary),
    generatedAt: new Date().toISOString(),
    inputFields,
    shortlistCount: args.shortlist.length,
  };
}

export function createAssistiveAiService(
  env: NodeJS.ProcessEnv = process.env,
): AssistiveAiService | null {
  const config = parseAssistiveAiConfig(env);

  if (!config.enabled || !config.apiKey || !config.model) {
    return null;
  }

  const client = new OpenAI({ apiKey: config.apiKey });
  const model = config.model;

  return {
    config,
    async suggestFallback(args) {
      if (!args.shortlist.length) {
        return null;
      }

      const allowedInputFields = unique(
        [
          "title",
          args.product.productType ? "productType" : null,
          args.product.tags.length ? "tags" : null,
          args.product.collections.length ? "collections" : null,
          args.product.currentCategory ? "currentCategory" : null,
        ].filter((value): value is z.infer<typeof assistiveInputFieldSchema> => Boolean(value)),
      );

      const response = await client.responses.parse(
        {
          model,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text:
                    "You help merchants review uncertain Shopify taxonomy suggestions. Pick exactly one category from the provided shortlist and explain it briefly without overstating certainty.",
                },
              ],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: buildPrompt(args) }],
            },
          ],
          text: {
            format: zodTextFormat(
              assistiveSuggestionSchema,
              "categoryfix_assistive_suggestion",
            ),
            verbosity: "low",
          },
        },
        {
          signal: AbortSignal.timeout(config.timeoutMs),
        },
      );

      if (!response.output_parsed) {
        return null;
      }

      return parseAssistiveSuggestion({
        parsed: response.output_parsed,
        shortlist: args.shortlist,
        allowedInputFields,
        model,
        promptVersion: config.promptVersion,
      });
    },
  };
}
