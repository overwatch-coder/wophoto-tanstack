-- Reconcile schema objects that were added to the Prisma model but omitted
-- from the original feature migrations. Prisma migrate status only compares
-- migration history, so it did not detect this production schema drift.

CREATE TYPE "FeedbackType" AS ENUM ('REVISION', 'REVIEW', 'COMPLAINT');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'ASSIGNED_TO_WORKER', 'IN_REVIEW', 'RESOLVED');

ALTER TABLE "CreativeBrief" ADD COLUMN "templateId" TEXT;
CREATE INDEX "CreativeBrief_templateId_idx" ON "CreativeBrief"("templateId");
ALTER TABLE "CreativeBrief"
  ADD CONSTRAINT "CreativeBrief_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "BriefTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClientFeedback" (
  "id" TEXT NOT NULL,
  "type" "FeedbackType" NOT NULL DEFAULT 'REVISION',
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "score" INTEGER,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "responseNote" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "clientId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT,
  "assignedWorkerId" TEXT,
  "delegationNote" TEXT,
  "delegatedAt" TIMESTAMP(3),
  "workerNote" TEXT,
  "workerSubmittedAt" TIMESTAMP(3),
  "respondedById" TEXT,
  CONSTRAINT "ClientFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientFeedback_clientId_createdAt_idx" ON "ClientFeedback"("clientId", "createdAt");
CREATE INDEX "ClientFeedback_projectId_status_createdAt_idx" ON "ClientFeedback"("projectId", "status", "createdAt");
CREATE INDEX "ClientFeedback_taskId_createdAt_idx" ON "ClientFeedback"("taskId", "createdAt");
CREATE INDEX "ClientFeedback_assignedWorkerId_status_idx" ON "ClientFeedback"("assignedWorkerId", "status");

ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_assignedWorkerId_fkey"
  FOREIGN KEY ("assignedWorkerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_respondedById_fkey"
  FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The implicit many-to-many join has a unique index but lacks its primary key.
ALTER TABLE "_ScheduleEventAssignees" ADD CONSTRAINT "_ScheduleEventAssignees_AB_pkey" PRIMARY KEY ("A", "B");
DROP INDEX "_ScheduleEventAssignees_AB_unique";
