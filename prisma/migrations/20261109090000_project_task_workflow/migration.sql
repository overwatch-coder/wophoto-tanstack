ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'TO_EDIT';

CREATE TYPE "ProjectCollaboratorRole" AS ENUM ('OWNER', 'COLLABORATOR');
CREATE TYPE "DeliverableType" AS ENUM ('INPUT', 'OUTPUT');
CREATE TYPE "EditCause" AS ENUM ('REQUIREMENT_ADJUSTMENT', 'DELIVERY_QUALITY_ISSUE');

ALTER TABLE "Project"
  ADD COLUMN "coverImage" TEXT,
  ADD COLUMN "targetAudience" TEXT,
  ADD COLUMN "keyMessage" TEXT,
  ADD COLUMN "imageryNote" TEXT,
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "deadline" TIMESTAMP(3);

CREATE TABLE "ProjectCollaborator" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ProjectCollaboratorRole" NOT NULL DEFAULT 'COLLABORATOR',
  "addedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCollaborator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskDeliverable" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "type" "DeliverableType" NOT NULL DEFAULT 'OUTPUT',
  "name" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileKey" TEXT,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskDeliverable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskRevision" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "cause" "EditCause" NOT NULL,
  "description" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectCollaborator_projectId_userId_key" ON "ProjectCollaborator"("projectId", "userId");
CREATE INDEX "ProjectCollaborator_userId_idx" ON "ProjectCollaborator"("userId");
CREATE INDEX "ProjectCollaborator_projectId_idx" ON "ProjectCollaborator"("projectId");
CREATE INDEX "TaskDeliverable_taskId_type_idx" ON "TaskDeliverable"("taskId", "type");
CREATE INDEX "TaskDeliverable_uploadedById_idx" ON "TaskDeliverable"("uploadedById");
CREATE INDEX "TaskRevision_taskId_createdAt_idx" ON "TaskRevision"("taskId", "createdAt");
CREATE INDEX "TaskRevision_requestedById_idx" ON "TaskRevision"("requestedById");

ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskDeliverable" ADD CONSTRAINT "TaskDeliverable_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDeliverable" ADD CONSTRAINT "TaskDeliverable_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskRevision" ADD CONSTRAINT "TaskRevision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskRevision" ADD CONSTRAINT "TaskRevision_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
