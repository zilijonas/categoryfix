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

## Phase 8 marketing preview additions

- Build the public marketing site from `apps/marketing`.
- Treat GitHub Pages as a preview-only deployment target for the public site. Do not describe it as the production host for `categoryfix.com`.
- The preview workflow should publish the built `apps/marketing/dist` artifact and expose stable preview URLs for:
  - `/`
  - `/product`
  - `/how-it-works`
  - `/docs`
  - `/privacy`
  - `/terms`
  - `/support`
  - `/beta`
- After preview deployment, verify:
  - the homepage reflects the trust-first positioning and does not claim autonomous fixing
  - legal and support URLs load successfully
  - the support CTA opens an email flow for `support@categoryfix.com`
  - the product copy mentions preview-before-write, rollback availability, and optional AI-assisted fallback behavior
- Before production root-domain cutover, move `categoryfix.com` to a non-GitHub-Pages host that fits the roadmap requirement.

## Phase 5 verification additions

- Run a scan and confirm `/app/scans/:scanRunId` loads accepted findings and apply counts correctly.
- Trigger a small apply job on a dev store and verify the latest apply job summary shows item-level results.
- Trigger rollback for that job and verify the audit timeline and rollback summary update without leaving stale counts behind.

## Phase 6 verification additions

- Confirm Fly starts both the `app` and `worker` processes from `apps/shop-admin/fly.toml`.
- Deliver a product webhook on a dev store and verify a `WebhookDelivery` row is recorded plus one pending `AUTO_SCAN_START` job for the shop.
- Verify the worker claims the freshness job, creates a `ScanRun` with `trigger = WEBHOOK`, and eventually marks the paired `AUTO_SCAN_SYNC` job `SUCCEEDED`.
- Trigger repeated sync failures and confirm retries back off, then land in `DEAD_LETTER` after the configured attempt budget.
