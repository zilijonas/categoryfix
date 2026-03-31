# ADR-0001: Phase 2 Data Foundation

## Status

Accepted

## Context

CategoryFix needs a durable, review-friendly data model before the scan engine and write paths are added. Phase 1 established Shopify auth, session persistence, and install lifecycle handling, but the repo still lacked a canonical shop record, immutable scan/apply/rollback structures, and a local taxonomy reference that could be queried without calling external services.

Phase 2 also needs to preserve the product trust rules:

- scan history must be immutable
- manual overrides must remain separate from generated recommendations
- rollback must be backed by stored before/after evidence
- taxonomy lookup must work locally by ID, path, and keyword
- billing must remain inactive in v1

## Decision

- Promote `Shop` to the canonical merchant anchor and migrate Phase 1 install state into that model.
- Keep `Session` as the Shopify auth/session persistence model rather than copying session data into `Shop`.
- Add immutable Phase 2 persistence primitives for `ScanRun`, `ScanFinding`, `ApplyJob`, `ApplyJobItem`, `RollbackJob`, `RollbackJobItem`, `ManualOverride`, and `AuditEvent`.
- Store evidence and explanation payloads for findings, but do not persist full raw Shopify product payload snapshots in Phase 2.
- Keep taxonomy source data in `packages/taxonomy-data` as a versioned committed snapshot, then seed Postgres into `TaxonomyVersion`, `TaxonomyCategory`, and `TaxonomyCategoryTerm` for runtime lookup.
- Add inactive `ShopSubscription` and `BillingEvent` placeholders only. No billing workflows, API endpoints, or worker behavior are enabled in this phase.

## Consequences

- Future phases can build scans, review flows, apply jobs, and rollback on stable persistence primitives without redesigning the database.
- The app keeps its Phase 1 install/uninstall behavior while gaining a canonical `Shop` record that other tables can reference.
- Taxonomy lookup is fast and local, but the committed bootstrap snapshot remains intentionally compact until broader category coverage is needed.
- Evidence-only retention lowers storage and privacy risk, but deep raw-payload debugging is intentionally deferred.

## Rejected alternatives

- Keep `ShopInstallation` as the long-term primary anchor:
  This would keep install state tied too closely to Phase 1 concerns and make future relations read awkwardly.
- Store full raw Shopify product payloads for every finding:
  This increases copied merchant data and retention risk before we have a demonstrated need.
- Use the taxonomy package directly at runtime without seeding Postgres:
  This would make path/keyword lookup and future joins harder once scans and review flows arrive.
- Implement billing behavior alongside placeholder tables:
  Billing is explicitly out of scope for v1 automation in this phase and would add avoidable risk.
