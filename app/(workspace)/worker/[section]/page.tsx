import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ConstructionPage } from "@/components/workspace/construction-page";
import { requireRole } from "@/lib/authz";
import { UserRole } from "@/generated/prisma/client";

const sectionTitles: Record<string, string> = {
  "brief-review": "Brief Review",
  reviews: "Reviews",
  "brand-assets": "Brand Assets",
  schedule: "Schedule",
  notifications: "Notifications",
};

export default function WorkerSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-48" />}>
      <WorkerSectionContent params={params} />
    </Suspense>
  );
}

async function WorkerSectionContent({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const title = sectionTitles[section];
  if (!title) notFound();

  await requireRole(UserRole.WORKER);
  return <ConstructionPage title={title} />;
}
