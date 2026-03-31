# Webhook Failures Runbook

## Purpose

Document how to detect, debug, and recover from Shopify webhook failures.

## Phase 1 baseline

- Verify the route path matches `apps/shop-admin/shopify.app.toml`.
- Confirm `SHOPIFY_API_SECRET` is present and matches the app configuration.
- Invalid webhook signatures must return `401`; check the app logs for `shopify.webhook.*` structured events.
- `app/uninstalled` is idempotent. Re-delivery should leave the shop without active persisted sessions and with `ShopInstallation.state = UNINSTALLED`.

## To be completed in later phases

- replay strategy
- alert thresholds and escalation path
