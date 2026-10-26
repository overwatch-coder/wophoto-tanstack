-- Create reusable templates before the studio access migration adds studioId.
CREATE TYPE "BriefTemplateCategory" AS ENUM (
  'COMMERCIAL', 'EDITORIAL', 'ECOMMERCE', 'LOOKBOOK', 'PORTRAIT',
  'VIDEO_PRODUCTION', 'SOCIAL_MEDIA', 'OTHER'
);

CREATE TABLE "BriefTemplate" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "category" "BriefTemplateCategory" NOT NULL DEFAULT 'COMMERCIAL',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "deliverables" TEXT,
  "guidelines" TEXT,
  "externalLinks" JSONB,
  "shotList" JSONB,
  "coverImageUrl" TEXT,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "sourceBriefId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BriefTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BriefTemplate_category_isArchived_idx" ON "BriefTemplate"("category", "isArchived");
CREATE INDEX "BriefTemplate_isArchived_createdAt_idx" ON "BriefTemplate"("isArchived", "createdAt");
CREATE INDEX "BriefTemplate_createdById_idx" ON "BriefTemplate"("createdById");
CREATE INDEX "BriefTemplate_sourceBriefId_idx" ON "BriefTemplate"("sourceBriefId");

ALTER TABLE "BriefTemplate"
  ADD CONSTRAINT "BriefTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BriefTemplate"
  ADD CONSTRAINT "BriefTemplate_sourceBriefId_fkey"
  FOREIGN KEY ("sourceBriefId") REFERENCES "CreativeBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
