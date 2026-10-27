import { Wrench } from "lucide-react";
import { ServicesManager } from "@/components/services/services-manager";
import { prisma } from "@/lib/prisma";
import { requireStudioOwner } from "@/lib/studio-access";

export default async function ManagerServicesPage() {
  const { context } = await requireStudioOwner();
  const services = await prisma.studioService.findMany({
    where: { studioId: context.studioId },
    select: { id: true, name: true, description: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Wrench aria-hidden="true" className="size-6" /></span>
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Studio services</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create and maintain the services your team works on. Archived services stay on existing tasks and can be restored at any time.</p></div>
      </header>
      <ServicesManager services={services} />
    </div>
  );
}
