import { Suspense } from "react";
import { InvitationStatus, UserRole, UserStatus } from "@/generated/prisma/client";
import { ProjectManagement } from "@/components/projects/project-management";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export default function ManagerProjectsPage() {
  return (
    <Suspense fallback={<main className="min-h-[60vh]" />}>
      <ManagerProjectsContent />
    </Suspense>
  );
}

async function ManagerProjectsContent() {
  const manager = await requireRole(UserRole.MANAGER);
  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where: { managerId: manager.id },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            dueAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        acceptedInvitation: {
          is: {
            invitedById: manager.id,
            status: InvitationStatus.USED,
          },
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);

  return <ProjectManagement projects={projects} clients={clients} />;
}
