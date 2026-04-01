# Incident Response Runbook

## Purpose

Document the first-response process for production incidents affecting merchants or platform integrations.

## Severity guide

- `SEV-1`: app install/auth failure, write-path corruption, broken rollback, or broad webhook outage
- `SEV-2`: degraded scan/apply freshness, repeated worker dead letters, or partial merchant impact
- `SEV-3`: localized merchant issue, documentation mismatch, or non-blocking submission artifact gap

## First-response checklist

- Record start time, suspected release SHA, affected environment, and reporter.
- Confirm whether the issue is runtime, worker, database, static site, or Shopify review/compliance related.
- Check structured logs and Sentry for correlated `requestId`, `shopId`, `scanRunId`, `jobId`, `applyJobId`, or `rollbackJobId`.
- Decide whether to rollback immediately or continue investigation in place.
- If merchant writes may be unsafe, pause promotions and stop any manual rollout expansion.

## Investigation checklist

- Verify `/api/v1/health` and the latest staging or production smoke results.
- Review the latest deploy, rollback, and worker logs for the affected time window.
- Confirm whether the issue reproduces on a staging store before changing production again.
- For write-path incidents, capture the job ids and check whether rollback remains available.
- For webhook incidents, inspect `WebhookDelivery` and `BackgroundJob` records before retrying traffic.

## Communication expectations

- `SEV-1`: notify the owner group immediately and post status updates until containment is confirmed.
- `SEV-2`: notify the owner group once triage identifies scope and mitigation.
- Merchant-facing updates should avoid overstating certainty and should include whether manual review or rollback is recommended.

## Exit criteria

- The issue is mitigated or rolled back.
- Smoke checks pass again in the affected environment.
- Follow-up tasks exist for any missing automation, test, or runbook coverage uncovered by the incident.
