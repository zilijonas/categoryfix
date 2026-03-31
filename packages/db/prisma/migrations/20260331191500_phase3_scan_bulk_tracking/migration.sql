ALTER TABLE "ScanRun"
ADD COLUMN "externalOperationId" TEXT,
ADD COLUMN "externalOperationStatus" TEXT;

CREATE INDEX "ScanRun_shopId_status_createdAt_idx"
ON "ScanRun"("shopId", "status", "createdAt");
