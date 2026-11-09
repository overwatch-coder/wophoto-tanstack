import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireRole } from "@/lib/authz";
import { UserRole } from "@/generated/prisma/client";
import { ConstructionPage } from "@/components/workspace/construction-page";

const sectionTitles: Record<string, string> = {};

const getClientSectionData = createServerFn({ method: "GET" })
  .validator((section: string) => section)
  .handler(async ({ data: section }) => {
    const title = sectionTitles[section];
    if (!title) throw notFound();
    await requireRole(UserRole.CLIENT);
    return { title };
  });

export const Route = createFileRoute("/_workspace/client/$section")({
  loader: ({ params }) => getClientSectionData({ data: params.section }),
  component: ClientSectionRouteComponent,
});

function ClientSectionRouteComponent() {
  const { title } = Route.useLoaderData();
  return <ConstructionPage title={title} />;
}
