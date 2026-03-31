import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScanFindingStatus } from "@prisma/client";
import {
  createApplyJobMutationResponse,
  createApplyJobStatusResponse,
  createRollbackJobMutationResponse,
  createRollbackJobStatusResponse,
} from "../app/lib/apply-jobs.server.js";
import { createReviewMutationResponse, createScanReviewResponse } from "../app/lib/scan-review.server.js";
import {
  getMockReviewDatabase,
  mockWriteProductCategory,
  resetMockReviewState,
} from "../app/lib/scan-review.mock.server.js";

const authenticateAdmin = vi.fn(async () => ({
  session: { shop: "demo.myshopify.com" },
}));

describe("phase 5 apply and rollback flows", () => {
  beforeEach(() => {
    process.env.CATEGORYFIX_E2E_MOCK = "1";
    resetMockReviewState();
  });

  afterEach(() => {
    delete process.env.CATEGORYFIX_E2E_MOCK;
    resetMockReviewState();
  });

  it("applies accepted exact and strong findings and exposes job status polling", async () => {
    const database = getMockReviewDatabase();

    await createReviewMutationResponse({
      request: new Request("https://app.categoryfix.com/app/scans/scan_mock_completed", {
        method: "POST",
        body: new URLSearchParams({
          intent: "accept_safe_deterministic",
        }),
      }),
      scanRunId: "scan_mock_completed",
      authenticateAdmin,
      database,
    });

    const response = await createApplyJobMutationResponse({
      request: new Request("https://app.categoryfix.com/api/v1/apply-jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          scanRunId: "scan_mock_completed",
        }),
      }),
      authenticateAdmin,
      database,
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.job.appliedCount).toBe(2);
    expect(payload.job.failedCount).toBe(0);
    expect(payload.job.items).toHaveLength(2);

    const statusResponse = await createApplyJobStatusResponse({
      request: new Request(`https://app.categoryfix.com/api/v1/apply-jobs/${payload.job.id}`),
      applyJobId: payload.job.id,
      authenticateAdmin,
      database,
    });
    const statusPayload = await statusResponse.json();

    expect(statusPayload.job.status).toBe("SUCCEEDED");

    const appliedFindings = (await database.scanFinding.findMany({
      where: {
        id: { in: ["finding_mock_1", "finding_mock_4"] },
      },
    })) as Array<{ status: ScanFindingStatus }>;

    expect(appliedFindings.every((finding) => finding.status === ScanFindingStatus.APPLIED)).toBe(true);
  });

  it("supports explicit review-required apply plus full-job rollback", async () => {
    const database = getMockReviewDatabase();

    await createReviewMutationResponse({
      request: new Request("https://app.categoryfix.com/app/scans/scan_mock_completed", {
        method: "POST",
        body: new URLSearchParams({
          intent: "accept_selected",
          findingId: "finding_mock_2",
        }),
      }),
      scanRunId: "scan_mock_completed",
      authenticateAdmin,
      database,
    });

    const applyResponse = await createApplyJobMutationResponse({
      request: new Request("https://app.categoryfix.com/api/v1/apply-jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          scanRunId: "scan_mock_completed",
          findingIds: ["finding_mock_2"],
        }),
      }),
      authenticateAdmin,
      database,
    });
    const applyPayload = await applyResponse.json();

    expect(applyResponse.status).toBe(200);
    expect(applyPayload.job.appliedCount).toBe(1);
    expect(applyPayload.job.items[0]?.status).toBe("SUCCEEDED");

    const rollbackResponse = await createRollbackJobMutationResponse({
      request: new Request("https://app.categoryfix.com/api/v1/rollback-jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          applyJobId: applyPayload.job.id,
        }),
      }),
      authenticateAdmin,
      database,
    });
    const rollbackPayload = await rollbackResponse.json();

    expect(rollbackResponse.status).toBe(200);
    expect(rollbackPayload.job.rolledBackCount).toBe(1);
    expect(rollbackPayload.job.items[0]?.after.category).toBeNull();

    const rollbackStatusResponse = await createRollbackJobStatusResponse({
      request: new Request(
        `https://app.categoryfix.com/api/v1/rollback-jobs/${rollbackPayload.job.id}`,
      ),
      rollbackJobId: rollbackPayload.job.id,
      authenticateAdmin,
      database,
    });
    const rollbackStatusPayload = await rollbackStatusResponse.json();

    expect(rollbackStatusPayload.job.status).toBe("SUCCEEDED");

    const rolledBackFinding = (await database.scanFinding.findUnique({
      where: { id: "finding_mock_2" },
    })) as { status: ScanFindingStatus };

    expect(rolledBackFinding.status).toBe(ScanFindingStatus.ROLLED_BACK);
  });

  it("skips stale items, surfaces partial failure, and records audit events", async () => {
    const database = getMockReviewDatabase();

    await createReviewMutationResponse({
      request: new Request("https://app.categoryfix.com/app/scans/scan_mock_completed", {
        method: "POST",
        body: new URLSearchParams({
          intent: "accept_safe_deterministic",
        }),
      }),
      scanRunId: "scan_mock_completed",
      authenticateAdmin,
      database,
    });
    await mockWriteProductCategory(
      "gid://shopify/Product/100",
      "gid://shopify/TaxonomyCategory/aa-2-17",
    );

    const response = await createApplyJobMutationResponse({
      request: new Request("https://app.categoryfix.com/api/v1/apply-jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          scanRunId: "scan_mock_completed",
        }),
      }),
      authenticateAdmin,
      database,
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.job.status).toBe("PARTIALLY_SUCCEEDED");
    expect(payload.job.failedCount).toBe(1);
    expect(payload.job.items.some((item: { errorMessage: string | null }) => item.errorMessage?.includes("changed in Shopify"))).toBe(true);

    const reviewResponse = await createScanReviewResponse({
      request: new Request("https://app.categoryfix.com/app/scans/scan_mock_completed"),
      scanRunId: "scan_mock_completed",
      authenticateAdmin,
      database,
    });
    const reviewPayload = await reviewResponse.json();

    expect(reviewPayload.applyJobs[0]?.id).toBe(payload.job.id);
    expect(reviewPayload.auditTimeline.length).toBeGreaterThan(0);
    expect(reviewPayload.auditTimeline.some((event: { eventType: string }) => event.eventType === "apply_job_item_failed")).toBe(true);
  });
});
