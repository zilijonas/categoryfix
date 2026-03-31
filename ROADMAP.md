# CategoryFix Roadmap

## Execution order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8
10. Phase 9

## Parallelizable work

- Phase 8 can begin after Phase 0 once architecture and core messaging are stable.
- Legal and support content inside Phase 8 can run in parallel with late Phase 5 and Phase 6.
- Some observability work from Phase 9 can start during Phase 6.

## Mandatory human review gates

- after Phase 0
- after Phase 2
- before Phase 5 write-enabled implementation
- before Phase 7 AI integration
- before Phase 9 submission work

## Deferred items

- merchant-facing Google taxonomy support
- billing integration
- feed diagnostics beyond category correction
- advanced ML ranking or autonomous categorization
- multi-user permissions and team analytics

---

## Phase 0 — Foundation and Governance

Objective: establish the monorepo, rule system, documentation baseline, and non-negotiable conventions.

Scope:

- workspace setup
- root configs
- `.codex` rules and roles
- docs skeleton
- CI skeleton
- environment naming conventions

Key deliverables:

- `pnpm-workspace.yaml`
- root TypeScript, lint, formatter, and test config
- governance files from this plan
- docs templates
- basic CI that validates repository structure

Dependencies:

- none

Technical notes:

- no product code beyond scaffolding
- no Shopify runtime yet

Risks:

- adding unnecessary tooling too early
- unclear conventions that future agents interpret differently

Definition of done:

- fresh clone has a coherent monorepo structure
- root scripts are documented
- governance docs exist and are internally consistent

Review with me before proceeding:

- monorepo layout
- toolchain choice
- naming conventions

---

## Phase 1 — Shopify Shell and Auth Baseline

Objective: get a production-credible embedded Shopify shell running with correct auth and webhook foundations.

Scope:

- Shopify React Router scaffold
- Fly deploy baseline
- App Bridge integration
- Polaris Web Components baseline
- Prisma wired to PostgreSQL
- install flow
- session token handling
- mandatory webhook handlers
- `app/uninstalled` cleanup path

Key deliverables:

- installable dev-store app
- offline session persistence
- webhook signature verification
- shop settings and health endpoints

Dependencies:

- Phase 0

Technical notes:

- use Shopify-managed installation and token exchange
- keep scopes to `read_products` and `write_products`

Risks:

- custom auth drift from Shopify expectations
- weak webhook verification

Definition of done:

- app installs on a dev store
- embedded route loads inside admin
- session-token-authenticated requests work
- mandatory webhooks respond correctly

Review with me before proceeding:

- hostnames
- scopes
- auth and session architecture

---

## Phase 2 — Data Foundation and Taxonomy Reference

Objective: create the durable data model and local taxonomy reference needed for deterministic categorization.

Scope:

- Prisma schema
- migrations
- taxonomy data package
- import or seed pipeline
- audit model
- future billing placeholders

Key deliverables:

- tables for shops, sessions, scan runs, findings, overrides, rules, apply jobs, rollback jobs, audit events
- taxonomy search and lookup primitives
- data model ADR

Dependencies:

- Phase 1

Technical notes:

- store immutable scan artifacts
- keep billing as placeholders only: `shop_subscription` and `billing_event` tables may exist but remain inactive

Risks:

- over-copying product data
- insufficient audit fields for rollback

Definition of done:

- schema migrated cleanly
- taxonomy can be queried locally by ID, path, and keyword
- precedence and retention rules are documented

Review with me before proceeding:

- schema shape
- retention strategy
- future billing placeholders

---

## Phase 3 — Deterministic Scan Engine

Objective: scan products and generate explainable deterministic recommendations.

Scope:

- bulk product read pipeline
- normalized product signals
- rule engine
- reason generation
- confidence label assignment
- scan result persistence

Key deliverables:

- scan job runner
- deterministic matching rules
- recommendation items with explanation payloads
- scan status and error states

Dependencies:

- Phase 2

Technical notes:

- start with title, product type, vendor, tags, collections if available, and existing category state
- do not add AI yet
- use bulk query operations for catalog reads

Risks:

- low-quality rules that appear more certain than they are
- scan latency for large catalogs

Definition of done:

- scans complete on seeded dev data and large test catalogs
- every recommendation has source basis and confidence label
- `no safe suggestion` is supported

Review with me before proceeding:

- deterministic rule set
- recommendation labels
- explanation format

---

## Phase 4 — Merchant Review UX

Objective: let merchants safely inspect and select recommendations before any write occurs.

Scope:

- dashboard
- scan history
- findings table
- detail drawer
- filter and selection controls
- preview counts
- empty and partial-failure states

Key deliverables:

- embedded review workflow
- bulk-select rules for safe deterministic items
- clear basis display and uncertainty messaging

Dependencies:

- Phase 3

Technical notes:

- do not expose raw taxonomy structure unless the merchant asks for more detail
- keep information density high but readable

Risks:

- overwhelming merchants with taxonomy complexity
- unclear difference between suggestion and applied state

Definition of done:

- merchant can understand why an item was flagged
- merchant can prepare a safe apply selection without ambiguity

Review with me before proceeding:

- UI copy
- confidence labels
- preview experience

---

## Phase 5 — Apply, Audit, and Rollback

Objective: make category changes safely and reversibly.

Scope:

- apply jobs
- per-item write execution
- retry and idempotency
- rollback jobs
- audit timeline
- post-apply summaries

Key deliverables:

- queued `productSet` writes
- per-item result capture
- rollback based on stored `before` values
- explicit apply and rollback UI

Dependencies:

- Phase 4

Technical notes:

- default bulk apply includes only exact and strong deterministic matches
- AI-assisted suggestions are excluded
- use bounded concurrency and retry-safe job design

Risks:

- partial writes
- stale data between review and apply

Definition of done:

- apply works on dev stores
- partial failure handling is visible and recoverable
- rollback restores prior category state for supported cases

Review with me before proceeding:

- write safeguards
- rollback behavior
- partial failure UX

---

## Phase 6 — Background Jobs and Incremental Freshness

Objective: keep results fresh and operationally reliable without manual rescans for every change.

Scope:

- Postgres-backed worker
- product change webhooks
- rescan scheduling
- dead-letter or failure recovery path
- operational job views

Key deliverables:

- worker process on Fly
- idempotent webhook ingestion
- incremental invalidation and rescan logic
- retry and backoff policy

Dependencies:

- Phase 5

Technical notes:

- begin with `products/create`, `products/update`, and `products/delete`, then expand only if needed
- no Redis unless proven necessary

Risks:

- duplicate webhook events
- race conditions between merchant edits and app jobs

Definition of done:

- product changes reliably update affected findings
- job retries do not create duplicate writes or duplicate findings

Review with me before proceeding:

- queue model
- retry policy
- webhook event coverage

---

## Phase 7 — Assistive AI Layer

Objective: add tightly constrained AI assistance without weakening deterministic trust guarantees.

Scope:

- explanation refinement
- low-confidence fallback candidate generation
- provenance storage
- feature flagging
- merchant disclosure copy

Key deliverables:

- server-side OpenAI integration
- audit fields for model and prompt version
- UI labels for AI-assisted items
- safe failure fallback to deterministic-only mode

Dependencies:

- Phase 6

Technical notes:

- use AI only after deterministic engine exists
- do not auto-apply AI-only recommendations
- prefer the official OpenAI SDK unless `@ai-sdk` clearly reduces complexity for backend orchestration

Risks:

- overclaiming certainty
- sending more product data than necessary

Definition of done:

- AI suggestions are visibly labeled
- deterministic mode still works if AI is disabled or unavailable
- prompts and disclosure text are documented

Review with me before proceeding:

- exact AI use cases
- disclosure wording
- data sent to the model

---

## Phase 8 — Marketing Site, Docs, and Compliance Surfaces

Objective: create the public-facing site and required compliance and support assets.

Scope:

- Astro marketing site
- domain wiring
- legal pages
- support page
- product documentation
- beta signup or contact flow
- submission asset placeholders

Key deliverables:

- `categoryfix.com`
- privacy policy URL
- terms URL
- support URL
- product explainer pages
- closed-beta landing flow

Dependencies:

- Phase 0 for structure
- Phase 4 for accurate product messaging

Technical notes:

- do not use GitHub Pages for production SaaS hosting
- keep claims aligned with actual product capabilities

Risks:

- marketing promises exceeding deterministic reality
- missing URLs required for app review

Definition of done:

- public site is live
- core legal and support URLs are stable
- all product claims match implemented behavior

Review with me before proceeding:

- positioning
- claims
- legal and support content

---

## Phase 9 — Production Hardening and Shopify Submission Readiness

Objective: make the product ready for deployment, closed beta expansion, and Shopify review.

Scope:

- CI and CD hardening
- staging and production config
- Sentry and structured logging
- backup and restore runbooks
- load and failure testing
- app listing readiness
- review checklist
- limited-visibility launch prep

Key deliverables:

- release checklist
- deploy and rollback runbooks
- exception reporting
- smoke tests
- submission asset checklist
- production-readiness signoff doc

Dependencies:

- Phases 1 through 8

Technical notes:

- limited visibility is still a public-app path and still requires App Store review
- verify all compliance webhooks, privacy URLs, and session-token behavior before submission

Risks:

- last-minute review blockers
- weak operational readiness despite feature completeness

Definition of done:

- core merchant workflow passes end-to-end in staging
- logs and errors are observable
- restore and rollback procedures are documented and tested
- app listing prerequisites are complete
- only deployment and Shopify submission remain

Review with me before proceeding:

- final submission checklist
- pricing and billing posture
- launch readiness decision
