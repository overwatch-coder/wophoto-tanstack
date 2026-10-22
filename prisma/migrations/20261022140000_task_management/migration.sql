CREATE TYPE "TaskType" AS ENUM ('ASSIGNED', 'DAILY_ENTRY');

ALTER TABLE "Task"
ADD COLUMN "type" "TaskType" NOT NULL DEFAULT 'ASSIGNED',
ADD COLUMN "workDate" DATE;

ALTER TABLE "TaskAssignee"
ADD COLUMN "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "managerNote" TEXT;

UPDATE "TaskAssignee" AS assignment
SET
  "status" = task."status",
  "submittedAt" = CASE
    WHEN task."status" = 'IN_REVIEW' THEN task."updatedAt"
    ELSE NULL
  END
FROM "Task" AS task
WHERE assignment."taskId" = task."id";

ALTER TABLE "Task"
ADD CONSTRAINT "Task_type_workDate_check"
CHECK (
  ("type" = 'ASSIGNED' AND "workDate" IS NULL)
  OR ("type" = 'DAILY_ENTRY' AND "workDate" IS NOT NULL)
);
