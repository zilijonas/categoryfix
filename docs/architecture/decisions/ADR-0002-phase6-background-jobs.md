# ADR-0002: Phase 6 Background Jobs and Incremental Freshness

## Status

Accepted

## Context

Phase 5 added safe apply and rollback, but scan freshness still depended on manual rescans and request-driven polling. Phase 6 needs to keep findings fresh after product changes without adding a new datastore or a separate queue service.

The repository rules also constrain the solution:

- prefer one Fly deployable plus one worker process before splitting services
- do not add Redis or another queue backend without explicit approval
- keep scan history immutable rather than mutating prior findings in place
- preserve manual scan and write flows while introducing background freshness

## Decision

- Add one worker process to the existing `apps/shop-admin` Fly deployment.
- Use PostgreSQL-backed `BackgroundJob` rows as the only queue/lease mechanism.
- Persist minimal authenticated product webhook metadata in `WebhookDelivery` and dedupe deliveries by `(shopId, topic, webhookId)`.
- Coalesce product webhook bursts into one pending `AUTO_SCAN_START` job per shop instead of creating one job per delivery.
- Start webhook-triggered rescans as normal `ScanRun(trigger = WEBHOOK)` records so freshness work stays visible in the same immutable scan history as manual runs.
- Drive bulk-operation polling through `AUTO_SCAN_SYNC` jobs with lease-based claims, retry backoff, and dead-letter handling.
- Keep manual scan start/polling and Phase 5 apply/rollback execution unchanged in this phase.

## Consequences

- CategoryFix gains event-driven freshness without adding Redis, a new service, or webhook-body retention.
- Freshness failures become operationally visible through background-job state and dead-letter summaries.
- Shop-level coalescing favors operational simplicity over per-product surgical updates, which is acceptable for v1 trust and auditability.
- The worker and web app share the same image and environment, reducing deployment drift but keeping queue pressure tied to the app database.

## Rejected alternatives

- Add Redis or another dedicated queue backend:
  This adds infrastructure and operational cost before Postgres-backed jobs have been proven insufficient.
- Update existing findings in place from each webhook payload:
  This would make freshness less auditable and introduce more race conditions than a normal rescan.
- Move apply and rollback execution onto the worker in Phase 6:
  That broadens the migration too much for this phase and increases regression risk on already-working Phase 5 write paths.
