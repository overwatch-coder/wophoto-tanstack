import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getStudioIdForUser } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { getScheduleEvents } from "@/lib/schedule";
import { getInitialScheduleWindow } from "@/lib/schedule-window";
import { ScheduleWorkspace } from "@/components/schedule/schedule-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getWorkerScheduleData = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireRole(UserRole.WORKER);
  const studioId = (await getStudioIdForUser(user.id, user.role)) ?? "__missing_studio__";

  const { startDate, endDate } = getInitialScheduleWindow(new Date());

  const [scheduleData, projects] = await Promise.all([
    getScheduleEvents({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      studioId,
    }),
    prisma.project.findMany({
      where: { studioId },
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

  return {
    serializedEvents,
    serializedTaskDeadlines,
    projects,
  };
});

export const Route = createFileRoute("/_workspace/worker/schedule")({
  loader: () => getWorkerScheduleData(),
  head: () => ({
    meta: [
      { title: "My Schedule & Shoots | WoPhoto" },
      {
        name: "description",
        content: "View assigned shoots, call times, studio bookings, and task milestones.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading schedule" />,
  component: WorkerScheduleRouteComponent,
});

function WorkerScheduleRouteComponent() {
  const data = Route.useLoaderData();
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl">
      <ScheduleWorkspace
        initialEvents={data.serializedEvents}
        initialTaskDeadlines={data.serializedTaskDeadlines}
        projects={data.projects}
        workers={[]}
        isManager={false}
      />
    </div>
  );
}

