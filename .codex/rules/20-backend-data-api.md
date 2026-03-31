# Backend, Data, and API Rules

- Use PostgreSQL as the system of record.
- Use Prisma migrations only; schema changes must be committed and reviewed.
- Validate all request payloads, webhook bodies, and action inputs with Zod or equivalent explicit schemas.
- Persist scan runs and recommendation items as immutable historical records; do not overwrite prior scan outputs in place.
- Store manual overrides separately from generated recommendations.
- Manual overrides take precedence over all generated logic.
- Every apply or rollback job item must store `before`, `after`, `source`, `reason`, `actor`, and timestamps.
- Internal JSON endpoints must live under `/api/v1/*` if created, and must be versioned from the start.
