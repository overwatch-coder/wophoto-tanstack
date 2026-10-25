import { Suspense } from "react";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getScheduleEvents } from "@/lib/schedule";
import { getInitialScheduleWindow } from "@/lib/schedule-window";
import { ScheduleWorkspace } from "@/components/schedule/schedule-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

export const metadata = {
  title: "My Schedule & Shoots | WoPhoto",
  description: "View assigned shoots, call times, studio bookings, and task milestones.",
};

export default function WorkerSchedulePage() {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton variant="basic" label="Loading schedule" />
      }
    >
      <WorkerScheduleContent />
    </Suspense>
  );
}

async function WorkerScheduleContent() {
  await requireRole(UserRole.WORKER);

  const { startDate, endDate } = getInitialScheduleWindow(new Date());

  const [scheduleData, projects] = await Promise.all([
    getScheduleEvents({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedEvents = scheduleData.events.map((ev) => ({
    ...ev,
    startAt: ev.startAt.toISOString(),
    endAt: ev.endAt.toISOString(),
    createdAt: ev.createdAt.toISOString(),
    updatedAt: ev.updatedAt.toISOString(),
  }));

  const serializedTaskDeadlines = scheduleData.taskDeadlines.map((t) => ({
    ...t,
    dueAt: t.dueAt.toISOString(),
  }));

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl">
      <ScheduleWorkspace
        initialEvents={serializedEvents}
        initialTaskDeadlines={serializedTaskDeadlines}
        projects={projects}
        workers={[]}
        isManager={false}
      />
    </div>
  );
}
