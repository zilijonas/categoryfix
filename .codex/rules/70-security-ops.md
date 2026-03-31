# Security and Operations Rules

- Secrets must come from environment variables or host secret stores only.
- Log in structured JSON with request IDs, shop IDs, scan IDs, and job IDs.
- Do not log raw tokens, webhook bodies with PII, or full product payloads at info level.
- Verify Shopify HMAC on all webhook requests and return `401` on invalid signatures.
- All long-running jobs must be idempotent and retry-safe.
- Production readiness requires documented backup, restore, deploy, and rollback runbooks.
- Sentry or equivalent exception reporting is required before widening beta access.
- Data retention and deletion behavior must match the published privacy policy and compliance webhook handling.
