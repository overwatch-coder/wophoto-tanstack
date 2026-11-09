import { createServerFn } from "@tanstack/react-start";
import { decodeActionArguments, encodeActionArguments, type EncodedActionArguments } from "@/lib/server-action-args";

import {
  InvitationStatus,
  NotificationCategory,
  NotificationType,
  ProjectCollaboratorRole,
  StudioAccessLevel,
  StudioArea,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import { auth } from "@/auth";
import { requireStudioManagerArea, getStudioAccessContext, hasStudioAccess } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { InputValidationError, parseInput } from "@/lib/validation/common";
import { createProjectSchema } from "@/lib/validation/projects";
import { createNotification } from "@/lib/notifications";

export type ProjectActionState = { error?: string; success?: string };
class ProjectValidationError extends Error {}

async function createProjectServerImplementation(
  _previousState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const { manager, context } = await requireStudioManagerArea(StudioArea.PROJECTS);

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
        studioId: context.studioId,
      },
    });
    return { success: "Project created." };
  } catch (error) {
    return {
      error:
        error instanceof ProjectValidationError || error instanceof InputValidationError
          ? error.message
          : "The project could not be created. Try again.",
    };
  }
}

async function addProjectCollaboratorServerImplementation(
  projectId: string,
  email: string
): Promise<ProjectActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) return { error: "Please enter a valid email address." };

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: true,
      },
    });

    if (!project) return { error: "Project not found." };

    // Check permission: manager of project, studio manager, primary client, or existing collaborator
    const isManager = project.managerId === session.user.id;
    const isPrimaryClient = project.clientId === session.user.id;
    const isCollaborator = project.collaborators.some((c) => c.userId === session.user.id);

    let hasPerm = isManager || isPrimaryClient || isCollaborator;
    if (!hasPerm && session.user.role === UserRole.MANAGER) {
      const context = await getStudioAccessContext(session.user.id, session.user.role);
      if (context && context.studioId === project.studioId && hasStudioAccess(context, StudioArea.PROJECTS, StudioAccessLevel.MANAGE)) {
        hasPerm = true;
      }
    }

    if (!hasPerm) return { error: "You do not have permission to add collaborators to this project." };

    // Find the user to add
    const targetUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
      select: { id: true, name: true, email: true, status: true },
    });

    if (!targetUser || targetUser.status !== UserStatus.ACTIVE) {
      return { error: `No active user found with email "${trimmedEmail}". Please ensure they have registered or accepted an invite.` };
    }

    if (project.clientId === targetUser.id) {
      return { error: "This user is already the primary client of this project." };
    }

    if (project.collaborators.some((c) => c.userId === targetUser.id)) {
      return { error: "This user is already a collaborator on this project." };
    }

    await prisma.projectCollaborator.create({
      data: {
        projectId,
        userId: targetUser.id,
        role: ProjectCollaboratorRole.COLLABORATOR,
        addedById: session.user.id,
      },
    });

    // Notify the added user
    await createNotification({
      userId: targetUser.id,
      actorId: session.user.id,
      type: NotificationType.SYSTEM_ALERT,
      category: NotificationCategory.UPDATE,
      title: "Added to project workspace",
      message: `You've been added to "${project.name}" as a project collaborator.`,
      link: `/client/projects/${project.id}`,
      projectId: project.id,
    });

    return { success: `Successfully added ${targetUser.name || targetUser.email} to the project.` };
  } catch (error) {
    console.error("Failed to add project collaborator:", error);
    return { error: "Failed to add collaborator." };
  }
}

async function removeProjectCollaboratorServerImplementation(
  projectId: string,
  collaboratorId: string
): Promise<ProjectActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: true,
      },
    });

    if (!project) return { error: "Project not found." };

    const isManager = project.managerId === session.user.id;
    const isPrimaryClient = project.clientId === session.user.id;

    if (!isManager && !isPrimaryClient) {
      return { error: "Only project managers or the primary client can remove collaborators." };
    }

    await prisma.projectCollaborator.delete({
      where: { id: collaboratorId, projectId },
    });

    return { success: "Collaborator removed." };
  } catch (error) {
    console.error("Failed to remove project collaborator:", error);
    return { error: "Failed to remove collaborator." };
  }
}

async function updateProjectDetailsServerImplementation(
  projectId: string,
  data: {
    name?: string;
    description?: string;
    coverImage?: string;
    targetAudience?: string;
    keyMessage?: string;
    imageryNote?: string;
    startDate?: Date | null;
    deadline?: Date | null;
  }
): Promise<ProjectActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { collaborators: true },
    });

    if (!project) return { error: "Project not found." };

    const isManager = project.managerId === session.user.id;
    const isPrimaryClient = project.clientId === session.user.id;
    if (!isManager && !isPrimaryClient) {
      return { error: "Permission denied." };
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        ...(data.coverImage !== undefined ? { coverImage: data.coverImage || null } : {}),
        ...(data.targetAudience !== undefined ? { targetAudience: data.targetAudience.trim() || null } : {}),
        ...(data.keyMessage !== undefined ? { keyMessage: data.keyMessage.trim() || null } : {}),
        ...(data.imageryNote !== undefined ? { imageryNote: data.imageryNote.trim() || null } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.deadline !== undefined ? { deadline: data.deadline } : {}),
      },
    });

    return { success: "Project details updated." };
  } catch (error) {
    console.error("Failed to update project details:", error);
    return { error: "Failed to update project." };
  }
}



const createProjectServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof createProjectServerImplementation>>) => args)
  .handler(async ({ data }) => createProjectServerImplementation(...decodeActionArguments<Parameters<typeof createProjectServerImplementation>>(data)));
export const createProject = async (...args: Parameters<typeof createProjectServerImplementation>) => createProjectServerFunction({ data: await encodeActionArguments(args) });

const addProjectCollaboratorServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof addProjectCollaboratorServerImplementation>>) => args)
  .handler(async ({ data }) => addProjectCollaboratorServerImplementation(...decodeActionArguments<Parameters<typeof addProjectCollaboratorServerImplementation>>(data)));
export const addProjectCollaborator = async (...args: Parameters<typeof addProjectCollaboratorServerImplementation>) => addProjectCollaboratorServerFunction({ data: await encodeActionArguments(args) });

const removeProjectCollaboratorServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof removeProjectCollaboratorServerImplementation>>) => args)
  .handler(async ({ data }) => removeProjectCollaboratorServerImplementation(...decodeActionArguments<Parameters<typeof removeProjectCollaboratorServerImplementation>>(data)));
export const removeProjectCollaborator = async (...args: Parameters<typeof removeProjectCollaboratorServerImplementation>) => removeProjectCollaboratorServerFunction({ data: await encodeActionArguments(args) });


const updateProjectDetailsServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateProjectDetailsServerImplementation>>) => args)
  .handler(async ({ data }) => updateProjectDetailsServerImplementation(...decodeActionArguments<Parameters<typeof updateProjectDetailsServerImplementation>>(data)));
export const updateProjectDetails = async (...args: Parameters<typeof updateProjectDetailsServerImplementation>) => updateProjectDetailsServerFunction({ data: await encodeActionArguments(args) });
