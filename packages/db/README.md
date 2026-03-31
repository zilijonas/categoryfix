# `packages/db`

Database package for CategoryFix.

Current contents:

- Prisma schema
- migrations
- generated client support
- shop/session helpers for app runtimes
- scan, apply, rollback, audit, and taxonomy persistence primitives

Rules:

- PostgreSQL is the source of truth
- schema changes require committed migrations
- audit and rollback data are mandatory design concerns

Phase 1 models:

Current models:

- `Session` for Shopify session persistence
- `Shop` as the canonical merchant record and install state anchor
- immutable scan, apply, rollback, and audit tables for later phases
- versioned taxonomy reference tables for local lookup and seeding
