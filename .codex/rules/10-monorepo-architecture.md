# Monorepo and Architecture Rules

- Use `pnpm` workspaces as the only workspace layer until human approval is given to add another orchestrator.
- Put deployable applications in `apps/*` and reusable code in `packages/*`.
- Keep domain logic framework-agnostic and free of Shopify SDK, React, and database imports.
- Do not create a new runtime, service, queue, or datastore without an ADR and explicit human approval.
- Do not create a shared UI package for marketing and embedded admin by default; they serve different UX systems.
- Prefer one Fly deployable for the shop app plus one worker process before considering service split.
- Configuration must be validated at startup; no implicit environment defaults for secrets or hostnames.
