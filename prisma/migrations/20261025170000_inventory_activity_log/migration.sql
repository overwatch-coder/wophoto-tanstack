CREATE TYPE "InventoryActivityAction" AS ENUM (
  'ITEM_CREATED',
  'ITEM_UPDATED',
  'ITEM_RETIRED',
  'ITEM_CHECKED_OUT',
  'ITEM_RETURNED',
  'MAINTENANCE_REPORTED',
  'MAINTENANCE_RESOLVED'
);

CREATE TABLE "InventoryActivityLog" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorLabel" TEXT NOT NULL,
  "action" "InventoryActivityAction" NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryActivityLog_createdAt_idx" ON "InventoryActivityLog"("createdAt");
CREATE INDEX "InventoryActivityLog_itemId_createdAt_idx" ON "InventoryActivityLog"("itemId", "createdAt");
CREATE INDEX "InventoryActivityLog_actorId_createdAt_idx" ON "InventoryActivityLog"("actorId", "createdAt");

ALTER TABLE "InventoryActivityLog"
  ADD CONSTRAINT "InventoryActivityLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the historical events that can be reconstructed safely from existing records.
INSERT INTO "InventoryActivityLog" ("id", "itemId", "actorLabel", "action", "details", "createdAt")
SELECT 'legacy-item-created-' || item."id", item."id", 'Actor not recorded', 'ITEM_CREATED',
       '{"historical":true,"note":"Actor was not recorded before activity logging."}'::jsonb,
       item."createdAt"
FROM "InventoryItem" item;

INSERT INTO "InventoryActivityLog" ("id", "itemId", "actorId", "actorLabel", "action", "details", "createdAt")
SELECT 'legacy-loan-checkout-' || loan."id", loan."itemId", loan."borrowerId",
       COALESCE(NULLIF(BTRIM(user_record."name"), ''), user_record."email"), 'ITEM_CHECKED_OUT',
       jsonb_build_object('historical', true, 'loanId', loan."id", 'expectedReturnAt', loan."expectedReturnAt"),
       loan."checkedOutAt"
FROM "InventoryLoan" loan
JOIN "User" user_record ON user_record."id" = loan."borrowerId";

INSERT INTO "InventoryActivityLog" ("id", "itemId", "actorId", "actorLabel", "action", "details", "createdAt")
SELECT 'legacy-loan-return-' || loan."id", loan."itemId", loan."borrowerId",
       COALESCE(NULLIF(BTRIM(user_record."name"), ''), user_record."email"), 'ITEM_RETURNED',
       jsonb_build_object('historical', true, 'loanId', loan."id", 'condition', loan."returnCondition", 'issueReported', loan."hasIssueReport"),
       loan."returnedAt"
FROM "InventoryLoan" loan
JOIN "User" user_record ON user_record."id" = loan."borrowerId"
WHERE loan."returnedAt" IS NOT NULL;

INSERT INTO "InventoryActivityLog" ("id", "itemId", "actorId", "actorLabel", "action", "details", "createdAt")
SELECT 'legacy-maintenance-reported-' || maintenance."id", maintenance."itemId", maintenance."reportedById",
       COALESCE(NULLIF(BTRIM(user_record."name"), ''), user_record."email"), 'MAINTENANCE_REPORTED',
       jsonb_build_object('historical', true, 'maintenanceLogId', maintenance."id", 'title', maintenance."title", 'status', maintenance."status"),
       maintenance."startedAt"
FROM "InventoryMaintenanceLog" maintenance
JOIN "User" user_record ON user_record."id" = maintenance."reportedById";

INSERT INTO "InventoryActivityLog" ("id", "itemId", "actorId", "actorLabel", "action", "details", "createdAt")
SELECT 'legacy-maintenance-resolved-' || maintenance."id", maintenance."itemId", maintenance."resolvedById",
       COALESCE(NULLIF(BTRIM(user_record."name"), ''), user_record."email"), 'MAINTENANCE_RESOLVED',
       jsonb_build_object('historical', true, 'maintenanceLogId', maintenance."id", 'title', maintenance."title", 'resolutionNotes', maintenance."resolutionNotes"),
       maintenance."resolvedAt"
FROM "InventoryMaintenanceLog" maintenance
JOIN "User" user_record ON user_record."id" = maintenance."resolvedById"
WHERE maintenance."resolvedAt" IS NOT NULL;
