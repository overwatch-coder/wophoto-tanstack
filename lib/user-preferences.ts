import "server-only";

import { SettingsDensity, UserRole, WorkerAvailability } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptAIKey, isEncryptedAIKey } from "@/lib/ai/credentials";
import { getEffectiveCopilotName } from "@/lib/ai/copilot-name";
import {
  DEFAULT_AI_COPILOT_NAME,
  DEFAULT_AI_MODELS,
  getDefaultLanding,
  getDefaultNotificationChannels,
  ROLE_LANDING_OPTIONS,
  type AIProvider,
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

export function maskApiKey(key: string | null | undefined): string {
  if (!key || key.trim().length === 0) return "";
  if (key.length <= 8) return "••••••••";
  return `••••••••${key.slice(-4)}`;
}

export async function getWorkspacePreferences(userId: string) {
  const stored = await prisma.userPreference.findUnique({
    where: { userId },
    select: { density: true, soundAlerts: true },
  });

  return {
    density: stored?.density ?? SettingsDensity.COZY,
    soundAlerts: stored?.soundAlerts ?? true,
  };
}

export async function getUserPreferences(
  userId: string,
  role: UserRole,
  options: { resolveCopilotName?: boolean } = {},
): Promise<UserPreferencesView> {
  const stored = await prisma.userPreference.findUnique({ where: { userId } });
  const savedLanding = stored?.defaultLanding;
  let decryptedAIKey: string | undefined;
  let aiApiKeyNeedsReset = false;
  const storedKeyProvider = stored?.aiApiKeyProvider as AIProvider | null | undefined;
  const selectedProvider = (stored?.aiProvider as AIProvider | undefined) ?? "OPENAI";
  const copilotName = options.resolveCopilotName === false
    ? stored?.aiCopilotName ?? DEFAULT_AI_COPILOT_NAME
    : stored?.aiCopilotName
    ? await getEffectiveCopilotName(userId, role, stored.aiCopilotName)
    : role === UserRole.MANAGER
      ? DEFAULT_AI_COPILOT_NAME
      : await getEffectiveCopilotName(userId, role);
  if (stored?.aiApiKeyEncrypted) {
    if (!isEncryptedAIKey(stored.aiApiKeyEncrypted)) {
      aiApiKeyNeedsReset = true;
    } else {
      try {
        decryptedAIKey = decryptAIKey(stored.aiApiKeyEncrypted);
      } catch {
        aiApiKeyNeedsReset = true;
      }
    }
  }
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
    aiPreferences: {
      aiCopilotName: copilotName,
      aiProvider: (stored?.aiProvider as AIProvider) ?? "OPENAI",
      aiModel: stored?.aiModel ?? DEFAULT_AI_MODELS[selectedProvider],
      aiApiKeyMasked: maskApiKey(decryptedAIKey),
      aiApiKeyProvider: storedKeyProvider ?? null,
      hasCustomKey: Boolean(decryptedAIKey && storedKeyProvider === selectedProvider),
      hasStoredKey: Boolean(decryptedAIKey),
      aiApiKeyNeedsReset,
      aiCustomEndpoint: stored?.aiCustomEndpoint ?? "",
      aiAutonomousExecution: stored?.aiAutonomousExecution ?? false,
    },
  };
}
