import { startTransition, useEffect, useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  AdminPage,
  AdminPanel,
  InlineMessage,
  MetricGrid,
  StatusBadge,
  buttonClassName,
} from "../components/admin-ui.js";
import {
  createScanDashboardResponse,
  type ScanDashboardPayload,
} from "../lib/scan-review.server.js";
import { withRouteErrorReporting } from "../lib/route-observability.server.js";
import { authenticate } from "../shopify.server.js";
import { prisma } from "../db.server.js";

interface ScanStatusPayload {
  scanRun: {
    id: string;
    status: string;
    trigger: string;
    source: string;
    startedAt: string | null;
    completedAt: string | null;
    scannedProductCount: number;
    findingCount: number;
    acceptedFindingCount: number;
    rejectedFindingCount: number;
    failureSummary: string | null;
  } | null;
  confidenceCounts: {
    exact: number;
    strong: number;
    reviewRequired: number;
    noSafeSuggestion: number;
  };
}

export const loader = withRouteErrorReporting(
  "app._index",
  "loader",
  async ({ request }: LoaderFunctionArgs) => {
  const response = await createScanDashboardResponse({
    request,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });

  return (await response.json()) as ScanDashboardPayload;
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

function isActiveScan(payload: ScanStatusPayload) {
  return payload.scanRun?.status === "PENDING" || payload.scanRun?.status === "RUNNING";
}

function renderStatusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "danger";
    case "RUNNING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

export default function AppIndexRoute() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [scanPayload, setScanPayload] = useState<ScanStatusPayload>(data.latestScan);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setScanPayload(data.latestScan);
  }, [data.latestScan]);

  useEffect(() => {
    if (!scanPayload.scanRun?.id || !isActiveScan(scanPayload)) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const response = await fetch(`/api/v1/scans/${scanPayload.scanRun?.id}`);
      const payload = (await response.json()) as ScanStatusPayload | { error?: string };

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setErrorMessage("The scan status could not be refreshed.");
        return;
      }

      const nextPayload = payload as ScanStatusPayload;
      setScanPayload(nextPayload);

      if (!isActiveScan(nextPayload)) {
        startTransition(() => {
          revalidator.revalidate();
        });
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [revalidator, scanPayload.scanRun?.id, scanPayload.scanRun?.status]);

  const startScan = async () => {
    setIsStarting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(data.scanEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ trigger: "MANUAL" }),
      });
      const payload = (await response.json()) as ScanStatusPayload | { error?: string };

      if (!response.ok && response.status !== 409) {
        setErrorMessage(
          "error" in payload && payload.error
            ? payload.error
            : "The scan could not be started.",
        );
        return;
      }

      setScanPayload(payload as ScanStatusPayload);
      startTransition(() => {
        revalidator.revalidate();
      });
    } catch {
      setErrorMessage("The scan could not be started.");
    } finally {
      setIsStarting(false);
    }
  };

  const latestReviewPath = scanPayload.scanRun
    ? `/app/scans/${scanPayload.scanRun.id}`
    : data.reviewPath;
  const scanIsRunning = isActiveScan(scanPayload);
  const latestScanItems = [
    {
      label: "Status",
      value: (
        <StatusBadge tone={renderStatusTone(scanPayload.scanRun?.status ?? "UNKNOWN")}>
          {scanPayload.scanRun?.status ?? "No scan recorded yet"}
        </StatusBadge>
      ),
      tone: renderStatusTone(scanPayload.scanRun?.status ?? "UNKNOWN"),
    },
    {
      label: "Started",
      value: formatTimestamp(scanPayload.scanRun?.startedAt ?? null),
    },
    {
      label: "Completed",
      value: formatTimestamp(scanPayload.scanRun?.completedAt ?? null),
    },
    {
      label: "Products scanned",
      value: scanPayload.scanRun?.scannedProductCount ?? 0,
    },
    {
      label: "Findings persisted",
      value: scanPayload.scanRun?.findingCount ?? 0,
    },
    {
      label: "Accepted for future apply",
      value: scanPayload.scanRun?.acceptedFindingCount ?? 0,
    },
    {
      label: "Dismissed",
      value: scanPayload.scanRun?.rejectedFindingCount ?? 0,
    },
    {
      label: "Exact",
      value: scanPayload.confidenceCounts.exact,
    },
    {
      label: "Strong",
      value: scanPayload.confidenceCounts.strong,
    },
    {
      label: "Review required",
      value: scanPayload.confidenceCounts.reviewRequired,
    },
    {
      label: "No safe suggestion",
      value: scanPayload.confidenceCounts.noSafeSuggestion,
    },
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
  const installationChips = [
    { label: "Shop", value: data.shop },
    { label: "Install state", value: data.installation?.state ?? "MISSING_RECORD" },
    {
      label: "Scopes",
      value: data.installation?.scopes.length
        ? data.installation.scopes.join(", ")
        : "No scopes recorded yet",
    },
    { label: "Installed at", value: data.installation?.installedAt ?? "Not recorded yet" },
  ];

  return (
    <AdminPage
      eyebrow="Merchant review workspace"
      title="CategoryFix review"
      description="Inspect explainable category suggestions before any write occurs. Safe deterministic findings can be bulk accepted, while review-only suggestions stay visibly uncertain."
    >
      <AdminPanel
        title="Merchant review workspace"
        subtitle="This is the control surface for scan starts, review entry, and trust-preserving visibility into the current shop state."
        actions={
          <div className="admin-inline-actions">
            <button
              className={buttonClassName()}
              disabled={isStarting || scanIsRunning}
              onClick={() => {
                void startScan();
              }}
              type="button"
            >
              {isStarting ? "Starting scan..." : scanIsRunning ? "Scan running" : "Start scan"}
            </button>
            {latestReviewPath ? (
              <Link className={buttonClassName("secondary")} to={latestReviewPath}>
                Open latest review
              </Link>
            ) : null}
            <a className={buttonClassName("ghost")} href={data.scanEndpoint}>
              Latest scan JSON
            </a>
          </div>
        }
        tone="forest"
      >
        {errorMessage ? <InlineMessage tone="danger">{errorMessage}</InlineMessage> : null}
        {scanPayload.scanRun?.failureSummary ? (
          <InlineMessage tone="danger">
            Latest failure: {scanPayload.scanRun.failureSummary}
          </InlineMessage>
        ) : null}
      </AdminPanel>

      <AdminPanel title="Latest scan">
        <MetricGrid columns={4} items={latestScanItems} />
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

      <AdminPanel title="Scan history">
        {data.scanHistory.length ? (
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th>Completed</th>
                  <th>Findings</th>
                  <th>Accepted</th>
                  <th>Dismissed</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {data.scanHistory.map((scan) => (
                  <tr key={scan.id}>
                    <td>
                      <div className="admin-stack">
                        <strong>{scan.id}</strong>
                        <span className="admin-soft">
                          {scan.trigger === "WEBHOOK" ? "Webhook refresh" : "Manual scan"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge tone={renderStatusTone(scan.status)}>{scan.status}</StatusBadge>
                    </td>
                    <td>{formatTimestamp(scan.completedAt)}</td>
                    <td>{scan.findingCount}</td>
                    <td>{scan.acceptedFindingCount}</td>
                    <td>{scan.rejectedFindingCount}</td>
                    <td>
                      <Link to={`/app/scans/${scan.id}`}>Open review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty">
            No scan history yet. Start a scan to generate deterministic review suggestions.
          </p>
        )}
      </AdminPanel>

      <AdminPanel title="Current shop">
        <div className="admin-chip-row">
          {installationChips.map((item) => (
            <div className="admin-chip" key={item.label}>
              <strong>{item.label}:</strong> {item.value}
            </div>
          ))}
        </div>
      </AdminPanel>
    </AdminPage>
  );
}
