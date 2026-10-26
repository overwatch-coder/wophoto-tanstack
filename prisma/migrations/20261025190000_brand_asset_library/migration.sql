-- CreateEnum
CREATE TYPE "BrandAssetType" AS ENUM ('LOGO', 'COLOR_PALETTE', 'TYPOGRAPHY', 'GUIDELINE', 'MEDIA_REFERENCE', 'TEMPLATE');

-- CreateTable
CREATE TABLE "BrandAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetType" "BrandAssetType" NOT NULL DEFAULT 'LOGO',
    "fileUrl" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileMime" TEXT,
    "externalUrl" TEXT,
    "colorPalette" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientId" TEXT,
    "projectId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandAsset_createdAt_idx" ON "BrandAsset"("createdAt");

-- CreateIndex
CREATE INDEX "BrandAsset_clientId_createdAt_idx" ON "BrandAsset"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "BrandAsset_projectId_createdAt_idx" ON "BrandAsset"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "BrandAsset_assetType_createdAt_idx" ON "BrandAsset"("assetType", "createdAt");

-- CreateIndex
CREATE INDEX "BrandAsset_createdById_idx" ON "BrandAsset"("createdById");

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
