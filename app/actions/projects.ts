"use server";

import { revalidatePath } from "next/cache";
import { InvitationStatus, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export type ProjectActionState = { error?: string; success?: string };

class ProjectValidationError extends Error {}

export async function createProject(
  _previousState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const manager = await requireRole(UserRole.MANAGER);

  try {
    const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
    const description = String(formData.get("description") ?? "").trim();
    const clientId = String(formData.get("clientId") ?? "").trim();

    if (name.length < 1 || name.length > 120) {
      throw new ProjectValidationError("Project name must be between 1 and 120 characters.");
    }
    if (description.length > 5000) {
      throw new ProjectValidationError("Description must be 5,000 characters or fewer.");
    }
    if (!clientId || clientId.length > 191) {
      throw new ProjectValidationError("Choose a client who has accepted your invitation.");
    }

    const client = await prisma.user.findFirst({
      where: {
        id: clientId,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        acceptedInvitation: {
          is: {
            invitedById: manager.id,
            status: InvitationStatus.USED,
          },
        },
      },
      select: { id: true },
    });

    if (!client) throw new ProjectValidationError("That client is not available to you.");

    await prisma.project.create({
      data: {
        name,
        description: description || null,
        managerId: manager.id,
        clientId: client.id,
      },
    });

    revalidatePath("/manager/projects");
    revalidatePath("/manager/tasks");
    return { success: "Project created." };
  } catch (error) {
    return {
      error: error instanceof ProjectValidationError ? error.message : "The project could not be created. Try again.",
    };
  }
}
