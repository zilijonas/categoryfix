# Release Checklist

- `pnpm lint` passes.
- `pnpm test` passes.
- `pnpm build` passes.
- `pnpm test:e2e` passes.
- Staging deploy completed from `apps/shop-admin/fly.staging.toml`.
- `pnpm test:smoke:staging` passed against the current staging app and public URLs.
- Manual staging signoff completed for install, scan, review, apply, rollback, webhook freshness, and compliance webhook handling.
- Backup metadata for the release window is recorded.
- Restore drill evidence is current.
- Sentry is enabled for the target environment.
- Support, privacy, and terms URLs are live and match current product behavior.
- Production-readiness signoff is complete.
- Shopify submission checklist is complete for the current release.
