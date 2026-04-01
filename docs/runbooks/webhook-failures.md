# Webhook Failures Runbook

## Purpose

Document how to detect, debug, and recover from Shopify webhook failures.

## Baseline verification

- Verify the route path matches `apps/shop-admin/shopify.app.toml`.
- Confirm `SHOPIFY_API_SECRET` is present and matches the app configuration.
- Invalid webhook signatures must return `401`; check the app logs for `shopify.webhook.*` structured events.
- `app/uninstalled` is idempotent. Re-delivery should leave the shop without active persisted sessions and with `Shop.state = UNINSTALLED`.

## Escalation signals

- repeated `401` responses for requests expected to be valid
- missing `WebhookDelivery` rows for valid product webhooks
- repeated `AUTO_SCAN_SYNC` dead letters after webhook receipt
- compliance webhook failures during Shopify submission or review

## Recovery flow

- Confirm whether the issue is signature mismatch, missing shop record, or downstream worker failure.
- For signature mismatch:
  - verify `SHOPIFY_API_SECRET`
  - verify the request is targeting the correct deployed app hostname
- For product webhook ingestion:
  - confirm the `WebhookDelivery` row was created with the expected `shopId`, `topic`, and `webhookId`
  - confirm only one `AUTO_SCAN_START` job exists per dedupe window
- For worker failures:
  - inspect the latest `BackgroundJob` rows and their `lastError`
  - confirm the worker release matches the intended deploy
- For compliance webhooks:
  - verify the endpoint returns `200` for a valid signed request and persists no raw payload
  - recheck the public privacy/support URLs used in submission notes

## Phase 6 additions

- Product webhooks (`products/create`, `products/update`, `products/delete`) must return `200` on valid duplicate deliveries and must not enqueue duplicate freshness jobs.
- Confirm `WebhookDelivery` rows are being recorded with the expected shop, topic, and webhook id before debugging worker behavior.
- If freshness stalls, inspect the latest `BackgroundJob` rows for `AUTO_SCAN_START` and `AUTO_SCAN_SYNC` statuses, attempts, and `lastError`.
- A `DEAD_LETTER` freshness job means automatic recovery stopped. Run a manual scan from `/app`, then inspect worker logs before re-enabling normal traffic confidence.
