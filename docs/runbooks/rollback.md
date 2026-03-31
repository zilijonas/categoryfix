# Rollback Runbook

## Purpose

Document how to recover from bad application deploys and how to safely reverse category writes.

## Apply-job rollback steps

- Open the latest review screen for the affected shop in the embedded app.
- Confirm the target apply job shows completed or partially succeeded status and that the affected items are still eligible for rollback.
- Trigger `Rollback` from the latest apply job card or the recent apply jobs table.
- Watch the rollback summary and item list. Successful rows restore the stored `before` category. Failed rows remain visible with an error message.
- If a rollback item reports that the product category changed again in Shopify, do not retry blindly. Re-run a scan and review the product before taking another write action.

## Conflict handling policy

- Apply skips stale items when the live Shopify category no longer matches the stored `before` snapshot.
- Rollback skips stale items when the live Shopify category no longer matches the applied snapshot.
- Partial success is expected and should be communicated to the merchant through the job summary and per-item results instead of treating the whole job as a hard failure.

## Post-incident verification checklist

- Confirm the affected apply or rollback job appears in the audit timeline.
- Spot-check products in Shopify Admin to verify the current category matches the job result.
- Re-run the scan if any items were skipped as stale or if merchant edits happened during the incident window.
- Capture the apply job id, rollback job id, and any failing product ids in incident notes.

## Deploy rollback placeholder

- Fly deployment rollback steps are still documented separately and will be expanded in later phases.
