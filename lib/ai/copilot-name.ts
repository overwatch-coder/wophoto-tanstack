
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_AI_COPILOT_NAME } from "@/lib/settings-preferences";

type ManagerPreference = { preferences: { aiCopilotName: string } | null };

function normalizeName(name: string | null | undefined) {
  const normalized = name?.trim();
  return normalized ? normalized.slice(0, 48) : DEFAULT_AI_COPILOT_NAME;
}

/**
 * Resolves a shared copilot name from the manager who owns the user's latest
 * relevant project/work assignment. Managers always use their own setting.
 */
export async function getEffectiveCopilotName(userId: string, role: UserRole, ownName?: string | null) {
  if (role === UserRole.MANAGER) return normalizeName(ownName);

  let manager: ManagerPreference | null = null;
  if (role === UserRole.CLIENT) {
    const project = await prisma.project.findFirst({
      where: { clientId: userId },
      orderBy: { updatedAt: "desc" },
      select: {
        manager: { select: { preferences: { select: { aiCopilotName: true } } } },
      },
    });
    manager = project?.manager ?? null;
  } else if (role === UserRole.WORKER) {
    const assignment = await prisma.taskAssignee.findFirst({
      where: { userId, task: { deletedAt: null } },
      orderBy: { assignedAt: "desc" },
      select: {
        task: {
          select: {
            project: { select: { manager: { select: { preferences: { select: { aiCopilotName: true } } } } } },
          },
        },
      },
    });
    manager = assignment?.task.project.manager ?? null;
  }

  return normalizeName(manager?.preferences?.aiCopilotName);
}
