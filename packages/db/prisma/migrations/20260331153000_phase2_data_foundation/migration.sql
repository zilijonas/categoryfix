-- CreateEnum
CREATE TYPE "ScanRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ScanRunTrigger" AS ENUM ('MANUAL', 'INSTALL', 'WEBHOOK', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ScanFindingConfidence" AS ENUM ('EXACT', 'STRONG', 'REVIEW_REQUIRED', 'NO_SAFE_SUGGESTION');

-- CreateEnum
CREATE TYPE "ScanFindingStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED', 'APPLIED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "RuleDefinitionState" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('SYSTEM', 'USER', 'SHOPIFY');

-- CreateEnum
CREATE TYPE "ShopSubscriptionStatus" AS ENUM ('INACTIVE', 'PENDING', 'ACTIVE', 'CANCELED');

-- CreateEnum
CREATE TYPE "BillingEventType" AS ENUM ('PLACEHOLDER');

-- CreateEnum
CREATE TYPE "TaxonomyCategoryTermKind" AS ENUM ('PRIMARY_NAME', 'KEYWORD', 'ALIAS', 'PATH');

-- Preserve phase 1 install data while promoting the canonical shop table name.
ALTER TABLE "ShopInstallation" RENAME TO "Shop";
ALTER TABLE "Shop" RENAME CONSTRAINT "ShopInstallation_pkey" TO "Shop_pkey";
ALTER INDEX "ShopInstallation_shop_key" RENAME TO "Shop_shop_key";
ALTER INDEX "ShopInstallation_offlineSessionId_key" RENAME TO "Shop_offlineSessionId_key";

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" "ScanRunStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" "ScanRunTrigger" NOT NULL,
    "source" TEXT NOT NULL,
    "taxonomyVersionId" TEXT,
    "scannedProductCount" INTEGER NOT NULL DEFAULT 0,
    "findingCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedFindingCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedFindingCount" INTEGER NOT NULL DEFAULT 0,
    "failureSummary" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanFinding" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "scanRunId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "productHandle" TEXT,
    "productTitle" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "currentCategoryId" TEXT,
    "currentCategoryGid" TEXT,
    "recommendedCategoryId" TEXT,
    "recommendedCategoryGid" TEXT,
    "confidence" "ScanFindingConfidence" NOT NULL,
    "status" "ScanFindingStatus" NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualOverride" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "targetCategoryId" TEXT,
    "targetCategoryGid" TEXT,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "state" "RuleDefinitionState" NOT NULL DEFAULT 'ACTIVE',
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplyJob" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "selectedFindingCount" INTEGER NOT NULL DEFAULT 0,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplyJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplyJobItem" (
    "id" TEXT NOT NULL,
    "applyJobId" TEXT NOT NULL,
    "scanFindingId" TEXT,
    "productId" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplyJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollbackJob" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "applyJobId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "selectedItemCount" INTEGER NOT NULL DEFAULT 0,
    "rolledBackCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RollbackJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollbackJobItem" (
    "id" TEXT NOT NULL,
    "rollbackJobId" TEXT NOT NULL,
    "applyJobItemId" TEXT,
    "productId" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RollbackJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actor" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "payload" JSONB,
    "scanRunId" TEXT,
    "manualOverrideId" TEXT,
    "applyJobId" TEXT,
    "applyJobItemId" TEXT,
    "rollbackJobId" TEXT,
    "rollbackJobItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSubscription" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" "ShopSubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "planHandle" TEXT,
    "externalReference" TEXT,
    "activatedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "eventType" "BillingEventType" NOT NULL,
    "externalReference" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "releasedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyCategory" (
    "id" TEXT NOT NULL,
    "taxonomyVersionId" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "taxonomyGid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "parentTaxonomyId" TEXT,
    "level" INTEGER NOT NULL,
    "isLeaf" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyCategoryTerm" (
    "id" TEXT NOT NULL,
    "taxonomyVersionId" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "kind" "TaxonomyCategoryTermKind" NOT NULL,
    "term" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxonomyCategoryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanRun_shopId_createdAt_idx" ON "ScanRun"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanRun_status_createdAt_idx" ON "ScanRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScanFinding_shopId_productId_idx" ON "ScanFinding"("shopId", "productId");

-- CreateIndex
CREATE INDEX "ScanFinding_scanRunId_status_idx" ON "ScanFinding"("scanRunId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScanFinding_scanRunId_productId_key" ON "ScanFinding"("scanRunId", "productId");

-- CreateIndex
CREATE INDEX "ManualOverride_shopId_productId_active_idx" ON "ManualOverride"("shopId", "productId", "active");

-- CreateIndex
CREATE INDEX "ManualOverride_shopId_createdAt_idx" ON "ManualOverride"("shopId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuleDefinition_key_key" ON "RuleDefinition"("key");

-- CreateIndex
CREATE INDEX "ApplyJob_shopId_createdAt_idx" ON "ApplyJob"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplyJobItem_applyJobId_status_idx" ON "ApplyJobItem"("applyJobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplyJobItem_applyJobId_productId_key" ON "ApplyJobItem"("applyJobId", "productId");

-- CreateIndex
CREATE INDEX "RollbackJob_shopId_createdAt_idx" ON "RollbackJob"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "RollbackJobItem_rollbackJobId_status_idx" ON "RollbackJobItem"("rollbackJobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RollbackJobItem_rollbackJobId_productId_key" ON "RollbackJobItem"("rollbackJobId", "productId");

-- CreateIndex
CREATE INDEX "AuditEvent_shopId_createdAt_idx" ON "AuditEvent"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "ShopSubscription_shopId_status_idx" ON "ShopSubscription"("shopId", "status");

-- CreateIndex
CREATE INDEX "BillingEvent_shopId_eventType_idx" ON "BillingEvent"("shopId", "eventType");

-- CreateIndex
CREATE INDEX "TaxonomyVersion_releasedAt_createdAt_idx" ON "TaxonomyVersion"("releasedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyVersion_version_locale_key" ON "TaxonomyVersion"("version", "locale");

-- CreateIndex
CREATE INDEX "TaxonomyCategory_taxonomyVersionId_name_idx" ON "TaxonomyCategory"("taxonomyVersionId", "name");

-- CreateIndex
CREATE INDEX "TaxonomyCategory_taxonomyVersionId_parentTaxonomyId_idx" ON "TaxonomyCategory"("taxonomyVersionId", "parentTaxonomyId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyCategory_taxonomyVersionId_taxonomyId_key" ON "TaxonomyCategory"("taxonomyVersionId", "taxonomyId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyCategory_taxonomyVersionId_taxonomyGid_key" ON "TaxonomyCategory"("taxonomyVersionId", "taxonomyGid");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyCategory_taxonomyVersionId_fullPath_key" ON "TaxonomyCategory"("taxonomyVersionId", "fullPath");

-- CreateIndex
CREATE INDEX "TaxonomyCategoryTerm_taxonomyVersionId_normalizedTerm_idx" ON "TaxonomyCategoryTerm"("taxonomyVersionId", "normalizedTerm");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyCategoryTerm_taxonomyVersionId_taxonomyId_kind_norm_key" ON "TaxonomyCategoryTerm"("taxonomyVersionId", "taxonomyId", "kind", "normalizedTerm");

-- AddForeignKey
ALTER TABLE "ScanRun" ADD CONSTRAINT "ScanRun_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRun" ADD CONSTRAINT "ScanRun_taxonomyVersionId_fkey" FOREIGN KEY ("taxonomyVersionId") REFERENCES "TaxonomyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "ScanRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualOverride" ADD CONSTRAINT "ManualOverride_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplyJob" ADD CONSTRAINT "ApplyJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplyJobItem" ADD CONSTRAINT "ApplyJobItem_applyJobId_fkey" FOREIGN KEY ("applyJobId") REFERENCES "ApplyJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplyJobItem" ADD CONSTRAINT "ApplyJobItem_scanFindingId_fkey" FOREIGN KEY ("scanFindingId") REFERENCES "ScanFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollbackJob" ADD CONSTRAINT "RollbackJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollbackJob" ADD CONSTRAINT "RollbackJob_applyJobId_fkey" FOREIGN KEY ("applyJobId") REFERENCES "ApplyJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollbackJobItem" ADD CONSTRAINT "RollbackJobItem_rollbackJobId_fkey" FOREIGN KEY ("rollbackJobId") REFERENCES "RollbackJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollbackJobItem" ADD CONSTRAINT "RollbackJobItem_applyJobItemId_fkey" FOREIGN KEY ("applyJobItemId") REFERENCES "ApplyJobItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "ScanRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_manualOverrideId_fkey" FOREIGN KEY ("manualOverrideId") REFERENCES "ManualOverride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_applyJobId_fkey" FOREIGN KEY ("applyJobId") REFERENCES "ApplyJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_applyJobItemId_fkey" FOREIGN KEY ("applyJobItemId") REFERENCES "ApplyJobItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_rollbackJobId_fkey" FOREIGN KEY ("rollbackJobId") REFERENCES "RollbackJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_rollbackJobItemId_fkey" FOREIGN KEY ("rollbackJobItemId") REFERENCES "RollbackJobItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSubscription" ADD CONSTRAINT "ShopSubscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyCategory" ADD CONSTRAINT "TaxonomyCategory_taxonomyVersionId_fkey" FOREIGN KEY ("taxonomyVersionId") REFERENCES "TaxonomyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyCategoryTerm" ADD CONSTRAINT "TaxonomyCategoryTerm_taxonomyVersionId_taxonomyId_fkey" FOREIGN KEY ("taxonomyVersionId", "taxonomyId") REFERENCES "TaxonomyCategory"("taxonomyVersionId", "taxonomyId") ON DELETE CASCADE ON UPDATE CASCADE;
