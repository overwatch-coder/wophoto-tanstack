"use server";

import { revalidatePath } from "next/cache";
import { InvitationStatus, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { InputValidationError, parseInput } from "@/lib/validation/common";
import { createProjectSchema } from "@/lib/validation/projects";

export type ProjectActionState = { error?: string; success?: string };
class ProjectValidationError extends Error {}

export async function createProject(
  _previousState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const manager = await requireRole(UserRole.MANAGER);

  try {
    const { name, description, clientId } = parseInput(createProjectSchema, {
      name: formData.get("name") ?? "",
      description: formData.get("description") ?? "",
      clientId: formData.get("clientId") ?? "",
    });

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
        error: error instanceof ProjectValidationError || error instanceof InputValidationError
          ? error.message
          : "The project could not be created. Try again.",
    };
  }
}
