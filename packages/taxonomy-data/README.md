# `packages/taxonomy-data`

Versioned taxonomy package for CategoryFix.

Current contents:

- a committed bootstrap snapshot aligned to Shopify's standard product taxonomy release cadence
- release metadata for the local snapshot
- helpers to build Shopify taxonomy GIDs
- an idempotent seed helper that loads the snapshot into Postgres through `@categoryfix/db`

Rules:

- merchant-facing flows should not expose raw taxonomy IDs by default
- taxonomy updates must be versioned and documented
- the committed snapshot should stay compact until the full scan engine is ready to consume broader coverage
