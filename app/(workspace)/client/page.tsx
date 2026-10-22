import { UserRole } from "@/generated/prisma/client";
import { ConstructionPage } from "@/components/workspace/construction-page";
import { requireRole } from "@/lib/authz";

export default async function ClientWorkspacePage() {
  await requireRole(UserRole.CLIENT);

  return <ConstructionPage title="Dashboard" />;
}
