import { startTransition, useEffect, useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  createScanDashboardResponse,
  type ScanDashboardPayload,
} from "../lib/scan-review.server.js";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const response = await createScanDashboardResponse({
    request,
    authenticateAdmin: authenticate.admin,
    database: prisma,
  });

  return (await response.json()) as ScanDashboardPayload;
};

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

function renderStatusTone(status: string) {
  switch (status) {
    case "SUCCEEDED":
      return "#1f7a1f";
    case "FAILED":
      return "#8a1f17";
    case "RUNNING":
    case "PENDING":
      return "#6f4e00";
    default:
      return "#444";
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

  return (
    <s-page heading="CategoryFix review">
      <s-section heading="Merchant review workspace">
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <p style={{ margin: 0 }}>
            Inspect explainable category suggestions before any write occurs.
            Safe deterministic findings can be bulk accepted, while review-only
            suggestions stay visibly uncertain.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              disabled={isStarting || scanIsRunning}
              onClick={() => {
                void startScan();
              }}
              type="button"
            >
              {isStarting ? "Starting scan..." : scanIsRunning ? "Scan running" : "Start scan"}
            </button>
            {latestReviewPath ? <Link to={latestReviewPath}>Open latest review</Link> : null}
            <a href={data.scanEndpoint}>Latest scan JSON</a>
          </div>
          {errorMessage ? (
            <p style={{ margin: 0, color: "#8a1f17" }}>{errorMessage}</p>
          ) : null}
          {scanPayload.scanRun?.failureSummary ? (
            <p style={{ margin: 0, color: "#8a1f17" }}>
              Latest failure: {scanPayload.scanRun.failureSummary}
            </p>
          ) : null}
        </div>
      </s-section>

      <s-section heading="Latest scan">
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0 }}>
            Status:{" "}
            <strong style={{ color: renderStatusTone(scanPayload.scanRun?.status ?? "UNKNOWN") }}>
              {scanPayload.scanRun?.status ?? "No scan recorded yet"}
            </strong>
          </p>
          <p style={{ margin: 0 }}>
            Started: {formatTimestamp(scanPayload.scanRun?.startedAt ?? null)}
          </p>
          <p style={{ margin: 0 }}>
            Completed: {formatTimestamp(scanPayload.scanRun?.completedAt ?? null)}
          </p>
          <p style={{ margin: 0 }}>
            Products scanned: {scanPayload.scanRun?.scannedProductCount ?? 0}
          </p>
          <p style={{ margin: 0 }}>
            Findings persisted: {scanPayload.scanRun?.findingCount ?? 0}
          </p>
          <p style={{ margin: 0 }}>
            Accepted for future apply: {scanPayload.scanRun?.acceptedFindingCount ?? 0}
          </p>
          <p style={{ margin: 0 }}>
            Dismissed: {scanPayload.scanRun?.rejectedFindingCount ?? 0}
          </p>
          <p style={{ margin: 0 }}>Exact: {scanPayload.confidenceCounts.exact}</p>
          <p style={{ margin: 0 }}>Strong: {scanPayload.confidenceCounts.strong}</p>
          <p style={{ margin: 0 }}>
            Review required: {scanPayload.confidenceCounts.reviewRequired}
          </p>
          <p style={{ margin: 0 }}>
            No safe suggestion: {scanPayload.confidenceCounts.noSafeSuggestion}
          </p>
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

      <s-section heading="Scan history">
        {data.scanHistory.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Run</th>
                  <th align="left">Status</th>
                  <th align="left">Completed</th>
                  <th align="right">Findings</th>
                  <th align="right">Accepted</th>
                  <th align="right">Dismissed</th>
                  <th align="left">Review</th>
                </tr>
              </thead>
              <tbody>
                {data.scanHistory.map((scan) => (
                  <tr key={scan.id}>
                    <td style={{ padding: "0.4rem 0" }}>
                      <div style={{ display: "grid", gap: "0.2rem" }}>
                        <span>{scan.id}</span>
                        <span>{scan.trigger === "WEBHOOK" ? "Webhook refresh" : "Manual scan"}</span>
                      </div>
                    </td>
                    <td style={{ color: renderStatusTone(scan.status) }}>{scan.status}</td>
                    <td>{formatTimestamp(scan.completedAt)}</td>
                    <td align="right">{scan.findingCount}</td>
                    <td align="right">{scan.acceptedFindingCount}</td>
                    <td align="right">{scan.rejectedFindingCount}</td>
                    <td>
                      <Link to={`/app/scans/${scan.id}`}>Open review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0 }}>
            No scan history yet. Start a scan to generate deterministic review
            suggestions.
          </p>
        )}
      </s-section>

      <s-section heading="Current shop">
        <s-stack direction="block" gap="small">
          <s-text>{data.shop}</s-text>
          <s-text>
            Install state: {data.installation?.state ?? "MISSING_RECORD"}
          </s-text>
          <s-text>
            Scopes:{" "}
            {data.installation?.scopes.length
              ? data.installation.scopes.join(", ")
              : "No scopes recorded yet"}
          </s-text>
          <s-text>
            Installed at: {data.installation?.installedAt ?? "Not recorded yet"}
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}
