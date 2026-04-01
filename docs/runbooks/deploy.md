# Deploy Runbook

## Purpose

Document how to deploy the embedded app, worker process, and marketing site safely.

## Hosting split

- The embedded Shopify app, OAuth/session surface, webhooks, and background worker must run on dedicated app hosting.
- Static marketing, support, and legal pages may stay on GitHub Pages as long as the published URLs remain stable and review-safe.
- Production deployment should treat the app runtime and static public pages as separate surfaces with separate rollback concerns.

## Environment inventory

- Shared runtime env: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SHOPIFY_SCOPES`, `SHOPIFY_WEBHOOK_API_VERSION`, `DATABASE_URL`
- Release and observability env: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`
- Promotion reference env: `SHOPIFY_STAGING_APP_URL`, `SHOPIFY_PRODUCTION_APP_URL`
- Smoke-test env: `SMOKE_APP_URL`, `SMOKE_PUBLIC_SITE_URL`

## App deployment flow

- Staging deploys from `.github/workflows/deploy-staging.yml` using `apps/shop-admin/fly.staging.toml`.
- Production deploys from `.github/workflows/deploy-production.yml` using `apps/shop-admin/fly.production.toml`.
- The Fly release command runs `pnpm --filter @categoryfix/db prisma:migrate:deploy`.
- Production deployment requires:
  - green `pnpm release:check`
  - completed staging smoke checks
  - human staging signoff for install, scan, review, apply, rollback, webhook freshness, and compliance webhook handling
  - completed release checklist and production-readiness signoff

## Automated post-deploy checks

- Run `pnpm test:smoke:staging` against the target environment after every staging deploy and before every production cutover.
- Smoke coverage must confirm:
  - `/api/v1/health` returns `200`
  - `/app` returns an app shell or auth redirect without a `5xx`
  - `/support`, `/privacy`, and `/terms` are reachable
  - invalid compliance webhook signatures return `401`

## Manual staging signoff

- Install the app on a staging or dev-review store.
- Verify embedded `/app` loads inside Shopify admin after authentication.
- Start a scan and confirm the review screen renders findings with explanations.
- Apply at least one safe deterministic item and confirm item-level success state.
- Run rollback and confirm the prior category state is restored for the test item.
- Deliver `products/update` and confirm freshness jobs are recorded and processed.
- Deliver a compliance webhook and confirm a valid request is acknowledged without payload persistence.

## Public site deployment

- Build the public marketing site from `apps/marketing`.
- GitHub Pages may host the current public static site if the published URLs stay stable for support, privacy, terms, and Shopify review.
- The marketing workflow should publish the built `apps/marketing/dist` artifact and expose stable URLs for:
  - `/`
  - `/product`
  - `/how-it-works`
  - `/docs`
  - `/privacy`
  - `/terms`
  - `/support`
  - `/beta`
- After deployment, verify:
  - the homepage reflects the trust-first positioning and does not claim autonomous fixing
  - legal and support URLs load successfully
  - the support CTA opens an email flow for `support@categoryfix.com`
  - the product copy mentions preview-before-write, rollback availability, optional AI-assisted fallback behavior, and no live billing in the current beta

## Rollback references

- Runtime deploy rollback steps are documented in `docs/runbooks/rollback.md`.
- Database backup and restore expectations are documented in `docs/runbooks/backup-restore.md`.
