import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireRole } from "@/lib/authz";
import { UserRole } from "@/generated/prisma/client";
import { ConstructionPage } from "@/components/workspace/construction-page";

const sectionTitles: Record<string, string> = {};

const getManagerSectionData = createServerFn({ method: "GET" })
  .validator((section: string) => section)
  .handler(async ({ data: section }) => {
    const title = sectionTitles[section];
    if (!title) throw notFound();
    await requireRole(UserRole.MANAGER);
    return { title };
  });

export const Route = createFileRoute("/_workspace/manager/$section")({
  loader: ({ params }) => getManagerSectionData({ data: params.section }),
  component: ManagerSectionRouteComponent,
});

function ManagerSectionRouteComponent() {
  const { title } = Route.useLoaderData();
  return <ConstructionPage title={title} />;
}

