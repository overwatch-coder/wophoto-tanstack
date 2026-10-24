import "server-only";

import { SettingsDensity, UserRole, WorkerAvailability } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDefaultLanding,
  getDefaultNotificationChannels,
  ROLE_LANDING_OPTIONS,
  type NotificationChannels,
  type UserPreferencesView,
} from "@/lib/settings-preferences";

export function normalizeNotificationChannels(value: unknown): NotificationChannels {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: NotificationChannels = {};
  for (const [type, channels] of Object.entries(value)) {
    if (!channels || typeof channels !== "object" || Array.isArray(channels)) continue;
    const { inApp, email } = channels as Record<string, unknown>;
    if (typeof inApp !== "boolean" || typeof email !== "boolean") continue;
    result[type as keyof NotificationChannels] = { inApp, email };
  }
  return result;
}
export async function getUserPreferences(userId: string, role: UserRole): Promise<UserPreferencesView> {
  const stored = await prisma.userPreference.findUnique({ where: { userId } });
  const savedLanding = stored?.defaultLanding;
  return {
    location: stored?.location ?? "",
    notificationChannels: {
      ...getDefaultNotificationChannels(role),
      ...normalizeNotificationChannels(stored?.notificationChannels),
    },
    density: stored?.density ?? SettingsDensity.COZY,
    soundAlerts: stored?.soundAlerts ?? true,
    defaultLanding: savedLanding && ROLE_LANDING_OPTIONS[role].some((option) => option.value === savedLanding)
      ? savedLanding
      : getDefaultLanding(role),
    workerAvailability: stored?.workerAvailability ?? WorkerAvailability.AVAILABLE,
  };
}
