# CategoryFix

CategoryFix is a Shopify app for detecting, reviewing, and safely fixing missing or incorrect product categorization.

This repository currently implements the foundation and phase 1 shell:

- `pnpm` monorepo structure
- governance rules for future AI coding agents
- architecture and product documentation
- a Shopify React Router embedded app baseline
- Prisma-backed PostgreSQL session and install state
- mandatory webhook handlers and versioned health/settings endpoints

## Repository Layout

```text
apps/
  shop-admin/        Shopify embedded app
  marketing/         Astro marketing site placeholder
packages/
  db/                Prisma schema, migrations, and database helpers
  domain/            Deterministic business logic package placeholder
  shopify-core/      Shopify auth, config, and webhook helpers
  taxonomy-data/     Taxonomy dataset package placeholder
  config-eslint/     Shared eslint config package
  config-typescript/ Shared tsconfig package
docs/
  architecture/      System docs and ADR templates
  product/           Product scope and trust model
  standards/         Quality and delivery standards
  runbooks/          Operational runbook templates
.codex/
  rules/             Repository rules for future agents
  roles/             Role-specific execution guidance
```

## Current Phase

The repo has completed Phase 0 and now contains the Phase 1 embedded app/auth baseline from `ROADMAP.md`.

The main runtime lives in `apps/shop-admin` and follows the official Shopify React Router auth/session model.

## Workspace Commands

- `pnpm db:generate`
- `pnpm typecheck`
- `pnpm build`
- `pnpm verify:foundation`
- `pnpm lint`
- `pnpm test`

The app-specific runtime also exposes:

- `pnpm --filter @categoryfix/shop-admin dev`
- `pnpm --filter @categoryfix/shop-admin start`

## Important Constraints

- Keep deterministic logic framework-agnostic in `packages/domain`
- Keep Shopify-specific runtime logic inside `apps/shop-admin` and `packages/shopify-core`
- Do not introduce new services or infrastructure without an ADR and human approval
- Do not treat AI as a prerequisite for core product value

Read these first before starting future implementation work:

- `.codex/rules/00-product-truth.md`
- `.codex/rules/10-monorepo-architecture.md`
- `.codex/rules/30-shopify-implementation.md`
- `docs/product/v1-scope.md`
- `ROADMAP.md`
