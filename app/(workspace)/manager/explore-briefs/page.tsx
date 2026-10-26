import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole, UserStatus, BriefTemplateCategory, BriefStatus } from "@/generated/prisma/client";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import {
  getBriefTemplates,
  getStudioBriefArchive,
} from "@/lib/brief-templates";
import { ExploreBriefsWorkspace } from "@/components/brief-templates/explore-briefs-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

export const metadata = {
  title: "Explore Briefs & Templates | WoPhoto",
  description:
    "Discover reusable creative brief templates, explore past studio briefs, and instantiate new shoot plans.",
};

export default function ManagerExploreBriefsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="basic"
          label="Loading explore briefs and templates"
        />
      }
    >
      <ManagerExploreBriefsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ManagerExploreBriefsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { user, context } = await requireStudioArea(StudioArea.BRIEFS);
  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : "";
  const category =
    typeof params.category === "string" &&
    Object.values(BriefTemplateCategory).includes(
      params.category as BriefTemplateCategory
    )
      ? (params.category as BriefTemplateCategory)
      : undefined;
  const tag = typeof params.tag === "string" ? params.tag : undefined;
  const includeArchived = params.archived === "true";
  const project =
    typeof params.project === "string" ? params.project : undefined;
  const client =
    typeof params.client === "string" ? params.client : undefined;
  const status =
    typeof params.status === "string" &&
    Object.values(BriefStatus).includes(params.status as BriefStatus)
      ? (params.status as BriefStatus)
      : undefined;
  const page =
    typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;

  const [
    templatesResult,
    archiveResult,
    managedProjects,
    invitedClients,
  ] = await Promise.all([
    getBriefTemplates({
      search,
      category,
      tag,
      includeArchived,
      page,
      pageSize: 12,
    }),
    getStudioBriefArchive({
      search,
      project,
      client,
      status,
      page,
      pageSize: 12,
    }),
    prisma.project.findMany({
      where: { studioId: context.studioId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        acceptedInvitation: { invitedById: user.id },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <ExploreBriefsWorkspace
      initialTemplates={templatesResult.templates}
      totalTemplates={templatesResult.total}
      availableTags={templatesResult.availableTags}
      initialArchiveBriefs={archiveResult.briefs}
      totalArchiveBriefs={archiveResult.total}
      projects={managedProjects}
      clients={invitedClients}
      role={UserRole.MANAGER}
    />
  );
}
