-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SignOffStatus" AS ENUM ('PENDING', 'SIGNED', 'WAIVED');

-- CreateTable
CREATE TABLE "CreativeBrief" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "BriefStatus" NOT NULL DEFAULT 'DRAFT',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revisionSummary" TEXT,
    "deliverables" TEXT,
    "guidelines" TEXT,
    "shotList" JSONB,
    "externalUrl" TEXT,
    "fileUrl" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileMime" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefSignOff" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "SignOffStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "note" TEXT,
    "waivedById" TEXT,
    "waivedAt" TIMESTAMP(3),
    "waiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefSignOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefQuestion" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "briefVersion" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "isBlocker" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreativeBrief_projectId_isPrimary_idx" ON "CreativeBrief"("projectId", "isPrimary");

-- CreateIndex
CREATE INDEX "CreativeBrief_projectId_status_idx" ON "CreativeBrief"("projectId", "status");

-- CreateIndex
CREATE INDEX "CreativeBrief_createdById_idx" ON "CreativeBrief"("createdById");

-- CreateIndex
CREATE INDEX "CreativeBrief_createdAt_idx" ON "CreativeBrief"("createdAt");

-- CreateIndex
CREATE INDEX "BriefSignOff_briefId_version_status_idx" ON "BriefSignOff"("briefId", "version", "status");

-- CreateIndex
CREATE INDEX "BriefSignOff_userId_status_idx" ON "BriefSignOff"("userId", "status");

-- CreateIndex
CREATE INDEX "BriefSignOff_createdAt_idx" ON "BriefSignOff"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BriefSignOff_briefId_userId_version_key" ON "BriefSignOff"("briefId", "userId", "version");

-- CreateIndex
CREATE INDEX "BriefQuestion_briefId_createdAt_idx" ON "BriefQuestion"("briefId", "createdAt");

-- CreateIndex
CREATE INDEX "BriefQuestion_parentId_idx" ON "BriefQuestion"("parentId");

-- CreateIndex
CREATE INDEX "BriefQuestion_authorId_idx" ON "BriefQuestion"("authorId");

-- AddForeignKey
ALTER TABLE "CreativeBrief" ADD CONSTRAINT "CreativeBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeBrief" ADD CONSTRAINT "CreativeBrief_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefSignOff" ADD CONSTRAINT "BriefSignOff_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "CreativeBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefSignOff" ADD CONSTRAINT "BriefSignOff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefSignOff" ADD CONSTRAINT "BriefSignOff_waivedById_fkey" FOREIGN KEY ("waivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefQuestion" ADD CONSTRAINT "BriefQuestion_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "CreativeBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefQuestion" ADD CONSTRAINT "BriefQuestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefQuestion" ADD CONSTRAINT "BriefQuestion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BriefQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
