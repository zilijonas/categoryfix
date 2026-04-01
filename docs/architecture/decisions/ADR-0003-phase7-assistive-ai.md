# ADR-0003: Phase 7 Assistive AI Fallback

## Status

Accepted

## Context

Phase 6 made scan freshness reliable, but deterministic scanning still produces `NO_SAFE_SUGGESTION` findings that leave merchants without a candidate to review. Phase 7 adds tightly constrained AI assistance without weakening the deterministic trust model or making AI a prerequisite for product value.

Repository rules and roadmap constraints require that:

- AI remains optional and must never be the sole basis for an automatic category write
- AI-assisted suggestions are clearly labeled and excluded from default bulk apply
- only minimal product fields are sent to the model
- deterministic workflows continue normally if AI is disabled or unavailable
- provenance is stored for every persisted AI output

## Decision

- Keep deterministic evaluation as the first and primary scan pass for every product.
- Invoke OpenAI only for findings that would otherwise persist as `NO_SAFE_SUGGESTION`.
- Build a local shortlist of up to 8 taxonomy leaf candidates before the model call using existing taxonomy search helpers and limited product context.
- Send only title, product type, tags, collections, current category context, and the shortlist to the model. Exclude vendor in Phase 7.
- Accept AI output only when it selects a taxonomy ID from the supplied shortlist and returns structured output that matches the expected schema.
- Persist AI provenance directly on `ScanFinding` rows: provider, model, prompt version, generated timestamp, input fields used, shortlist count, and merchant-facing summary.
- Store successful AI fallback findings as `confidence = REVIEW_REQUIRED` and `source = phase7-ai-fallback`.
- Keep default apply behavior unchanged: only accepted deterministic exact/strong findings are included automatically. AI-assisted findings remain explicit opt-in selections.

## Consequences

- Merchants get reviewable fallback candidates for some previously unresolved products without giving AI autonomous write authority.
- Scan history remains immutable because AI assistance is stored on the same finding records rather than mutating prior runs.
- Provider outages, invalid responses, or config issues do not block scanning; the product falls back to deterministic-only behavior.
- The review UI gains extra disclosure and preview counts for AI-assisted items while preserving existing confidence/status workflows.

## Rejected alternatives

- Rewriting all merchant explanations with AI:
  This expands the trust surface too broadly for Phase 7 and makes deterministic explanations harder to audit.
- Allowing AI suggestions into default bulk apply:
  This weakens the deterministic trust guarantee and conflicts with the roadmap and UI trust rules.
- Sending broader product data such as vendor by default:
  This increases data exposure without enough evidence of material value for the first AI iteration.
