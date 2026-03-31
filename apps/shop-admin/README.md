# `apps/shop-admin`

Embedded Shopify admin app for CategoryFix.

Current responsibilities:

- Shopify-managed installation and token exchange
- App Bridge and embedded admin routes
- mandatory webhook handling
- authenticated merchant-facing UI
- versioned JSON endpoints for app health and shop settings

Phase 1 commands:

- `pnpm --filter @categoryfix/shop-admin dev`
- `pnpm --filter @categoryfix/shop-admin build`
- `pnpm --filter @categoryfix/shop-admin start`

Implementation notes:

- Uses Shopify React Router as the embedded foundation
- Reads env-config validation from `packages/shopify-core`
- Uses Prisma storage from `packages/db`
- Keeps custom auth out of the embedded surface
- Deploys on Fly with `apps/shop-admin/fly.toml` and `apps/shop-admin/Dockerfile`
