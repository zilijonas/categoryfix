# Production Readiness Signoff

## Release identity

- Target release SHA:
- Target environment:
- Signoff date:
- Approver:

## Core checks

- Auth and session flow verified in the embedded app.
- Mandatory and compliance webhooks verified against the deployed environment.
- `read_products` and `write_products` are still the only requested scopes.
- Scan, review, apply, and rollback passed in staging.
- Product webhook freshness passed in staging.
- Sentry is enabled and receiving runtime and worker exceptions.
- Structured logs expose `requestId`, `shopId`, `scanRunId`, and job identifiers where applicable.
- Backup and restore runbooks are current.
- Latest restore drill evidence is attached or linked.

## Public and compliance surfaces

- Privacy URL:
- Terms URL:
- Support URL:
- Public-site hosting is stable for submission use.
- Closed-beta and no-billing posture is reflected consistently across docs and listing inputs.

## Launch blockers

- Open blocker 1:
- Open blocker 2:
- Open blocker 3:
