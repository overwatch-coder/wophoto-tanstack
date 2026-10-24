"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_AI_MODELS,
  isAIModelAvailable,
  ROLE_LANDING_OPTIONS,
  ROLE_NOTIFICATION_PREFERENCES,
  getDefaultNotificationChannels,
  type AIProvider,
  type NotificationChannels,
} from "@/lib/settings-preferences";
import { normalizeNotificationChannels } from "@/lib/user-preferences";
import { userPreferencePatchSchema } from "@/lib/validation/settings";
import { parseInput } from "@/lib/validation/common";
import { encryptAIKey } from "@/lib/ai/credentials";

export async function updateUserPreferencesAction(input: unknown) {
  try {
    const user = await requireUser();
    const patch = parseInput(userPreferencePatchSchema, input);

    if (
      patch.notificationChannel &&
      !ROLE_NOTIFICATION_PREFERENCES[user.role].some(
        (item) => item.type === patch.notificationChannel?.type,
      )
    ) {
      return { error: "That notification preference is not available for your role." };
    }

    if (
      patch.defaultLanding &&
      !ROLE_LANDING_OPTIONS[user.role].some((option) => option.value === patch.defaultLanding)
    ) {
      return { error: "Choose a page available to your role." };
    }

    if (patch.workerAvailability && user.role !== "WORKER") {
      return { error: "Availability can only be changed by a worker." };
    }

    if (patch.aiAutonomousExecution !== undefined && user.role !== "MANAGER") {
      return { error: "Only managers can change autonomous tool execution." };
    }

    if (patch.aiCopilotName !== undefined && user.role !== "MANAGER") {
      return { error: "Only managers can rename the studio copilot." };
    }

    if (patch.aiProvider || patch.aiModel !== undefined) {
      const currentProvider = patch.aiProvider
        ? null
        : await prisma.userPreference.findUnique({
            where: { userId: user.id },
            select: { aiProvider: true },
          });
      const selectedProvider = patch.aiProvider ?? currentProvider?.aiProvider ?? "OPENAI";
      if (patch.aiModel !== undefined && !isAIModelAvailable(selectedProvider as AIProvider, patch.aiModel)) {
        return { error: "Choose a model available for the selected provider." };
      }
    }

    const updateData: {
      location?: string | null;
      notificationChannels?: NotificationChannels;
      density?: "COZY" | "COMPACT";
      soundAlerts?: boolean;
      defaultLanding?: string;
      workerAvailability?: "AVAILABLE" | "IN_SHOOT" | "FOCUS_MODE" | "OFF_SHIFT";
      aiProvider?: string;
      aiModel?: string;
      aiCopilotName?: string;
      aiApiKeyEncrypted?: string | null;
      aiApiKeyProvider?: string | null;
      aiCustomEndpoint?: string | null;
      aiAutonomousExecution?: boolean;
    } = {};

    if (patch.location !== undefined) updateData.location = patch.location || null;
    if (patch.density) updateData.density = patch.density;
    if (patch.soundAlerts !== undefined) updateData.soundAlerts = patch.soundAlerts;
    if (patch.defaultLanding) updateData.defaultLanding = patch.defaultLanding;
    if (patch.workerAvailability) updateData.workerAvailability = patch.workerAvailability;
    if (patch.aiCopilotName !== undefined) updateData.aiCopilotName = patch.aiCopilotName;
    if (patch.aiProvider) {
      updateData.aiProvider = patch.aiProvider;
      if (patch.aiModel === undefined) updateData.aiModel = DEFAULT_AI_MODELS[patch.aiProvider];
    }
    if (patch.aiModel) updateData.aiModel = patch.aiModel;
    if (patch.aiApiKey !== undefined) {
      updateData.aiApiKeyEncrypted = patch.aiApiKey.trim().length > 0 ? encryptAIKey(patch.aiApiKey.trim()) : null;
      if (patch.aiApiKey.trim().length > 0) {
        const storedProvider = patch.aiProvider ? null : await prisma.userPreference.findUnique({
          where: { userId: user.id },
          select: { aiProvider: true },
        });
        updateData.aiApiKeyProvider = patch.aiProvider ?? storedProvider?.aiProvider ?? "OPENAI";
      } else {
        updateData.aiApiKeyProvider = null;
      }
    }
    if (patch.aiCustomEndpoint !== undefined) {
      updateData.aiCustomEndpoint = patch.aiCustomEndpoint.trim().length > 0 ? patch.aiCustomEndpoint.trim() : null;
    }
    if (patch.aiAutonomousExecution !== undefined) {
      updateData.aiAutonomousExecution = patch.aiAutonomousExecution;
    }

    if (patch.notificationChannel) {
      const existing = await prisma.userPreference.findUnique({
        where: { userId: user.id },
        select: { notificationChannels: true },
      });
      const channels = {
        ...getDefaultNotificationChannels(user.role),
        ...normalizeNotificationChannels(existing?.notificationChannels),
      };
      const current = channels[patch.notificationChannel.type] ?? { inApp: true, email: false };
      channels[patch.notificationChannel.type] = {
        ...current,
        [patch.notificationChannel.channel]: patch.notificationChannel.enabled,
      };
      updateData.notificationChannels = channels;
    }

    await prisma.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...updateData },
      update: updateData,
    });

    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Your setting could not be saved.",
    };
  }
}
