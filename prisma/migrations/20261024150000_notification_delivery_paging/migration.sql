DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'FEEDBACK_RECEIVED',
    'FEEDBACK_RESOLVED',
    'REVISION_DELEGATED',
    'REVISION_SUBMITTED',
    'TASK_ASSIGNED',
    'TASK_REVIEW_READY',
    'TASK_APPROVED',
    'TASK_RETURNED',
    'DEADLINE_APPROACHING',
    'SYSTEM_ALERT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FEEDBACK_RESOLVED';

DO $$ BEGIN
  CREATE TYPE "NotificationCategory" AS ENUM ('ACTION_REQUIRED', 'UPDATE', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationEmailStatus" AS ENUM ('UNKNOWN', 'NOT_REQUESTED', 'PENDING', 'PREVIEW', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "category" "NotificationCategory" NOT NULL DEFAULT 'UPDATE',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "link" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "emailSent" BOOLEAN NOT NULL DEFAULT false,
  "emailStatus" "NotificationEmailStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "emailSubject" TEXT,
  "dedupeKey" TEXT,
  "projectId" TEXT,
  "taskId" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "emailStatus" "NotificationEmailStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

ALTER TABLE "Notification" ALTER COLUMN "emailStatus" SET DEFAULT 'UNKNOWN';

UPDATE "Notification"
SET "emailStatus" = 'UNKNOWN'
WHERE "emailStatus" = 'NOT_REQUESTED';

CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx"
  ON "Notification"("userId", "read", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_dedupeKey_key"
  ON "Notification"("dedupeKey");
