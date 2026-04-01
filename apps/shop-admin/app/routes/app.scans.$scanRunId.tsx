import { startTransition, useEffect, useMemo, useState } from "react";
import { Form, Link, useFetcher, useLoaderData, useNavigation, useRevalidator } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type { ApplyJobDetail, RollbackJobDetail } from "@categoryfix/db";
import {
  createReviewMutationResponse,
  createScanReviewResponse,
  type ScanReviewRoutePayload,
} from "../lib/scan-review.server.js";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { authenticate } from "../shopify.server.js";
import { prisma } from "../db.server.js";

interface ScanStatusPayload {
  scanRun: {
    id: string;
    status: string;
  } | null;
}

interface ApplyJobResponsePayload {
  job: ApplyJobDetail;
  requestId: string;
}

interface RollbackJobResponsePayload {
  job: RollbackJobDetail;
  requestId: string;
}

interface ApplyJobStatusPayload {
  job: ApplyJobDetail;
}

export const loader = withRouteErrorReporting(
  "app.scans.$scanRunId",
  "loader",
  async ({ params, request }: LoaderFunctionArgs) => {
  const scanRunId = params.scanRunId;

  if (!scanRunId) {
    throw new Response("Scan run id is required.", { status: 400 });
  }

  const response = await createScanReviewResponse({
    request,
    scanRunId,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });

  if (!response.ok) {
    throw response;
  }

  return (await response.json()) as ScanReviewRoutePayload;
  },
);

export const action = withRouteErrorReporting(
  "app.scans.$scanRunId",
  "action",
  async ({ params, request }: ActionFunctionArgs) => {
  const scanRunId = params.scanRunId;

  if (!scanRunId) {
    return Response.json({ error: "Scan run id is required." }, { status: 400 });
  }

  return createReviewMutationResponse({
    request,
    scanRunId,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });
  },
);

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not available yet";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function confidenceLabel(confidence: string) {
  switch (confidence) {
    case "EXACT":
      return "Exact";
    case "STRONG":
      return "Strong";
    case "REVIEW_REQUIRED":
      return "Review required";
    case "NO_SAFE_SUGGESTION":
      return "No safe suggestion";
    default:
      return confidence;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "Accepted";
    case "DISMISSED":
      return "Dismissed";
    case "OPEN":
      return "Open";
    case "APPLIED":
      return "Applied";
    case "ROLLED_BACK":
      return "Rolled back";
    case "PARTIALLY_SUCCEEDED":
      return "Partially succeeded";
    case "DEAD_LETTER":
      return "Dead letter";
    default:
      return status;
  }
}

function renderStatusTone(status: string) {
  switch (status) {
    case "SUCCEEDED":
    case "ACCEPTED":
    case "APPLIED":
      return "#1f7a1f";
    case "FAILED":
    case "DISMISSED":
      return "#8a1f17";
    case "PARTIALLY_SUCCEEDED":
      return "#7a4f00";
    case "RUNNING":
    case "PENDING":
      return "#6f4e00";
    default:
      return "#444";
  }
}

function canAcceptFinding(finding: {
  confidence: string;
  recommendedCategory: { name: string } | null;
}) {
  return finding.recommendedCategory && finding.confidence !== "NO_SAFE_SUGGESTION";
}

function formatAuditEvent(eventType: string) {
  return eventType
    .replaceAll("_", " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function buildSearch(
  filters: ScanReviewRoutePayload["filters"],
  page: number,
  findingId?: string | null,
) {
  const params = new URLSearchParams();

  if (filters.status !== "ALL") {
    params.set("status", filters.status);
  }

  if (filters.confidence !== "ALL") {
    params.set("confidence", filters.confidence);
  }

  if (filters.query) {
    params.set("query", filters.query);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (findingId) {
    params.set("findingId", findingId);
  }

  const search = params.toString();

  return search ? `?${search}` : "";
}

export default function ScanReviewRoute() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const reviewAction = useFetcher<{ updatedCount: number }>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [applyJob, setApplyJob] = useState<ApplyJobDetail | null>(null);
  const [rollbackJob, setRollbackJob] = useState<RollbackJobDetail | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<string | null>(null);

  const visibleIds = useMemo(
    () => new Set(data.findingsPage.items.map((finding) => finding.id)),
    [data.findingsPage.items],
  );
  const acceptedSelectedIds = useMemo(
    () =>
      data.findingsPage.items
        .filter(
          (finding) =>
            selectedIds.includes(finding.id) &&
            finding.status === "ACCEPTED" &&
            Boolean(finding.recommendedCategory),
        )
        .map((finding) => finding.id),
    [data.findingsPage.items, selectedIds],
  );

  async function loadApplyJob(applyJobId: string) {
    const response = await fetch(`/api/v1/apply-jobs/${applyJobId}`);

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as ApplyJobStatusPayload;
    setApplyJob(payload.job);
  }

  async function runApplyJob(findingIds?: string[]) {
    setPendingOperation(findingIds?.length ? "apply-selected" : "apply-default");
    setOperationError(null);

    try {
      const response = await fetch("/api/v1/apply-jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          scanRunId: data.scanRun.id,
          ...(findingIds?.length ? { findingIds } : {}),
        }),
      });
      const payload = (await response.json()) as ApplyJobResponsePayload | { error?: string };

      if (!response.ok) {
        setOperationError(
          "error" in payload && payload.error
            ? payload.error
            : "CategoryFix could not start the apply job.",
        );
        return;
      }

      setApplyJob((payload as ApplyJobResponsePayload).job);
      setRollbackJob(null);
      setSelectedIds([]);
      startTransition(() => {
        revalidator.revalidate();
      });
    } catch {
      setOperationError("CategoryFix could not start the apply job.");
    } finally {
      setPendingOperation(null);
    }
  }

  async function runRollbackJob(applyJobId: string) {
    setPendingOperation(`rollback:${applyJobId}`);
    setOperationError(null);

    try {
      const response = await fetch("/api/v1/rollback-jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ applyJobId }),
      });
      const payload = (await response.json()) as RollbackJobResponsePayload | { error?: string };

      if (!response.ok) {
        setOperationError(
          "error" in payload && payload.error
            ? payload.error
            : "CategoryFix could not start the rollback job.",
        );
        return;
      }

      setRollbackJob((payload as RollbackJobResponsePayload).job);
      await loadApplyJob(applyJobId);
      startTransition(() => {
        revalidator.revalidate();
      });
    } catch {
      setOperationError("CategoryFix could not start the rollback job.");
    } finally {
      setPendingOperation(null);
    }
  }

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [visibleIds]);

  useEffect(() => {
    if (reviewAction.state !== "idle" || !reviewAction.data) {
      return;
    }

    setSelectedIds([]);
    startTransition(() => {
      revalidator.revalidate();
    });
  }, [reviewAction.data, reviewAction.state, revalidator]);

  useEffect(() => {
    if (!data.readOnly) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const response = await fetch(data.pollEndpoint);

      if (!response.ok || cancelled) {
        return;
      }

      const payload = (await response.json()) as ScanStatusPayload;

      if (cancelled) {
        return;
      }

      if (payload.scanRun?.status !== "PENDING" && payload.scanRun?.status !== "RUNNING") {
        startTransition(() => {
          revalidator.revalidate();
        });
      }
    };

    const timer = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [data.pollEndpoint, data.readOnly, revalidator]);

  useEffect(() => {
    if (applyJob || !data.applyJobs[0]?.id) {
      return;
    }

    void loadApplyJob(data.applyJobs[0].id);
  }, [applyJob, data.applyJobs]);

  const allSelected =
    data.findingsPage.items.length > 0 &&
    data.findingsPage.items.every((finding) => selectedIds.includes(finding.id));
  const drawerCloseSearch = buildSearch(data.filters, data.findingsPage.page);
  const latestApplyJob = applyJob;
  const latestRollbackJob = rollbackJob;

  return (
    <s-page heading="Scan review">
      <s-section heading="Review status">
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0 }}>
            Scan: <strong>{data.scanRun.id}</strong>
          </p>
          <p style={{ margin: 0 }}>
            Trigger: {data.scanRun.trigger === "WEBHOOK" ? "Webhook refresh" : "Manual scan"}
          </p>
          <p style={{ margin: 0 }}>
            Status:{" "}
            <strong style={{ color: renderStatusTone(data.scanRun.status) }}>
              {data.scanRun.status}
            </strong>
          </p>
          <p style={{ margin: 0 }}>Started: {formatTimestamp(data.scanRun.startedAt)}</p>
          <p style={{ margin: 0 }}>Completed: {formatTimestamp(data.scanRun.completedAt)}</p>
          {data.scanRun.failureSummary ? (
            <p style={{ margin: 0, color: "#8a1f17" }}>
              Failure: {data.scanRun.failureSummary}
            </p>
          ) : null}
          {data.readOnly ? (
            <p style={{ margin: 0, color: "#6f4e00" }}>
              Review actions are disabled while this scan is still running.
            </p>
          ) : null}
        </div>
      </s-section>

      <s-section heading="Freshness status">
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0 }}>
            Auto-rescan pending: {data.freshness.autoRescanPending ? "Yes" : "No"}
          </p>
          <p style={{ margin: 0 }}>
            Recent product webhook deliveries: {data.freshness.recentWebhookDeliveryCount}
          </p>
          <p style={{ margin: 0 }}>
            Latest webhook scan:{" "}
            {data.freshness.lastWebhookScan
              ? `${data.freshness.lastWebhookScan.status} at ${formatTimestamp(
                  data.freshness.lastWebhookScan.completedAt ??
                    data.freshness.lastWebhookScan.startedAt,
                )}`
              : "No webhook-triggered scan yet"}
          </p>
          {data.freshness.latestIssue ? (
            <>
              <p style={{ margin: 0, color: "#8a1f17" }}>
                Latest freshness issue: {data.freshness.latestIssue.status}
              </p>
              <p style={{ margin: 0, color: "#8a1f17" }}>
                {data.freshness.latestIssue.lastError ??
                  "CategoryFix could not finish a freshness job."}
              </p>
              <p style={{ margin: 0 }}>Recovery: run a manual scan.</p>
            </>
          ) : null}
        </div>
      </s-section>

      <s-section heading="Future apply preview">
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0 }}>
            Accepted for future apply: {data.findingsPage.previewCounts.readyToApply}
          </p>
          <p style={{ margin: 0 }}>Open findings: {data.findingsPage.previewCounts.open}</p>
          <p style={{ margin: 0 }}>
            Safe deterministic still open: {data.findingsPage.previewCounts.safeDeterministicOpen}
          </p>
          <p style={{ margin: 0 }}>
            Review required still open: {data.findingsPage.previewCounts.reviewRequiredOpen}
          </p>
          <p style={{ margin: 0 }}>
            AI-assisted still open: {data.findingsPage.previewCounts.aiAssistedOpen}
          </p>
          <p style={{ margin: 0 }}>
            Already applied: {data.findingsPage.previewCounts.applied}
          </p>
          <p style={{ margin: 0 }}>
            Rolled back: {data.findingsPage.previewCounts.rolledBack}
          </p>
          <p style={{ margin: 0 }}>
            No safe suggestion: {data.findingsPage.previewCounts.noSafeSuggestion}
          </p>
          <p style={{ margin: 0 }}>Dismissed: {data.findingsPage.previewCounts.dismissed}</p>
        </div>
      </s-section>

      <s-section heading="Apply changes">
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <p style={{ margin: 0 }}>
            Default apply includes only accepted exact and strong matches. Accepted
            review-required and AI-assisted findings stay opt-in and must be selected
            explicitly.
          </p>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <p style={{ margin: 0 }}>
              Safe accepted by default: {data.findingsPage.previewCounts.safeDeterministicAccepted}
            </p>
            <p style={{ margin: 0 }}>
              Review required accepted: {data.findingsPage.previewCounts.reviewRequiredAccepted}
            </p>
            <p style={{ margin: 0 }}>
              AI-assisted accepted: {data.findingsPage.previewCounts.aiAssistedAccepted}
            </p>
            <p style={{ margin: 0 }}>
              Accepted selected on this page: {acceptedSelectedIds.length}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              disabled={
                data.readOnly ||
                pendingOperation !== null ||
                data.findingsPage.previewCounts.safeDeterministicAccepted === 0
              }
              onClick={() => {
                void runApplyJob();
              }}
              type="button"
            >
              {pendingOperation === "apply-default"
                ? "Applying safe accepted..."
                : "Apply safe accepted"}
            </button>
            <button
              disabled={data.readOnly || pendingOperation !== null || acceptedSelectedIds.length === 0}
              onClick={() => {
                void runApplyJob(acceptedSelectedIds);
              }}
              type="button"
            >
              {pendingOperation === "apply-selected"
                ? "Applying selected..."
                : "Apply selected accepted"}
            </button>
          </div>
          {operationError ? (
            <p style={{ margin: 0, color: "#8a1f17" }}>{operationError}</p>
          ) : null}
        </div>
      </s-section>

      <s-section heading="Filters">
        <Form method="get" style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Status</span>
              <select defaultValue={data.filters.status} name="status">
                <option value="ALL">All</option>
                <option value="OPEN">Open</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="DISMISSED">Dismissed</option>
                <option value="APPLIED">Applied</option>
                <option value="ROLLED_BACK">Rolled back</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Confidence</span>
              <select defaultValue={data.filters.confidence} name="confidence">
                <option value="ALL">All</option>
                <option value="EXACT">Exact</option>
                <option value="STRONG">Strong</option>
                <option value="REVIEW_REQUIRED">Review required</option>
                <option value="NO_SAFE_SUGGESTION">No safe suggestion</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.25rem", minWidth: "16rem" }}>
              <span>Product title</span>
              <input defaultValue={data.filters.query} name="query" type="search" />
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="submit">Apply filters</button>
            <Link to={`/app/scans/${data.scanRun.id}`}>Reset</Link>
            <Link to="/app">Back to dashboard</Link>
          </div>
        </Form>
      </s-section>

      <s-section heading="Review actions">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <reviewAction.Form method="post">
            <input name="intent" type="hidden" value="accept_safe_deterministic" />
            <button
              disabled={
                data.readOnly ||
                data.findingsPage.previewCounts.safeDeterministicOpen === 0 ||
                reviewAction.state !== "idle"
              }
              type="submit"
            >
              Accept all safe deterministic
            </button>
          </reviewAction.Form>

          <reviewAction.Form method="post">
            <input name="intent" type="hidden" value="accept_selected" />
            {selectedIds.map((id) => (
              <input key={id} name="findingId" type="hidden" value={id} />
            ))}
            <button
              disabled={data.readOnly || !selectedIds.length || reviewAction.state !== "idle"}
              type="submit"
            >
              Accept selected
            </button>
          </reviewAction.Form>

          <reviewAction.Form method="post">
            <input name="intent" type="hidden" value="dismiss_selected" />
            {selectedIds.map((id) => (
              <input key={id} name="findingId" type="hidden" value={id} />
            ))}
            <button
              disabled={data.readOnly || !selectedIds.length || reviewAction.state !== "idle"}
              type="submit"
            >
              Dismiss selected
            </button>
          </reviewAction.Form>
        </div>
      </s-section>

      <s-section heading="Findings">
        {!data.findingsPage.items.length ? (
          <p style={{ margin: 0 }}>
            No findings match the current filters. Adjust the filters or review a
            different scan run.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">
                    <input
                      aria-label="Select all visible findings"
                      checked={allSelected}
                      onChange={(event) => {
                        if (event.currentTarget.checked) {
                          setSelectedIds(data.findingsPage.items.map((finding) => finding.id));
                          return;
                        }

                        setSelectedIds([]);
                      }}
                      type="checkbox"
                    />
                  </th>
                  <th align="left">Product</th>
                  <th align="left">Current category</th>
                  <th align="left">Suggested category</th>
                  <th align="left">Confidence</th>
                  <th align="left">Status</th>
                  <th align="left">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.findingsPage.items.map((finding) => {
                  const checked = selectedIds.includes(finding.id);
                  const detailSearch = buildSearch(
                    data.filters,
                    data.findingsPage.page,
                    finding.id,
                  );

                  return (
                    <tr key={finding.id}>
                      <td>
                        <input
                          checked={checked}
                          onChange={(event) => {
                            setSelectedIds((current) =>
                              event.currentTarget.checked
                                ? [...current, finding.id]
                                : current.filter((id) => id !== finding.id),
                            );
                          }}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: "0.25rem" }}>
                          <strong>{finding.productTitle}</strong>
                          <span>{finding.productHandle ? `/${finding.productHandle}` : "No handle"}</span>
                          {finding.assistance ? (
                            <span style={{ color: "#6f4e00", fontSize: "0.9rem" }}>
                              {finding.assistance.label}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>{finding.currentCategory?.fullPath ?? "No category set"}</td>
                      <td>{finding.recommendedCategory?.fullPath ?? "No safe suggestion"}</td>
                      <td>{confidenceLabel(finding.confidence)}</td>
                      <td style={{ color: renderStatusTone(finding.status) }}>
                        {statusLabel(finding.status)}
                      </td>
                      <td>
                        <Link to={detailSearch}>Inspect basis</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <span>
            Page {data.findingsPage.page} of {data.findingsPage.totalPages}
          </span>
          {data.findingsPage.page > 1 ? (
            <Link to={buildSearch(data.filters, data.findingsPage.page - 1, data.selectedFinding?.id)}>
              Previous
            </Link>
          ) : null}
          {data.findingsPage.page < data.findingsPage.totalPages ? (
            <Link to={buildSearch(data.filters, data.findingsPage.page + 1, data.selectedFinding?.id)}>
              Next
            </Link>
          ) : null}
          {navigation.state !== "idle" ? <span>Loading…</span> : null}
        </div>
      </s-section>

      <s-section heading="Latest apply job">
        {latestApplyJob ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <p style={{ margin: 0 }}>
                Apply job: <strong>{latestApplyJob.id}</strong>
              </p>
              <p style={{ margin: 0 }}>
                Status:{" "}
                <strong style={{ color: renderStatusTone(latestApplyJob.status) }}>
                  {statusLabel(latestApplyJob.status)}
                </strong>
              </p>
              <p style={{ margin: 0 }}>
                Applied: {latestApplyJob.appliedCount} of {latestApplyJob.selectedFindingCount}
              </p>
              <p style={{ margin: 0 }}>Failed: {latestApplyJob.failedCount}</p>
              <p style={{ margin: 0 }}>Started: {formatTimestamp(latestApplyJob.startedAt)}</p>
              <p style={{ margin: 0 }}>Completed: {formatTimestamp(latestApplyJob.completedAt)}</p>
            </div>

            {latestApplyJob.rollbackEligibleCount > 0 ? (
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  disabled={pendingOperation !== null}
                  onClick={() => {
                    void runRollbackJob(latestApplyJob.id);
                  }}
                  type="button"
                >
                  {pendingOperation === `rollback:${latestApplyJob.id}`
                    ? "Rolling back..."
                    : "Rollback applied items"}
                </button>
              </div>
            ) : null}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">Product</th>
                    <th align="left">Before</th>
                    <th align="left">After</th>
                    <th align="left">Status</th>
                    <th align="left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {latestApplyJob.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productTitle ?? item.productId}</td>
                      <td>{item.before.category?.fullPath ?? "No category set"}</td>
                      <td>{item.after.category?.fullPath ?? "Clear category"}</td>
                      <td style={{ color: renderStatusTone(item.status) }}>
                        {statusLabel(item.status)}
                      </td>
                      <td>{item.errorMessage ?? "No error"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0 }}>
            No apply jobs have run yet for this shop.
          </p>
        )}
      </s-section>

      <s-section heading="Latest rollback job">
        {latestRollbackJob ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <p style={{ margin: 0 }}>
                Rollback job: <strong>{latestRollbackJob.id}</strong>
              </p>
              <p style={{ margin: 0 }}>
                Status:{" "}
                <strong style={{ color: renderStatusTone(latestRollbackJob.status) }}>
                  {statusLabel(latestRollbackJob.status)}
                </strong>
              </p>
              <p style={{ margin: 0 }}>
                Rolled back: {latestRollbackJob.rolledBackCount} of {latestRollbackJob.selectedItemCount}
              </p>
              <p style={{ margin: 0 }}>Failed: {latestRollbackJob.failedCount}</p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">Product</th>
                    <th align="left">Current</th>
                    <th align="left">Restore to</th>
                    <th align="left">Status</th>
                    <th align="left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRollbackJob.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productTitle ?? item.productId}</td>
                      <td>{item.before.category?.fullPath ?? "No category set"}</td>
                      <td>{item.after.category?.fullPath ?? "Clear category"}</td>
                      <td style={{ color: renderStatusTone(item.status) }}>
                        {statusLabel(item.status)}
                      </td>
                      <td>{item.errorMessage ?? "No error"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0 }}>
            No rollback job has run in this browser session yet.
          </p>
        )}
      </s-section>

      <s-section heading="Recent apply jobs">
        {data.applyJobs.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Job</th>
                  <th align="left">Status</th>
                  <th align="right">Applied</th>
                  <th align="right">Failed</th>
                  <th align="left">Completed</th>
                  <th align="left">Undo</th>
                </tr>
              </thead>
              <tbody>
                {data.applyJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td style={{ color: renderStatusTone(job.status) }}>{statusLabel(job.status)}</td>
                    <td align="right">{job.appliedCount}</td>
                    <td align="right">{job.failedCount}</td>
                    <td>{formatTimestamp(job.completedAt)}</td>
                    <td>
                      <button
                        disabled={job.rollbackEligibleCount === 0 || pendingOperation !== null}
                        onClick={() => {
                          void runRollbackJob(job.id);
                        }}
                        type="button"
                      >
                        {pendingOperation === `rollback:${job.id}` ? "Rolling back..." : "Rollback"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0 }}>No apply jobs recorded yet.</p>
        )}
      </s-section>

      <s-section heading="Recent rollback jobs">
        {data.rollbackJobs.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Job</th>
                  <th align="left">Status</th>
                  <th align="right">Rolled back</th>
                  <th align="right">Failed</th>
                  <th align="left">Completed</th>
                </tr>
              </thead>
              <tbody>
                {data.rollbackJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td style={{ color: renderStatusTone(job.status) }}>{statusLabel(job.status)}</td>
                    <td align="right">{job.rolledBackCount}</td>
                    <td align="right">{job.failedCount}</td>
                    <td>{formatTimestamp(job.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0 }}>No rollback jobs recorded yet.</p>
        )}
      </s-section>

      <s-section heading="Recent freshness jobs">
        {data.recentFreshnessJobs.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Job</th>
                  <th align="left">Kind</th>
                  <th align="left">Status</th>
                  <th align="left">Available</th>
                  <th align="left">Error</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFreshnessJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.kind}</td>
                    <td style={{ color: renderStatusTone(job.status) }}>{statusLabel(job.status)}</td>
                    <td>{formatTimestamp(job.availableAt)}</td>
                    <td>{job.lastError ?? "No error"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0 }}>No freshness jobs recorded yet.</p>
        )}
      </s-section>

      <s-section heading="Audit timeline">
        {data.auditTimeline.length ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {data.auditTimeline.map((event) => (
              <div
                key={event.id}
                style={{ border: "1px solid #d9d9d9", padding: "0.75rem", borderRadius: "0.5rem" }}
              >
                <p style={{ margin: 0 }}>
                  <strong>{formatAuditEvent(event.eventType)}</strong>
                </p>
                <p style={{ margin: 0 }}>When: {formatTimestamp(event.createdAt)}</p>
                <p style={{ margin: 0 }}>Actor: {event.actor}</p>
                {event.applyJobId ? <p style={{ margin: 0 }}>Apply job: {event.applyJobId}</p> : null}
                {event.rollbackJobId ? <p style={{ margin: 0 }}>Rollback job: {event.rollbackJobId}</p> : null}
                {event.reason ? <p style={{ margin: 0 }}>Detail: {event.reason}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0 }}>No apply or rollback audit events recorded yet.</p>
        )}
      </s-section>

      <s-section heading="Recent runs">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {data.scanHistory.map((scan) => (
            <Link key={scan.id} to={`/app/scans/${scan.id}`}>
              {scan.id}
            </Link>
          ))}
        </div>
      </s-section>

      {data.selectedFinding ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "min(30rem, 100%)",
            height: "100vh",
            overflowY: "auto",
            background: "#fff",
            borderLeft: "1px solid #d9d9d9",
            boxShadow: "0 0 24px rgba(0, 0, 0, 0.12)",
            padding: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <strong>{data.selectedFinding.productTitle}</strong>
            <Link to={drawerCloseSearch}>Close</Link>
          </div>

          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            <p style={{ margin: 0 }}>
              Current category: {data.selectedFinding.currentCategory?.fullPath ?? "No category set"}
            </p>
            <p style={{ margin: 0 }}>
              Suggested category:{" "}
              {data.selectedFinding.recommendedCategory?.fullPath ?? "No safe suggestion"}
            </p>
            <p style={{ margin: 0 }}>
              Confidence: {confidenceLabel(data.selectedFinding.confidence)}
            </p>
            <p style={{ margin: 0 }}>Status: {statusLabel(data.selectedFinding.status)}</p>
            <p style={{ margin: 0 }}>Basis items: {data.selectedFinding.basisCount}</p>
            <p style={{ margin: 0 }}>Blockers: {data.selectedFinding.blockerCount}</p>
            {data.selectedFinding.assistance ? (
              <>
                <p style={{ margin: 0, color: "#6f4e00" }}>
                  {data.selectedFinding.assistance.label}
                </p>
                <p style={{ margin: 0 }}>{data.selectedFinding.assistance.disclosure}</p>
                <p style={{ margin: 0 }}>
                  AI summary: {data.selectedFinding.assistance.summary}
                </p>
              </>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <reviewAction.Form method="post">
              <input name="intent" type="hidden" value="accept_selected" />
              <input name="findingId" type="hidden" value={data.selectedFinding.id} />
              <button
                disabled={
                  data.readOnly ||
                  !canAcceptFinding(data.selectedFinding) ||
                  reviewAction.state !== "idle"
                }
                type="submit"
              >
                Accept suggestion
              </button>
            </reviewAction.Form>
            <reviewAction.Form method="post">
              <input name="intent" type="hidden" value="dismiss_selected" />
              <input name="findingId" type="hidden" value={data.selectedFinding.id} />
              <button disabled={data.readOnly || reviewAction.state !== "idle"} type="submit">
                Dismiss suggestion
              </button>
            </reviewAction.Form>
          </div>

          <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
            <section>
              <h2 style={{ fontSize: "1rem" }}>Why CategoryFix suggested this</h2>
              {data.selectedFinding.explanation.basis.length ? (
                <ul>
                  {data.selectedFinding.explanation.basis.map((basis) => (
                    <li key={`${basis.source}-${basis.matchedTerm}-${basis.rawValue}`}>
                      {basis.source}: matched “{basis.rawValue}” to “{basis.taxonomyFullPath}” via
                      {` ${basis.matchType.toLowerCase().replaceAll("_", " ")} `}
                      on “{basis.matchedTerm}”.
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No positive basis facts were recorded for this finding.</p>
              )}
            </section>

            <section>
              <h2 style={{ fontSize: "1rem" }}>Uncertainty and blockers</h2>
              {data.selectedFinding.explanation.blockers.length ? (
                <ul>
                  {data.selectedFinding.explanation.blockers.map((blocker) => (
                    <li key={`${blocker.type}-${blocker.message}`}>{blocker.message}</li>
                  ))}
                </ul>
              ) : (
                <p>No blocker messages were recorded.</p>
              )}
            </section>

            <section>
              <h2 style={{ fontSize: "1rem" }}>Product signals reviewed</h2>
              <ul>
                <li>Title: {data.selectedFinding.evidence.title}</li>
                <li>Product type: {data.selectedFinding.evidence.productType ?? "Not set"}</li>
                <li>Vendor: {data.selectedFinding.evidence.vendor ?? "Not set"}</li>
                <li>
                  Tags:{" "}
                  {data.selectedFinding.evidence.tags.length
                    ? data.selectedFinding.evidence.tags.join(", ")
                    : "None"}
                </li>
                <li>
                  Collections:{" "}
                  {data.selectedFinding.evidence.collections.length
                    ? data.selectedFinding.evidence.collections.join(", ")
                    : "None"}
                </li>
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </s-page>
  );
}
