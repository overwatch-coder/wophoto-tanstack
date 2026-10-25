CREATE TYPE "ScheduleEventType" AS ENUM (
  'SHOOT',
  'STUDIO_BOOKING',
  'CLIENT_MEETING',
  'MAINTENANCE',
  'DEADLINE',
  'OTHER'
);

CREATE TABLE "ScheduleEvent" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "eventType" "ScheduleEventType" NOT NULL DEFAULT 'SHOOT',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "location" TEXT,
  "projectId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_ScheduleEventAssignees" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_ScheduleEventAssignees_AB_unique" ON "_ScheduleEventAssignees"("A", "B");
CREATE INDEX "_ScheduleEventAssignees_B_index" ON "_ScheduleEventAssignees"("B");

CREATE INDEX "ScheduleEvent_startAt_endAt_idx" ON "ScheduleEvent"("startAt", "endAt");
CREATE INDEX "ScheduleEvent_location_startAt_endAt_idx" ON "ScheduleEvent"("location", "startAt", "endAt");
CREATE INDEX "ScheduleEvent_projectId_idx" ON "ScheduleEvent"("projectId");
CREATE INDEX "ScheduleEvent_createdById_idx" ON "ScheduleEvent"("createdById");

ALTER TABLE "ScheduleEvent"
  ADD CONSTRAINT "ScheduleEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ScheduleEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "_ScheduleEventAssignees"
  ADD CONSTRAINT "_ScheduleEventAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "ScheduleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "_ScheduleEventAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
