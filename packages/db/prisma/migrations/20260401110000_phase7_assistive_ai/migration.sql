ALTER TABLE "ScanFinding"
ADD COLUMN "aiProvider" TEXT,
ADD COLUMN "aiModel" TEXT,
ADD COLUMN "aiPromptVersion" TEXT,
ADD COLUMN "aiGeneratedAt" TIMESTAMP(3),
ADD COLUMN "aiInputFields" JSONB,
ADD COLUMN "aiShortlistCount" INTEGER,
ADD COLUMN "aiSummary" TEXT;
