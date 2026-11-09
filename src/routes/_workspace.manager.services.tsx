import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { CreateServiceDialog, ServicesManager } from "@/components/services/services-manager";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { prisma } from "@/lib/prisma";
import { requireStudioOwner } from "@/lib/studio-access";

const getManagerServicesData = createServerFn({ method: "GET" }).handler(async () => {
  const { context } = await requireStudioOwner();
  const services = await prisma.studioService.findMany({
    where: { studioId: context.studioId },
    select: { id: true, name: true, description: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return { services };
});

export const Route = createFileRoute("/_workspace/manager/services")({
  loader: () => getManagerServicesData(),
  head: () => ({
    meta: [{ title: "Studio Services | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading studio services" />,
  component: ManagerServicesRouteComponent,
});

function ManagerServicesRouteComponent() {
  const { services } = Route.useLoaderData();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Studio services</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage the services your team assigns to tasks. Archived services stay on existing tasks and can be restored at any time.
          </p>
        </div>
        <CreateServiceDialog />
      </header>
      <ServicesManager services={services} />
    </div>
  );
}

