import { Suspense } from "react";
import { UserRole, UserStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getScheduleEvents } from "@/lib/schedule";
import { getInitialScheduleWindow } from "@/lib/schedule-window";
import { ScheduleWorkspace } from "@/components/schedule/schedule-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

export const metadata = {
  title: "Studio Schedule | WoPhoto",
  description: "Coordinate studio bays, photo & video shoots, and task delivery deadlines.",
};

export default function ManagerSchedulePage() {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton variant="basic" label="Loading studio schedule" />
      }
    >
      <ManagerScheduleContent />
    </Suspense>
  );
}

async function ManagerScheduleContent() {
  const user = await requireRole(UserRole.MANAGER);

  const { startDate, endDate } = getInitialScheduleWindow(new Date());

  const [scheduleData, projects, workers] = await Promise.all([
    getScheduleEvents({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
    prisma.project.findMany({
      where: { managerId: user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: UserRole.WORKER, status: UserStatus.ACTIVE },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize dates for client components
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
        workers={workers}
        isManager={true}
      />
    </div>
  );
}
