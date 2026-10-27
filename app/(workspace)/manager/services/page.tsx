import { Suspense } from "react";
import { connection } from "next/server";
import { CreateServiceDialog, ServicesManager } from "@/components/services/services-manager";
import { prisma } from "@/lib/prisma";
import { requireStudioOwner } from "@/lib/studio-access";
import { DelayedLoadingFallback } from "@/components/workspace/delayed-loading-fallback";

async function ManagerServicesContent() {
  await connection();
  const { context } = await requireStudioOwner();
  const services = await prisma.studioService.findMany({
    where: { studioId: context.studioId },
    select: { id: true, name: true, description: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Studio services</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage the services your team assigns to tasks. Archived services stay on existing tasks and can be restored at any time.</p>
        </div>
        <CreateServiceDialog />
      </header>
      <ServicesManager services={services} />
    </div>
  );
}

function ServicesLoading() {
  return (
    <DelayedLoadingFallback>
      <div className="mx-auto w-full max-w-6xl space-y-6" aria-busy="true">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full max-w-2xl animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-10 w-full animate-pulse rounded-full bg-muted sm:w-32" />
        </header>
        <div className="h-72 w-full animate-pulse rounded-xl border border-border bg-card" />
      </div>
    </DelayedLoadingFallback>
  );
}

export default function ManagerServicesPage() {
  return (
    <Suspense fallback={<ServicesLoading />}>
      <ManagerServicesContent />
    </Suspense>
  );
}
