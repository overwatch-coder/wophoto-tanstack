import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { TaskStatus, UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ClientProjectsView,
  type ClientProjectListItem,
} from "@/components/projects/client-projects-view";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getClientProjectsData = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireRole(UserRole.CLIENT);

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { clientId: user.id },
        { collaborators: { some: { userId: user.id } } },
      ],
    },
    include: {
      client: {
        select: { id: true, name: true, image: true },
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
      },
      tasks: {
        where: { deletedAt: null },
        select: { id: true, status: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const formatted: ClientProjectListItem[] = projects.map((p) => {
    const totalTasks = p.tasks.length;
    const completedTasks = p.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      coverImage: p.coverImage,
      startDate: p.startDate,
      deadline: p.deadline,
      updatedAt: p.updatedAt,
      client: p.client,
      collaborators: p.collaborators.map((c) => ({
        id: c.id,
        user: c.user,
      })),
      totalTasks,
      completedTasks,
      percentComplete,
    };
  });

  return { projects: formatted };
});

export const Route = createFileRoute("/_workspace/client/projects/")({
  loader: () => getClientProjectsData(),
  head: () => ({
    meta: [{ title: "Projects | WoPhoto" }],
  }),
  pendingComponent: () => (
    <PageLoadingSkeleton variant="projects" label="Loading projects" />
  ),
  component: ClientProjectsRouteComponent,
});

function ClientProjectsRouteComponent() {
  const { projects } = Route.useLoaderData();
  return <ClientProjectsView projects={projects} />;
}
