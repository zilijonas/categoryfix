# `packages/db`

Database package for CategoryFix.

Current contents:

- Prisma schema
- migrations
- generated client support
- shop installation and session helpers for app runtimes

Rules:

- PostgreSQL is the source of truth
- schema changes require committed migrations
- audit and rollback data are mandatory design concerns

Phase 1 models:

- `Session` for Shopify session persistence
- `ShopInstallation` for install state, scopes, app URL, and uninstall cleanup
