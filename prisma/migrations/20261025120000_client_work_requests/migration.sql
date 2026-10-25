CREATE TYPE "WorkRequestType" AS ENUM ('WORK', 'PROJECT');
CREATE TYPE "WorkRequestStatus" AS ENUM ('SUBMITTED', 'NEEDS_INFO', 'DECLINED', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "WorkRequest" (
  "id" TEXT NOT NULL,
  "type" "WorkRequestType" NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "requestedDueAt" TIMESTAMP(3),
  "status" "WorkRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "managerNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "clientId" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "projectId" TEXT,
  "createdProjectId" TEXT,
  "createdTaskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkRequest_createdProjectId_key" ON "WorkRequest"("createdProjectId");
CREATE UNIQUE INDEX "WorkRequest_createdTaskId_key" ON "WorkRequest"("createdTaskId");
CREATE INDEX "WorkRequest_clientId_createdAt_id_idx" ON "WorkRequest"("clientId", "createdAt", "id");
CREATE INDEX "WorkRequest_managerId_status_createdAt_id_idx" ON "WorkRequest"("managerId", "status", "createdAt", "id");
CREATE INDEX "WorkRequest_projectId_status_idx" ON "WorkRequest"("projectId", "status");

ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_createdProjectId_fkey" FOREIGN KEY ("createdProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_createdTaskId_fkey" FOREIGN KEY ("createdTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
