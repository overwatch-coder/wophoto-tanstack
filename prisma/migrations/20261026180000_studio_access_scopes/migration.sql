-- Add distinct member roles and explicit studio access scopes.
CREATE TYPE "StudioArea" AS ENUM (
  'DASHBOARD', 'PROJECTS', 'TASKS', 'SCHEDULE', 'BRIEFS', 'REVIEWS',
  'WORK_REQUESTS', 'BRAND_ASSETS', 'INVENTORY', 'DELETED_TASKS', 'TEAM', 'COPILOT'
);
CREATE TYPE "StudioAccessLevel" AS ENUM ('VIEW', 'MANAGE');

ALTER TYPE "UserRole" ADD VALUE 'SUPERVISOR';
ALTER TYPE "UserRole" ADD VALUE 'COLLABORATOR';

CREATE TABLE "Studio" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Studio_ownerUserId_key" ON "Studio"("ownerUserId");
CREATE INDEX "Studio_ownerUserId_idx" ON "Studio"("ownerUserId");

INSERT INTO "Studio" ("id", "name", "ownerUserId", "createdAt", "updatedAt")
SELECT 'studio_' || u."id", COALESCE(NULLIF(trim(u."name"), ''), 'Studio') || ' Studio', u."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u WHERE u."role" = 'MANAGER';

CREATE TABLE "StudioMember" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "addedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  CONSTRAINT "StudioMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudioMember_userId_key" ON "StudioMember"("userId");
CREATE UNIQUE INDEX "StudioMember_invitationId_key" ON "StudioMember"("invitationId");
CREATE INDEX "StudioMember_studioId_revokedAt_createdAt_idx" ON "StudioMember"("studioId", "revokedAt", "createdAt");

CREATE TABLE "StudioMemberPermission" (
  "studioMemberId" TEXT NOT NULL,
  "area" "StudioArea" NOT NULL,
  "accessLevel" "StudioAccessLevel" NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioMemberPermission_pkey" PRIMARY KEY ("studioMemberId", "area")
);
CREATE INDEX "StudioMemberPermission_area_accessLevel_idx" ON "StudioMemberPermission"("area", "accessLevel");

CREATE TABLE "InvitationPermission" (
  "invitationId" TEXT NOT NULL,
  "area" "StudioArea" NOT NULL,
  "accessLevel" "StudioAccessLevel" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvitationPermission_pkey" PRIMARY KEY ("invitationId", "area")
);
CREATE INDEX "InvitationPermission_area_accessLevel_idx" ON "InvitationPermission"("area", "accessLevel");

ALTER TABLE "Invitation" ADD COLUMN "studioId" TEXT;
ALTER TABLE "Project" ADD COLUMN "studioId" TEXT;
ALTER TABLE "WorkRequest" ADD COLUMN "studioId" TEXT;
ALTER TABLE "CopilotStudioPolicy" ADD COLUMN "studioId" TEXT;
ALTER TABLE "CopilotAccessOverride" ADD COLUMN "studioId" TEXT;
ALTER TABLE "CopilotUsageEvent" ADD COLUMN "studioId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "studioId" TEXT;
ALTER TABLE "ScheduleEvent" ADD COLUMN "studioId" TEXT;
ALTER TABLE "BrandAsset" ADD COLUMN "studioId" TEXT;
ALTER TABLE "BriefTemplate" ADD COLUMN "studioId" TEXT;

UPDATE "Invitation" i SET "studioId" = s."id"
FROM "Studio" s WHERE i."invitedById" = s."ownerUserId";
UPDATE "Project" p SET "studioId" = s."id"
FROM "Studio" s WHERE p."managerId" = s."ownerUserId";
UPDATE "WorkRequest" r SET "studioId" = s."id"
FROM "Studio" s WHERE r."managerId" = s."ownerUserId";
UPDATE "CopilotStudioPolicy" p SET "studioId" = s."id"
FROM "Studio" s WHERE p."managerId" = s."ownerUserId";
UPDATE "CopilotAccessOverride" o SET "studioId" = s."id"
FROM "Studio" s WHERE o."managerId" = s."ownerUserId";
UPDATE "CopilotUsageEvent" e SET "studioId" = s."id"
FROM "Studio" s WHERE e."managerId" = s."ownerUserId";

DO $$
DECLARE studio_count INTEGER;
BEGIN
  SELECT count(*) INTO studio_count FROM "Studio";
  IF EXISTS (SELECT 1 FROM "InventoryItem") AND studio_count <> 1 THEN
    RAISE EXCEPTION 'Studio access migration cannot assign global InventoryItem rows: expected exactly one existing Manager, found %', studio_count;
  END IF;
  IF studio_count = 1 THEN
    UPDATE "InventoryItem" SET "studioId" = (SELECT "id" FROM "Studio");
  END IF;
END $$;

UPDATE "ScheduleEvent" e SET "studioId" = p."studioId"
FROM "Project" p WHERE e."projectId" = p."id";
UPDATE "ScheduleEvent" e SET "studioId" = s."id"
FROM "Studio" s WHERE e."studioId" IS NULL AND e."createdById" = s."ownerUserId";
DO $$
DECLARE studio_count INTEGER;
BEGIN
  SELECT count(*) INTO studio_count FROM "Studio";
  IF EXISTS (SELECT 1 FROM "ScheduleEvent" WHERE "studioId" IS NULL) AND studio_count = 1 THEN
    UPDATE "ScheduleEvent" SET "studioId" = (SELECT "id" FROM "Studio") WHERE "studioId" IS NULL;
  END IF;
END $$;

UPDATE "BrandAsset" a SET "studioId" = p."studioId"
FROM "Project" p WHERE a."projectId" = p."id";
UPDATE "BrandAsset" a SET "studioId" = s."id"
FROM "Studio" s WHERE a."studioId" IS NULL AND a."createdById" = s."ownerUserId";
UPDATE "BrandAsset" a SET "studioId" = candidates."studioId"
FROM (
  SELECT a."id", min(p."studioId") AS "studioId"
  FROM "BrandAsset" a JOIN "Project" p ON p."clientId" = a."clientId"
  WHERE a."studioId" IS NULL
  GROUP BY a."id" HAVING count(DISTINCT p."studioId") = 1
) candidates WHERE a."id" = candidates."id";

UPDATE "BriefTemplate" t SET "studioId" = p."studioId"
FROM "CreativeBrief" b JOIN "Project" p ON p."id" = b."projectId"
WHERE t."sourceBriefId" = b."id";
UPDATE "BriefTemplate" t SET "studioId" = s."id"
FROM "Studio" s WHERE t."studioId" IS NULL AND t."createdById" = s."ownerUserId";

DO $$
DECLARE missing_summary TEXT;
BEGIN
  SELECT string_agg(table_name || '=' || missing_count, ', ')
  INTO missing_summary
  FROM (
    SELECT 'Invitation' AS table_name, count(*) AS missing_count FROM "Invitation" WHERE "studioId" IS NULL
    UNION ALL SELECT 'Project', count(*) FROM "Project" WHERE "studioId" IS NULL
    UNION ALL SELECT 'WorkRequest', count(*) FROM "WorkRequest" WHERE "studioId" IS NULL
    UNION ALL SELECT 'CopilotStudioPolicy', count(*) FROM "CopilotStudioPolicy" WHERE "studioId" IS NULL
    UNION ALL SELECT 'CopilotAccessOverride', count(*) FROM "CopilotAccessOverride" WHERE "studioId" IS NULL
    UNION ALL SELECT 'CopilotUsageEvent', count(*) FROM "CopilotUsageEvent" WHERE "studioId" IS NULL
    UNION ALL SELECT 'InventoryItem', count(*) FROM "InventoryItem" WHERE "studioId" IS NULL
    UNION ALL SELECT 'ScheduleEvent', count(*) FROM "ScheduleEvent" WHERE "studioId" IS NULL
    UNION ALL SELECT 'BrandAsset', count(*) FROM "BrandAsset" WHERE "studioId" IS NULL
    UNION ALL SELECT 'BriefTemplate', count(*) FROM "BriefTemplate" WHERE "studioId" IS NULL
  ) missing WHERE missing_count > 0;
  IF missing_summary IS NOT NULL THEN
    RAISE EXCEPTION 'Studio access migration found records with no unambiguous Studio assignment: %. Resolve ownership and rerun the migration.', missing_summary;
  END IF;
END $$;

ALTER TABLE "Invitation" ALTER COLUMN "studioId" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "studioId" SET NOT NULL;
ALTER TABLE "WorkRequest" ALTER COLUMN "studioId" SET NOT NULL;
ALTER TABLE "CopilotStudioPolicy" ALTER COLUMN "studioId" SET NOT NULL;
ALTER TABLE "CopilotAccessOverride" ALTER COLUMN "studioId" SET NOT NULL;
ALTER TABLE "CopilotUsageEvent" ALTER COLUMN "studioId" SET NOT NULL;
ALTER TABLE "InventoryItem" ALTER COLUMN "studioId" SET NOT NULL;
ALTER TABLE "ScheduleEvent" ALTER COLUMN "studioId" SET NOT NULL;
ALTER TABLE "BrandAsset" ALTER COLUMN "studioId" SET NOT NULL;
ALTER TABLE "BriefTemplate" ALTER COLUMN "studioId" SET NOT NULL;

DROP INDEX "InventoryItem_assetTag_idx";
DROP INDEX "InventoryItem_assetTag_key";

CREATE INDEX "BrandAsset_studioId_createdAt_idx" ON "BrandAsset"("studioId", "createdAt");
CREATE INDEX "BriefTemplate_studioId_isArchived_createdAt_idx" ON "BriefTemplate"("studioId", "isArchived", "createdAt");
CREATE INDEX "CopilotAccessOverride_studioId_userId_idx" ON "CopilotAccessOverride"("studioId", "userId");
CREATE UNIQUE INDEX "CopilotStudioPolicy_studioId_key" ON "CopilotStudioPolicy"("studioId");
CREATE INDEX "CopilotUsageEvent_studioId_createdAt_idx" ON "CopilotUsageEvent"("studioId", "createdAt");
CREATE INDEX "InventoryItem_studioId_status_category_idx" ON "InventoryItem"("studioId", "status", "category");
CREATE INDEX "InventoryItem_studioId_assetTag_idx" ON "InventoryItem"("studioId", "assetTag");
CREATE UNIQUE INDEX "InventoryItem_studioId_assetTag_key" ON "InventoryItem"("studioId", "assetTag");
CREATE UNIQUE INDEX "InventoryItem_studioId_serialNumber_key" ON "InventoryItem"("studioId", "serialNumber");
CREATE INDEX "Invitation_studioId_createdAt_idx" ON "Invitation"("studioId", "createdAt");
CREATE INDEX "Project_studioId_updatedAt_idx" ON "Project"("studioId", "updatedAt");
CREATE INDEX "ScheduleEvent_studioId_startAt_endAt_idx" ON "ScheduleEvent"("studioId", "startAt", "endAt");
CREATE INDEX "WorkRequest_studioId_status_createdAt_id_idx" ON "WorkRequest"("studioId", "status", "createdAt", "id");

ALTER TABLE "Studio" ADD CONSTRAINT "Studio_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudioMember" ADD CONSTRAINT "StudioMember_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudioMember" ADD CONSTRAINT "StudioMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudioMember" ADD CONSTRAINT "StudioMember_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudioMember" ADD CONSTRAINT "StudioMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudioMember" ADD CONSTRAINT "StudioMember_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudioMemberPermission" ADD CONSTRAINT "StudioMemberPermission_studioMemberId_fkey" FOREIGN KEY ("studioMemberId") REFERENCES "StudioMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvitationPermission" ADD CONSTRAINT "InvitationPermission_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CopilotStudioPolicy" ADD CONSTRAINT "CopilotStudioPolicy_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopilotAccessOverride" ADD CONSTRAINT "CopilotAccessOverride_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopilotUsageEvent" ADD CONSTRAINT "CopilotUsageEvent_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BriefTemplate" ADD CONSTRAINT "BriefTemplate_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
