import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ConstructionPage } from "@/components/workspace/construction-page";
import { requireRole } from "@/lib/authz";
import { UserRole } from "@/generated/prisma/client";

const sectionTitles: Record<string, string> = {
  "project-feedback": "Project Feedback",
  notifications: "Notifications",
};

export default function ClientSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-48" />}>
      <ClientSectionContent params={params} />
    </Suspense>
  );
}

async function ClientSectionContent({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const title = sectionTitles[section];
  if (!title) notFound();

  await requireRole(UserRole.CLIENT);
  return <ConstructionPage title={title} />;
}
