# Webhook Failures Runbook

## Purpose

Document how to detect, debug, and recover from Shopify webhook failures.

## Phase 1 baseline

- Verify the route path matches `apps/shop-admin/shopify.app.toml`.
- Confirm `SHOPIFY_API_SECRET` is present and matches the app configuration.
- Invalid webhook signatures must return `401`; check the app logs for `shopify.webhook.*` structured events.
- `app/uninstalled` is idempotent. Re-delivery should leave the shop without active persisted sessions and with `Shop.state = UNINSTALLED`.

## To be completed in later phases

- replay strategy
- alert thresholds and escalation path

## Phase 6 additions

- Product webhooks (`products/create`, `products/update`, `products/delete`) must return `200` on valid duplicate deliveries and must not enqueue duplicate freshness jobs.
- Confirm `WebhookDelivery` rows are being recorded with the expected shop, topic, and webhook id before debugging worker behavior.
- If freshness stalls, inspect the latest `BackgroundJob` rows for `AUTO_SCAN_START` and `AUTO_SCAN_SYNC` statuses, attempts, and `lastError`.
- A `DEAD_LETTER` freshness job means automatic recovery stopped. Run a manual scan from `/app`, then inspect worker logs before re-enabling normal traffic confidence.
