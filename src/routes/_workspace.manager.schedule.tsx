import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { getScheduleEvents } from "@/lib/schedule";
import { getInitialScheduleWindow } from "@/lib/schedule-window";
import { ScheduleWorkspace } from "@/components/schedule/schedule-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getManagerScheduleData = createServerFn({ method: "GET" }).handler(async () => {
  const { context } = await requireStudioArea(StudioArea.SCHEDULE);

  const { startDate, endDate } = getInitialScheduleWindow(new Date());

  const [scheduleData, projects, workers] = await Promise.all([
    getScheduleEvents({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
    prisma.project.findMany({
      where: { studioId: context.studioId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: UserRole.WORKER, status: UserStatus.ACTIVE },
      select: { id: true, name: true, email: true },
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
    workers,
  };
});

export const Route = createFileRoute("/_workspace/manager/schedule")({
  loader: () => getManagerScheduleData(),
  head: () => ({
    meta: [
      { title: "Studio Schedule | WoPhoto" },
      {
        name: "description",
        content:
          "Coordinate studio bays, photo & video shoots, and task delivery deadlines.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading schedule" />,
  component: ManagerScheduleRouteComponent,
});

function ManagerScheduleRouteComponent() {
  const data = Route.useLoaderData();
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl">
      <ScheduleWorkspace
        initialEvents={data.serializedEvents}
        initialTaskDeadlines={data.serializedTaskDeadlines}
        projects={data.projects}
        workers={data.workers}
        isManager={true}
      />
    </div>
  );
}

