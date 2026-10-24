"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ROLE_LANDING_OPTIONS,
  ROLE_NOTIFICATION_PREFERENCES,
  getDefaultNotificationChannels,
  type NotificationChannels,
} from "@/lib/settings-preferences";
import { normalizeNotificationChannels } from "@/lib/user-preferences";
import { userPreferencePatchSchema } from "@/lib/validation/settings";
import { parseInput } from "@/lib/validation/common";

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

    const updateData: {
      location?: string | null;
      notificationChannels?: NotificationChannels;
      density?: "COZY" | "COMPACT";
      soundAlerts?: boolean;
      defaultLanding?: string;
      workerAvailability?: "AVAILABLE" | "IN_SHOOT" | "FOCUS_MODE" | "OFF_SHIFT";
    } = {};

    if (patch.location !== undefined) updateData.location = patch.location || null;
    if (patch.density) updateData.density = patch.density;
    if (patch.soundAlerts !== undefined) updateData.soundAlerts = patch.soundAlerts;
    if (patch.defaultLanding) updateData.defaultLanding = patch.defaultLanding;
    if (patch.workerAvailability) updateData.workerAvailability = patch.workerAvailability;

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
