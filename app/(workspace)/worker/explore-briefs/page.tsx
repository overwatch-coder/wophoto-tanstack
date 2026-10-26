import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole, BriefTemplateCategory, BriefStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  getBriefTemplates,
  getStudioBriefArchive,
} from "@/lib/brief-templates";
import { ExploreBriefsWorkspace } from "@/components/brief-templates/explore-briefs-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

export const metadata = {
  title: "Explore Studio Briefs & Templates | WoPhoto",
  description:
    "Explore studio creative brief templates and past shoot references for lighting setups and deliverable guidelines.",
};

export default function WorkerExploreBriefsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="basic"
          label="Loading studio briefs and templates"
        />
      }
    >
      <WorkerExploreBriefsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkerExploreBriefsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireRole(UserRole.WORKER);
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
  const project =
    typeof params.project === "string" ? params.project : undefined;
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
    allProjects,
  ] = await Promise.all([
    getBriefTemplates({
      search,
      category,
      tag,
      includeArchived: false,
      page,
      pageSize: 12,
    }),
    getStudioBriefArchive({
      search,
      project,
      status,
      page,
      pageSize: 12,
    }),
    prisma.project.findMany({
      select: { id: true, name: true },
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
      projects={allProjects}
      clients={[]}
      role={UserRole.WORKER}
    />
  );
}
