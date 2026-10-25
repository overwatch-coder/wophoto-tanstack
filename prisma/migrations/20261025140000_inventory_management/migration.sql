CREATE TYPE "InventoryStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED');
CREATE TYPE "InventoryCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_ATTENTION');
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED');
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "assetTag" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "model" TEXT,
  "serialNumber" TEXT,
  "status" "InventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
  "condition" "InventoryCondition" NOT NULL DEFAULT 'GOOD',
  "location" TEXT,
  "purchaseDate" TIMESTAMP(3),
  "metadata" JSONB DEFAULT '{}',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLoan" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "borrowerId" TEXT NOT NULL,
  "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "checkoutNotes" TEXT,
  "returnCondition" "InventoryCondition",
  "returnNotes" TEXT,
  "hasIssueReport" BOOLEAN NOT NULL DEFAULT false,
  "issueDetails" TEXT,
  "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryLoan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMaintenanceLog" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "reportedById" TEXT NOT NULL,
  "resolvedById" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "resolutionNotes" TEXT,
  "cost" DECIMAL(10,2),
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "InventoryMaintenanceLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryItem_assetTag_key" ON "InventoryItem"("assetTag");
CREATE UNIQUE INDEX "InventoryItem_serialNumber_key" ON "InventoryItem"("serialNumber");
CREATE INDEX "InventoryItem_status_category_idx" ON "InventoryItem"("status", "category");
CREATE INDEX "InventoryItem_assetTag_idx" ON "InventoryItem"("assetTag");
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");

CREATE INDEX "InventoryLoan_itemId_status_idx" ON "InventoryLoan"("itemId", "status");
CREATE INDEX "InventoryLoan_borrowerId_status_idx" ON "InventoryLoan"("borrowerId", "status");
CREATE INDEX "InventoryLoan_status_expectedReturnAt_idx" ON "InventoryLoan"("status", "expectedReturnAt");
CREATE UNIQUE INDEX "InventoryLoan_active_item_idx" ON "InventoryLoan"("itemId") WHERE "status" = 'ACTIVE';

CREATE INDEX "InventoryMaintenanceLog_itemId_status_idx" ON "InventoryMaintenanceLog"("itemId", "status");
CREATE INDEX "InventoryMaintenanceLog_status_startedAt_idx" ON "InventoryMaintenanceLog"("status", "startedAt");

ALTER TABLE "InventoryLoan"
  ADD CONSTRAINT "InventoryLoan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryLoan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMaintenanceLog"
  ADD CONSTRAINT "InventoryMaintenanceLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryMaintenanceLog_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryMaintenanceLog_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
