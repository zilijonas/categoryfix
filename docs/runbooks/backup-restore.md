# Backup and Restore Runbook

## Purpose

Document the minimum backup, restore, and verification steps required before widening beta access or submitting the app for Shopify review.

## Backup expectations

- Owner: release engineer or database owner on call.
- Before every production promotion, capture:
  - confirmation that managed database snapshots are healthy
  - a logical backup taken close to the release window
  - the application release SHA associated with that backup window
- Store backup metadata in release notes or incident notes, not in repo-tracked secrets.

## Restore drill cadence

- Run a restore drill against staging before Shopify submission readiness is signed off.
- Repeat after material schema changes or backup-provider changes.

## Restore drill steps

- Provision or reset the staging database target.
- Restore the latest logical backup or managed snapshot into staging.
- Run `pnpm --filter @categoryfix/db prisma:migrate:deploy` if the target requires pending migrations.
- Deploy the matching staging app and worker release.
- Verify:
  - `/api/v1/health` returns `200`
  - the app boots successfully
  - core tables exist and the Prisma client can query them
  - a staging merchant can install, scan, review, apply, and rollback

## Failure handling

- If restore verification fails, stop the production promotion gate.
- Capture the failing step, release SHA, and restore source in incident notes.
- Do not mark submission readiness complete until the restore drill passes.
