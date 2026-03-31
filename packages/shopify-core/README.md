# `packages/shopify-core`

Shared Shopify integration package for CategoryFix.

Current contents:

- phase 1 env validation
- scope constants and mandatory webhook definitions
- Shopify app/server factory
- shared webhook authentication and structured logging helpers

Rules:

- Shopify-specific concerns belong here or in `apps/shop-admin`
- do not mix deterministic business rules into this package
