import "server-only";

import { UserRole, UserStatus } from "@/generated/prisma/client";
import { decryptAIKey, isEncryptedAIKey } from "@/lib/ai/credentials";
import { prisma } from "@/lib/prisma";
import type { AIProvider } from "@/lib/settings-preferences";
import { getStudioAccessContext, hasStudioAccess, type StudioAccessContext } from "@/lib/studio-access";
import { StudioAccessLevel, StudioArea } from "@/generated/prisma/client";

export type CopilotMember = {
  userId: string;
  name: string;
  email: string;
  role: "WORKER" | "CLIENT";
  override: boolean | null;
};

export type CopilotStudioSettingsView = {
  enabled: boolean;
  workersEnabled: boolean;
  clientsEnabled: boolean;
  provider: AIProvider;
  model: string;
  customEndpoint: string;
  hasSharedKey: boolean;
  dailyRequestLimit: number;
  members: CopilotMember[];
  usageTodayTotal: number;
  usageByUser: Array<{ userId: string; name: string; role: UserRole; count: number }>;
};

export async function getCopilotStudioId(
  userId: string,
  role: UserRole,
  studioAccess?: StudioAccessContext | null,
): Promise<string | null> {
  if (role === UserRole.MANAGER) return userId;

  if (role === UserRole.SUPERVISOR || role === UserRole.COLLABORATOR) {
    const context = studioAccess !== undefined ? studioAccess : await getStudioAccessContext(userId, role);
    return context?.ownerUserId ?? null;
  }

  const invitation = await prisma.invitation.findFirst({
    where: { acceptedUserId: userId, status: { in: ["ACCEPTED", "USED"] } },
    select: { studio: { select: { ownerUserId: true } } },
  });
  if (invitation?.studio?.ownerUserId) return invitation.studio.ownerUserId;

  if (role === UserRole.CLIENT) {
    const project = await prisma.project.findFirst({
      where: { clientId: userId },
      orderBy: { updatedAt: "desc" },
      select: { studio: { select: { ownerUserId: true } } },
    });
    return project?.studio?.ownerUserId ?? null;
  }

  return null;
}

export async function isCopilotEnabledForUser(
  userId: string,
  role: UserRole,
  studioAccess?: StudioAccessContext | null,
  knownStudioId?: string | null,
): Promise<boolean> {
  if (role === UserRole.SUPERVISOR || role === UserRole.COLLABORATOR) {
    const context = studioAccess !== undefined ? studioAccess : await getStudioAccessContext(userId, role);
    if (!context || !hasStudioAccess(context, StudioArea.COPILOT, StudioAccessLevel.VIEW)) return false;
  }
  const managerId = knownStudioId === undefined
    ? await getCopilotStudioId(userId, role, studioAccess)
    : knownStudioId;
  if (!managerId) return false;

  const policy = await prisma.copilotStudioPolicy.findUnique({
    where: { managerId },
    select: {
      enabled: true,
      workersEnabled: true,
      clientsEnabled: true,
      overrides: { where: { userId }, select: { enabled: true }, take: 1 },
    },
  });

  // Existing studios keep worker access. Client access starts off until a
  // manager explicitly enables it, which avoids sharing a paid connection by default.
  if (!policy) return role === UserRole.MANAGER || role === UserRole.WORKER;
  if (!policy.enabled) return false;
  if (role === UserRole.MANAGER) return true;
  const override = policy.overrides[0];
  if (override) return override.enabled;
  return role === UserRole.WORKER ? policy.workersEnabled : role === UserRole.CLIENT && policy.clientsEnabled;
}

export async function getCopilotRuntimeConfig(managerId: string) {
  const policy = await prisma.copilotStudioPolicy.findUnique({
    where: { managerId },
    select: {
      provider: true,
      model: true,
      apiKeyEncrypted: true,
      customEndpoint: true,
      dailyRequestLimit: true,
    },
  });
  if (!policy) return null;

  return {
    provider: policy.provider as AIProvider,
    model: policy.model,
    apiKeyEncrypted: policy.apiKeyEncrypted,
    apiKey: policy.apiKeyEncrypted && isEncryptedAIKey(policy.apiKeyEncrypted)
      ? decryptAIKey(policy.apiKeyEncrypted)
      : undefined,
    customEndpoint: policy.customEndpoint ?? undefined,
    dailyRequestLimit: policy.dailyRequestLimit,
    hasSharedKey: Boolean(policy.apiKeyEncrypted),
  };
}

export async function getCopilotStudioSettings(managerId: string): Promise<CopilotStudioSettingsView> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [policy, workers, clients, usageGroups] = await Promise.all([
    prisma.copilotStudioPolicy.findUnique({
      where: { managerId },
      select: {
        enabled: true,
        workersEnabled: true,
        clientsEnabled: true,
        provider: true,
        model: true,
        customEndpoint: true,
        apiKeyEncrypted: true,
        dailyRequestLimit: true,
        overrides: { select: { userId: true, enabled: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: UserRole.WORKER, status: UserStatus.ACTIVE, acceptedInvitation: { is: { invitedById: managerId } } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        OR: [
          { acceptedInvitation: { is: { invitedById: managerId } } },
          { clientProjects: { some: { managerId } } },
        ],
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.copilotUsageEvent.groupBy({
      by: ["userId", "role"],
      where: { managerId, createdAt: { gte: startOfDay } },
      _count: { _all: true },
    }),
  ]);
  const overrides = new Map(policy?.overrides.map(({ userId, enabled }) => [userId, enabled]));
  const names = new Map([
    [managerId, "You"] as const,
    ...workers.map(({ id, name, email }) => [id, name || email] as const),
    ...clients.map(({ id, name, email }) => [id, name || email] as const),
  ]);
  const usageByUser = usageGroups.map(({ userId, role, _count }) => ({
    userId,
    name: names.get(userId) ?? (userId === managerId ? "You" : "Former team member"),
    role,
    count: _count._all,
  }));

  return {
    enabled: policy?.enabled ?? true,
    workersEnabled: policy?.workersEnabled ?? true,
    clientsEnabled: policy?.clientsEnabled ?? false,
    provider: (policy?.provider as AIProvider | undefined) ?? "OPENAI",
    model: policy?.model ?? "gpt-6.1-sol",
    customEndpoint: policy?.customEndpoint ?? "",
    hasSharedKey: Boolean(policy?.apiKeyEncrypted),
    dailyRequestLimit: policy?.dailyRequestLimit ?? 100,
    usageTodayTotal: usageByUser.reduce((total, item) => total + item.count, 0),
    usageByUser,
    members: [
      ...workers.map((member) => ({ userId: member.id, name: member.name || member.email, email: member.email, role: "WORKER" as const, override: overrides.get(member.id) ?? null })),
      ...clients.map((member) => ({ userId: member.id, name: member.name || member.email, email: member.email, role: "CLIENT" as const, override: overrides.get(member.id) ?? null })),
    ],
  };
}

export async function consumeCopilotDailyRequest(
  managerId: string,
  userId: string,
  role: UserRole,
  provider: string,
  model: string,
) {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.copilotStudioPolicy.findUnique({
      where: { managerId },
      select: { dailyRequestLimit: true, studioId: true },
    });
    if (!policy) return { allowed: true };
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const todayCount = await tx.copilotUsageEvent.count({ where: { managerId, userId, createdAt: { gte: startOfDay } } });
    if (policy.dailyRequestLimit > 0 && todayCount >= policy.dailyRequestLimit) {
      return { allowed: false, limit: policy.dailyRequestLimit };
    }
    await tx.copilotUsageEvent.create({ data: { managerId, studioId: policy.studioId, userId, role, provider, model } });
    return { allowed: true };
  }, { isolationLevel: "Serializable" });
}
