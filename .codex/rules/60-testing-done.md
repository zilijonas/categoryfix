# Testing and Definition of Done Rules

- Every domain rule requires unit tests.
- Every webhook path requires signature-verification tests and idempotency tests.
- Every write path requires integration tests for success, partial failure, retry, and rollback.
- The critical merchant path needs browser coverage: install, scan, review, apply, rollback.
- A feature is not done until docs, telemetry, and failure states are updated.
- Any change that expands Shopify scopes, billing behavior, or AI usage requires human approval before merge.
- Do not merge placeholder tests that only assert truthy values or component rendering without behavior.
