import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  userFindMany: vi.fn(),
  policyUpsert: vi.fn(),
  overrideDeleteMany: vi.fn(),
  overrideCreateMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authz", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/studio-access", () => {
  const actor = async () => mocks.requireRole("MANAGER");
  const context = (user: { id: string; role: string }) => ({
    studioId: `studio-${user.id}`, ownerUserId: user.id, isOwner: user.role === "MANAGER",
    memberId: null, role: user.role, grants: {},
  });
  return {
    requireStudioArea: async () => { const user = await actor(); return { user, context: context(user) }; },
    requireStudioManagerArea: async () => { const user = await actor(); return { manager: { ...user, actorId: user.id }, actor: user, context: context(user) }; },
    requireStudioOwner: async () => { const user = await actor(); return { user, context: context(user) }; },
    getStudioAccessContext: async (userId: string, role: string) => ({ studioId: `studio-${userId}`, ownerUserId: role === "MANAGER" ? userId : "manager-1", isOwner: role === "MANAGER", memberId: role === "MANAGER" ? null : "member-1", role, grants: {} }),
    hasStudioAccess: () => true,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
      copilotStudioPolicy: { upsert: mocks.policyUpsert },
      copilotAccessOverride: { deleteMany: mocks.overrideDeleteMany, createMany: mocks.overrideCreateMany },
    })),
  },
}));

import { updateCopilotStudioPolicyAction } from "@/app/actions/copilot-studio";
import { decryptAIKey, isEncryptedAIKey } from "@/lib/ai/credentials";
import { UserRole } from "@/generated/prisma/client";

const previousEncryptionKey = process.env.AI_KEYS_ENCRYPTION_KEY;

describe("manager Copilot studio settings action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.AI_KEYS_ENCRYPTION_KEY = "a".repeat(64);
    mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
    mocks.userFindMany.mockResolvedValue([]);
    mocks.policyUpsert.mockResolvedValue({});
    mocks.overrideDeleteMany.mockResolvedValue({ count: 0 });
    mocks.overrideCreateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    if (previousEncryptionKey === undefined) delete process.env.AI_KEYS_ENCRYPTION_KEY;
    else process.env.AI_KEYS_ENCRYPTION_KEY = previousEncryptionKey;
  });

  it("does not allow a non-manager to save studio policy", async () => {
    mocks.requireRole.mockRejectedValue(new Error("Forbidden"));
    const result = await updateCopilotStudioPolicyAction({});
    expect(result).toEqual({ error: "Forbidden" });
    expect(mocks.policyUpsert).not.toHaveBeenCalled();
  });

  it("encrypts a manager supplied provider key before it reaches Prisma", async () => {
    const result = await updateCopilotStudioPolicyAction({
      enabled: true,
      workersEnabled: true,
      clientsEnabled: false,
      provider: "OPENAI",
      model: "gpt-6.1-sol",
      apiKey: "private-provider-key",
      clearApiKey: false,
      customEndpoint: "",
      dailyRequestLimit: 100,
      overrides: [],
    });

    expect(result).toEqual({ success: true });
    const upsert = mocks.policyUpsert.mock.calls[0]?.[0] as { create: { apiKeyEncrypted: string }; update: { apiKeyEncrypted: string } };
    expect(isEncryptedAIKey(upsert.create.apiKeyEncrypted)).toBe(true);
    expect(upsert.create.apiKeyEncrypted).not.toContain("private-provider-key");
    expect(decryptAIKey(upsert.create.apiKeyEncrypted)).toBe("private-provider-key");
    expect(upsert.update.apiKeyEncrypted).not.toContain("private-provider-key");
  });

  it("rejects access exceptions that point outside the manager's own team", async () => {
    const result = await updateCopilotStudioPolicyAction({
      enabled: true,
      workersEnabled: true,
      clientsEnabled: false,
      provider: "OPENAI",
      model: "gpt-6.1-sol",
      apiKey: "",
      clearApiKey: false,
      customEndpoint: "",
      dailyRequestLimit: 100,
      overrides: [{ userId: "other-studio-worker", enabled: true }],
    });

    expect(result.error).toMatch(/outside your studio/i);
    expect(mocks.policyUpsert).not.toHaveBeenCalled();
    expect(mocks.overrideCreateMany).not.toHaveBeenCalled();
  });
});
