import { UserRole } from "@/generated/prisma/client";
import { ConstructionPage } from "@/components/workspace/construction-page";
import { requireRole } from "@/lib/authz";

export default async function WorkerWorkspacePage() {
  await requireRole(UserRole.WORKER);

  return <ConstructionPage title="Dashboard" />;
}
