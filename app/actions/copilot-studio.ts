"use server";

import { revalidatePath } from "next/cache";

import { requireStudioOwner } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { encryptAIKey } from "@/lib/ai/credentials";
import { DEFAULT_AI_MODELS, isAIModelAvailable, type AIProvider } from "@/lib/settings-preferences";
import { parseInput } from "@/lib/validation/common";
import { copilotStudioPolicySchema } from "@/lib/validation/copilot-studio";
import { UserRole } from "@/generated/prisma/client";

export async function updateCopilotStudioPolicyAction(input: unknown) {
  try {
    const { user: manager, context } = await requireStudioOwner();
    const parsed = parseInput(copilotStudioPolicySchema, input);
    const provider = parsed.provider as AIProvider;
    if (provider !== "CUSTOM" && !isAIModelAvailable(provider, parsed.model)) {
      return { error: "Choose a model available for the selected provider." };
    }

    const [workers, clients] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: parsed.overrides.map(({ userId }) => userId) }, role: UserRole.WORKER, acceptedInvitation: { is: { invitedById: manager.id } } },
        select: { id: true },
      }),
      prisma.user.findMany({
        where: {
          id: { in: parsed.overrides.map(({ userId }) => userId) },
          role: UserRole.CLIENT,
          OR: [
            { acceptedInvitation: { is: { invitedById: manager.id } } },
            { clientProjects: { some: { managerId: manager.id } } },
          ],
        },
        select: { id: true },
      }),
    ]);
    const eligibleIds = new Set([...workers, ...clients].map(({ id }) => id));
    if (parsed.overrides.some(({ userId, enabled }) => enabled !== null && !eligibleIds.has(userId))) {
      return { error: "One or more access exceptions are outside your studio. Refresh the page and try again." };
    }

    const key = parsed.apiKey?.trim();
    await prisma.$transaction(async (tx) => {
      await tx.copilotStudioPolicy.upsert({
        where: { managerId: manager.id },
        create: {
          managerId: manager.id,
          studioId: context.studioId,
          enabled: parsed.enabled,
          workersEnabled: parsed.workersEnabled,
          clientsEnabled: parsed.clientsEnabled,
          provider,
          model: parsed.model || DEFAULT_AI_MODELS[provider],
          apiKeyEncrypted: key ? encryptAIKey(key) : parsed.clearApiKey ? null : undefined,
          customEndpoint: parsed.customEndpoint?.trim() || null,
          dailyRequestLimit: parsed.dailyRequestLimit,
        },
        update: {
          enabled: parsed.enabled,
          workersEnabled: parsed.workersEnabled,
          clientsEnabled: parsed.clientsEnabled,
          provider,
          model: parsed.model || DEFAULT_AI_MODELS[provider],
          ...(key ? { apiKeyEncrypted: encryptAIKey(key) } : parsed.clearApiKey ? { apiKeyEncrypted: null } : {}),
          customEndpoint: parsed.customEndpoint?.trim() || null,
          dailyRequestLimit: parsed.dailyRequestLimit,
        },
      });
      await tx.copilotAccessOverride.deleteMany({ where: { managerId: manager.id } });
      const overrides = parsed.overrides.filter((item) => item.enabled !== null);
      if (overrides.length > 0) {
        await tx.copilotAccessOverride.createMany({
          data: overrides.map(({ userId, enabled }) => ({ managerId: manager.id, studioId: context.studioId, userId, enabled: enabled as boolean })),
        });
      }
    });

    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Copilot access settings could not be saved." };
  }
}
