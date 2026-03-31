import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getLatestScanRunForShop, getShopSettings } from "@categoryfix/db";
import { prisma } from "../db.server.js";
import { serializeScanPayload } from "../lib/scans.server.js";
import { authenticate } from "../shopify.server.js";

interface ScanPayload {
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
  const { session } = await authenticate.admin(request);
  const installation = await getShopSettings(session.shop, prisma);
  const shopRecord = await prisma.shop.findUnique({
    where: { shop: session.shop },
    select: { id: true },
  });
  const latestScanRun = shopRecord ? await getLatestScanRunForShop(shopRecord.id, prisma) : null;

  return {
    healthEndpoint: "/api/v1/health",
    installation,
    latestScan: serializeScanPayload(latestScanRun),
    scanEndpoint: "/api/v1/scans",
    settingsEndpoint: "/api/v1/shop/settings",
    shop: session.shop,
  };
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

function isActiveScan(payload: ScanPayload) {
  return payload.scanRun?.status === "PENDING" || payload.scanRun?.status === "RUNNING";
}

export default function AppIndexRoute() {
  const data = useLoaderData<typeof loader>();
  const [scanPayload, setScanPayload] = useState<ScanPayload>(data.latestScan);
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
      const payload = (await response.json()) as ScanPayload | { error?: string };

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setErrorMessage("The scan status could not be refreshed.");
        return;
      }

      setScanPayload(payload as ScanPayload);
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [scanPayload.scanRun?.id, scanPayload.scanRun?.status]);

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
      const payload = (await response.json()) as ScanPayload | { error?: string };

      if (!response.ok && response.status !== 409) {
        setErrorMessage(
          "error" in payload && payload.error
            ? payload.error
            : "The scan could not be started.",
        );
        return;
      }

      setScanPayload(payload as ScanPayload);
    } catch {
      setErrorMessage("The scan could not be started.");
    } finally {
      setIsStarting(false);
    }
  };

  const scanIsRunning = isActiveScan(scanPayload);

  return (
    <s-page heading="CategoryFix">
      <s-section heading="Phase 3 deterministic scan">
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <p style={{ margin: 0 }}>
            Start a conservative catalog scan that generates explainable
            recommendations without applying any writes.
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
            <a href={data.scanEndpoint}>Latest scan JSON</a>
          </div>
          {errorMessage ? (
            <p style={{ margin: 0, color: "#8a1f17" }}>{errorMessage}</p>
          ) : null}
        </div>
      </s-section>

      <s-section heading="Latest scan">
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0 }}>
            Status: {scanPayload.scanRun?.status ?? "No scan recorded yet"}
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
          <p style={{ margin: 0 }}>Exact: {scanPayload.confidenceCounts.exact}</p>
          <p style={{ margin: 0 }}>Strong: {scanPayload.confidenceCounts.strong}</p>
          <p style={{ margin: 0 }}>
            Review required: {scanPayload.confidenceCounts.reviewRequired}
          </p>
          <p style={{ margin: 0 }}>
            No safe suggestion: {scanPayload.confidenceCounts.noSafeSuggestion}
          </p>
          {scanPayload.scanRun?.failureSummary ? (
            <p style={{ margin: 0, color: "#8a1f17" }}>
              Failure: {scanPayload.scanRun.failureSummary}
            </p>
          ) : null}
        </div>
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

      <s-section heading="Phase endpoints">
        <s-stack direction="block" gap="small">
          <s-link href={data.healthEndpoint}>{data.healthEndpoint}</s-link>
          <s-link href={data.settingsEndpoint}>{data.settingsEndpoint}</s-link>
          <s-link href={data.scanEndpoint}>{data.scanEndpoint}</s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}
