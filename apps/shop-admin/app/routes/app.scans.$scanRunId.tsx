import { startTransition, useEffect, useMemo, useState } from "react";
import { Form, Link, useFetcher, useLoaderData, useNavigation, useRevalidator } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type { ApplyJobDetail, RollbackJobDetail } from "@categoryfix/db";
import {
  AdminPage,
  AdminPanel,
  Field,
  InlineMessage,
  MetricGrid,
  StatusBadge,
  buttonClassName,
} from "../components/admin-ui.js";
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

function renderStatusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  switch (status) {
    case "SUCCEEDED":
    case "ACCEPTED":
    case "APPLIED":
      return "success";
    case "FAILED":
    case "DISMISSED":
      return "danger";
    case "PARTIALLY_SUCCEEDED":
      return "warning";
    case "RUNNING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
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
  const reviewStatusItems = [
    { label: "Scan", value: data.scanRun.id },
    {
      label: "Trigger",
      value: data.scanRun.trigger === "WEBHOOK" ? "Webhook refresh" : "Manual scan",
    },
    {
      label: "Status",
      value: <StatusBadge tone={renderStatusTone(data.scanRun.status)}>{data.scanRun.status}</StatusBadge>,
      tone: renderStatusTone(data.scanRun.status),
    },
    { label: "Started", value: formatTimestamp(data.scanRun.startedAt) },
    { label: "Completed", value: formatTimestamp(data.scanRun.completedAt) },
  ] as const;
  const freshnessItems = [
    {
      label: "Auto-rescan pending",
      value: data.freshness.autoRescanPending ? "Yes" : "No",
      tone: data.freshness.autoRescanPending ? "warning" : "neutral",
    },
    {
      label: "Recent product webhook deliveries",
      value: data.freshness.recentWebhookDeliveryCount,
    },
    {
      label: "Latest webhook scan",
      value: data.freshness.lastWebhookScan
        ? `${data.freshness.lastWebhookScan.status} at ${formatTimestamp(
            data.freshness.lastWebhookScan.completedAt ??
              data.freshness.lastWebhookScan.startedAt,
          )}`
        : "No webhook-triggered scan yet",
    },
  ] as const;
  const previewItems = [
    { label: "Accepted for future apply", value: data.findingsPage.previewCounts.readyToApply },
    { label: "Open findings", value: data.findingsPage.previewCounts.open },
    {
      label: "Safe deterministic still open",
      value: data.findingsPage.previewCounts.safeDeterministicOpen,
    },
    {
      label: "Review required still open",
      value: data.findingsPage.previewCounts.reviewRequiredOpen,
    },
    { label: "AI-assisted still open", value: data.findingsPage.previewCounts.aiAssistedOpen },
    { label: "Already applied", value: data.findingsPage.previewCounts.applied },
    { label: "Rolled back", value: data.findingsPage.previewCounts.rolledBack },
    { label: "No safe suggestion", value: data.findingsPage.previewCounts.noSafeSuggestion },
    { label: "Dismissed", value: data.findingsPage.previewCounts.dismissed },
  ] as const;
  const applyItems = [
    {
      label: "Safe accepted by default",
      value: data.findingsPage.previewCounts.safeDeterministicAccepted,
    },
    {
      label: "Review required accepted",
      value: data.findingsPage.previewCounts.reviewRequiredAccepted,
    },
    {
      label: "AI-assisted accepted",
      value: data.findingsPage.previewCounts.aiAssistedAccepted,
    },
    {
      label: "Accepted selected on this page",
      value: acceptedSelectedIds.length,
    },
  ] as const;

  return (
    <AdminPage
      eyebrow="Review status"
      title="Scan review"
      description="Review scan outcomes, filter findings, and keep apply and rollback decisions visible from the same trust-preserving surface."
    >
      <AdminPanel title="Review status" tone="forest">
        <MetricGrid columns={4} items={reviewStatusItems} />
        {data.scanRun.failureSummary ? (
          <InlineMessage tone="danger">Failure: {data.scanRun.failureSummary}</InlineMessage>
        ) : null}
        {data.readOnly ? (
          <InlineMessage tone="warning">
            Review actions are disabled while this scan is still running.
          </InlineMessage>
        ) : null}
      </AdminPanel>

      <AdminPanel title="Freshness status">
        <MetricGrid columns={3} items={freshnessItems} />
        {data.freshness.latestIssue ? (
          <InlineMessage tone="danger">
            <p>Latest freshness issue: {data.freshness.latestIssue.status}</p>
            <p>
              {data.freshness.latestIssue.lastError ??
                "CategoryFix could not finish a freshness job."}
            </p>
            <p>Recovery: run a manual scan.</p>
          </InlineMessage>
        ) : null}
      </AdminPanel>

      <AdminPanel title="Future apply preview">
        <MetricGrid columns={4} items={previewItems} />
      </AdminPanel>

      <AdminPanel
        title="Apply changes"
        subtitle="Default apply includes only accepted exact and strong matches. Accepted review-required and AI-assisted findings stay opt-in and must be selected explicitly."
      >
        <MetricGrid columns={4} items={applyItems} />
        <div className="admin-inline-actions">
          <button
            className={buttonClassName()}
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
            className={buttonClassName("secondary")}
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
        {operationError ? <InlineMessage tone="danger">{operationError}</InlineMessage> : null}
      </AdminPanel>

      <AdminPanel title="Filters">
        <Form className="admin-form-grid" method="get">
          <div className="admin-field-grid">
            <Field label="Status">
              <select defaultValue={data.filters.status} name="status">
                <option value="ALL">All</option>
                <option value="OPEN">Open</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="DISMISSED">Dismissed</option>
                <option value="APPLIED">Applied</option>
                <option value="ROLLED_BACK">Rolled back</option>
              </select>
            </Field>
            <Field label="Confidence">
              <select defaultValue={data.filters.confidence} name="confidence">
                <option value="ALL">All</option>
                <option value="EXACT">Exact</option>
                <option value="STRONG">Strong</option>
                <option value="REVIEW_REQUIRED">Review required</option>
                <option value="NO_SAFE_SUGGESTION">No safe suggestion</option>
              </select>
            </Field>
            <Field label="Product title">
              <input defaultValue={data.filters.query} name="query" type="search" />
            </Field>
          </div>
          <div className="admin-inline-actions">
            <button className={buttonClassName()} type="submit">
              Apply filters
            </button>
            <Link className={buttonClassName("ghost")} to={`/app/scans/${data.scanRun.id}`}>
              Reset
            </Link>
            <Link className={buttonClassName("secondary")} to="/app">
              Back to dashboard
            </Link>
          </div>
        </Form>
      </AdminPanel>

      <AdminPanel title="Review actions">
        <div className="admin-inline-actions">
          <reviewAction.Form method="post">
            <input name="intent" type="hidden" value="accept_safe_deterministic" />
            <button
              className={buttonClassName()}
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
              className={buttonClassName("secondary")}
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
              className={buttonClassName("ghost")}
              disabled={data.readOnly || !selectedIds.length || reviewAction.state !== "idle"}
              type="submit"
            >
              Dismiss selected
            </button>
          </reviewAction.Form>
        </div>
      </AdminPanel>

      <AdminPanel title="Findings">
        {!data.findingsPage.items.length ? (
          <p className="admin-empty">
            No findings match the current filters. Adjust the filters or review a different scan run.
          </p>
        ) : (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>
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
                  <th>Product</th>
                  <th>Current category</th>
                  <th>Suggested category</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Details</th>
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
                        <div className="admin-stack">
                          <strong>{finding.productTitle}</strong>
                          <span className="admin-soft">
                            {finding.productHandle ? `/${finding.productHandle}` : "No handle"}
                          </span>
                          {finding.assistance ? (
                            <StatusBadge tone="accent">{finding.assistance.label}</StatusBadge>
                          ) : null}
                        </div>
                      </td>
                      <td>{finding.currentCategory?.fullPath ?? "No category set"}</td>
                      <td>{finding.recommendedCategory?.fullPath ?? "No safe suggestion"}</td>
                      <td>{confidenceLabel(finding.confidence)}</td>
                      <td>
                        <StatusBadge tone={renderStatusTone(finding.status)}>
                          {statusLabel(finding.status)}
                        </StatusBadge>
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

        <div className="admin-inline-actions">
          <span className="admin-muted">
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
          {navigation.state !== "idle" ? <span className="admin-muted">Loading...</span> : null}
        </div>
      </AdminPanel>

      <AdminPanel title="Latest apply job">
        {latestApplyJob ? (
          <div className="admin-stack">
            <MetricGrid
              columns={4}
              items={[
                { label: "Apply job", value: latestApplyJob.id },
                {
                  label: "Status",
                  value: (
                    <StatusBadge tone={renderStatusTone(latestApplyJob.status)}>
                      {statusLabel(latestApplyJob.status)}
                    </StatusBadge>
                  ),
                  tone: renderStatusTone(latestApplyJob.status),
                },
                {
                  label: "Applied",
                  value: `${latestApplyJob.appliedCount} of ${latestApplyJob.selectedFindingCount}`,
                },
                { label: "Failed", value: latestApplyJob.failedCount },
                { label: "Started", value: formatTimestamp(latestApplyJob.startedAt) },
                { label: "Completed", value: formatTimestamp(latestApplyJob.completedAt) },
              ]}
            />

            {latestApplyJob.rollbackEligibleCount > 0 ? (
              <div className="admin-inline-actions">
                <button
                  className={buttonClassName("secondary")}
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

            <div className="admin-table-shell">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Status</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {latestApplyJob.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productTitle ?? item.productId}</td>
                      <td>{item.before.category?.fullPath ?? "No category set"}</td>
                      <td>{item.after.category?.fullPath ?? "Clear category"}</td>
                      <td>
                        <StatusBadge tone={renderStatusTone(item.status)}>
                          {statusLabel(item.status)}
                        </StatusBadge>
                      </td>
                      <td>{item.errorMessage ?? "No error"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="admin-empty">No apply jobs have run yet for this shop.</p>
        )}
      </AdminPanel>

      <AdminPanel title="Latest rollback job">
        {latestRollbackJob ? (
          <div className="admin-stack">
            <MetricGrid
              columns={4}
              items={[
                { label: "Rollback job", value: latestRollbackJob.id },
                {
                  label: "Status",
                  value: (
                    <StatusBadge tone={renderStatusTone(latestRollbackJob.status)}>
                      {statusLabel(latestRollbackJob.status)}
                    </StatusBadge>
                  ),
                  tone: renderStatusTone(latestRollbackJob.status),
                },
                {
                  label: "Rolled back",
                  value: `${latestRollbackJob.rolledBackCount} of ${latestRollbackJob.selectedItemCount}`,
                },
                { label: "Failed", value: latestRollbackJob.failedCount },
              ]}
            />

            <div className="admin-table-shell">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current</th>
                    <th>Restore to</th>
                    <th>Status</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {latestRollbackJob.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productTitle ?? item.productId}</td>
                      <td>{item.before.category?.fullPath ?? "No category set"}</td>
                      <td>{item.after.category?.fullPath ?? "Clear category"}</td>
                      <td>
                        <StatusBadge tone={renderStatusTone(item.status)}>
                          {statusLabel(item.status)}
                        </StatusBadge>
                      </td>
                      <td>{item.errorMessage ?? "No error"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="admin-empty">No rollback job has run in this browser session yet.</p>
        )}
      </AdminPanel>

      <AdminPanel title="Recent apply jobs">
        {data.applyJobs.length ? (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th>Failed</th>
                  <th>Completed</th>
                  <th>Undo</th>
                </tr>
              </thead>
              <tbody>
                {data.applyJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>
                      <StatusBadge tone={renderStatusTone(job.status)}>
                        {statusLabel(job.status)}
                      </StatusBadge>
                    </td>
                    <td>{job.appliedCount}</td>
                    <td>{job.failedCount}</td>
                    <td>{formatTimestamp(job.completedAt)}</td>
                    <td>
                      <button
                        className={buttonClassName("ghost")}
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
          <p className="admin-empty">No apply jobs recorded yet.</p>
        )}
      </AdminPanel>

      <AdminPanel title="Recent rollback jobs">
        {data.rollbackJobs.length ? (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Rolled back</th>
                  <th>Failed</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {data.rollbackJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>
                      <StatusBadge tone={renderStatusTone(job.status)}>
                        {statusLabel(job.status)}
                      </StatusBadge>
                    </td>
                    <td>{job.rolledBackCount}</td>
                    <td>{job.failedCount}</td>
                    <td>{formatTimestamp(job.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty">No rollback jobs recorded yet.</p>
        )}
      </AdminPanel>

      <AdminPanel title="Recent freshness jobs">
        {data.recentFreshnessJobs.length ? (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Available</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {data.recentFreshnessJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.kind}</td>
                    <td>
                      <StatusBadge tone={renderStatusTone(job.status)}>
                        {statusLabel(job.status)}
                      </StatusBadge>
                    </td>
                    <td>{formatTimestamp(job.availableAt)}</td>
                    <td>{job.lastError ?? "No error"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty">No freshness jobs recorded yet.</p>
        )}
      </AdminPanel>

      <AdminPanel title="Audit timeline">
        {data.auditTimeline.length ? (
          <div className="admin-audit-list">
            {data.auditTimeline.map((event) => (
              <article className="admin-audit-card" key={event.id}>
                <p>
                  <strong>{formatAuditEvent(event.eventType)}</strong>
                </p>
                <p>When: {formatTimestamp(event.createdAt)}</p>
                <p>Actor: {event.actor}</p>
                {event.applyJobId ? <p>Apply job: {event.applyJobId}</p> : null}
                {event.rollbackJobId ? <p>Rollback job: {event.rollbackJobId}</p> : null}
                {event.reason ? <p>Detail: {event.reason}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty">No apply or rollback audit events recorded yet.</p>
        )}
      </AdminPanel>

      <AdminPanel title="Recent runs">
        <div className="admin-chip-row">
          {data.scanHistory.map((scan) => (
            <Link className="admin-chip" key={scan.id} to={`/app/scans/${scan.id}`}>
              <strong>{scan.id}</strong>
            </Link>
          ))}
        </div>
      </AdminPanel>

      {data.selectedFinding ? (
        <div className="admin-drawer">
          <aside className="admin-drawer-surface">
            <div className="admin-drawer-header">
              <div className="admin-drawer-title">
                <strong>{data.selectedFinding.productTitle}</strong>
                <StatusBadge tone={renderStatusTone(data.selectedFinding.status)}>
                  {statusLabel(data.selectedFinding.status)}
                </StatusBadge>
              </div>
              <Link className={buttonClassName("ghost")} to={drawerCloseSearch}>
                Close
              </Link>
            </div>

            <div className="admin-drawer-sections">
              <MetricGrid
                columns={2}
                items={[
                  {
                    label: "Current category",
                    value: data.selectedFinding.currentCategory?.fullPath ?? "No category set",
                  },
                  {
                    label: "Suggested category",
                    value:
                      data.selectedFinding.recommendedCategory?.fullPath ?? "No safe suggestion",
                  },
                  {
                    label: "Confidence",
                    value: confidenceLabel(data.selectedFinding.confidence),
                  },
                  { label: "Basis items", value: data.selectedFinding.basisCount },
                  { label: "Blockers", value: data.selectedFinding.blockerCount },
                ]}
              />

              {data.selectedFinding.assistance ? (
                <InlineMessage tone="accent">
                  <p>{data.selectedFinding.assistance.label}</p>
                  <p>{data.selectedFinding.assistance.disclosure}</p>
                  <p>AI summary: {data.selectedFinding.assistance.summary}</p>
                </InlineMessage>
              ) : null}

              <div className="admin-inline-actions">
                <reviewAction.Form method="post">
                  <input name="intent" type="hidden" value="accept_selected" />
                  <input name="findingId" type="hidden" value={data.selectedFinding.id} />
                  <button
                    className={buttonClassName()}
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
                  <button
                    className={buttonClassName("secondary")}
                    disabled={data.readOnly || reviewAction.state !== "idle"}
                    type="submit"
                  >
                    Dismiss suggestion
                  </button>
                </reviewAction.Form>
              </div>

              <section className="admin-detail-section">
                <h3>Why CategoryFix suggested this</h3>
                {data.selectedFinding.explanation.basis.length ? (
                  <ul>
                    {data.selectedFinding.explanation.basis.map((basis) => (
                      <li key={`${basis.source}-${basis.matchedTerm}-${basis.rawValue}`}>
                        {basis.source}: matched "{basis.rawValue}" to "{basis.taxonomyFullPath}" via{" "}
                        {basis.matchType.toLowerCase().replaceAll("_", " ")} on "{basis.matchedTerm}".
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No positive basis facts were recorded for this finding.</p>
                )}
              </section>

              <section className="admin-detail-section">
                <h3>Uncertainty and blockers</h3>
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

              <section className="admin-detail-section">
                <h3>Product signals reviewed</h3>
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
          </aside>
        </div>
      ) : null}
    </AdminPage>
  );
}
