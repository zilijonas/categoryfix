# Deploy Runbook

## Purpose

Document how to deploy the embedded app, worker process, and marketing site safely.

## Phase 1 baseline

- Deploy the embedded app from the repository root with the Fly config at `apps/shop-admin/fly.toml`.
- Ensure these environment variables exist before release: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SHOPIFY_SCOPES`, `SHOPIFY_WEBHOOK_API_VERSION`, `DATABASE_URL`.
- The Fly release command runs `pnpm --filter @categoryfix/db prisma:migrate:deploy`.
- After deployment, verify:
  - `/api/v1/health` returns `200`
  - embedded `/app` loads inside the Shopify admin
  - mandatory webhook routes return `401` on invalid signatures and `200` on valid deliveries

## To be completed in later phases

- staging to production promotion flow

## Phase 5 verification additions

- Run a scan and confirm `/app/scans/:scanRunId` loads accepted findings and apply counts correctly.
- Trigger a small apply job on a dev store and verify the latest apply job summary shows item-level results.
- Trigger rollback for that job and verify the audit timeline and rollback summary update without leaving stale counts behind.
