import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invitationFindFirst: vi.fn(),
  projectFindFirst: vi.fn(),
  policyFindUnique: vi.fn(),
  usageCount: vi.fn(),
  usageCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    invitation: { findFirst: mocks.invitationFindFirst },
    project: { findFirst: mocks.projectFindFirst },
    copilotStudioPolicy: { findUnique: mocks.policyFindUnique },
    copilotUsageEvent: { count: mocks.usageCount, create: mocks.usageCreate },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
      copilotStudioPolicy: { findUnique: mocks.policyFindUnique },
      copilotUsageEvent: { count: mocks.usageCount, create: mocks.usageCreate },
    })),
  },
}));

import { consumeCopilotDailyRequest, getCopilotStudioId, isCopilotEnabledForUser } from "@/lib/ai/copilot-access";
import { UserRole } from "@/generated/prisma/client";

describe("studio Copilot access policy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.invitationFindFirst.mockResolvedValue(null);
    mocks.projectFindFirst.mockResolvedValue(null);
  });

  it("keeps manager access enabled by default and defaults client access off", async () => {
    mocks.policyFindUnique.mockResolvedValue(null);
    await expect(isCopilotEnabledForUser("manager-1", UserRole.MANAGER)).resolves.toBe(true);
    await expect(isCopilotEnabledForUser("client-1", UserRole.CLIENT)).resolves.toBe(false);
  });

  it("preserves existing worker access when a studio has not saved a policy yet", async () => {
    mocks.invitationFindFirst.mockResolvedValue({ invitedById: "manager-1" });
    mocks.policyFindUnique.mockResolvedValue(null);
    await expect(isCopilotEnabledForUser("worker-1", UserRole.WORKER)).resolves.toBe(true);
  });

  it("lets the master switch block everyone even when a member has an allow exception", async () => {
    mocks.invitationFindFirst.mockResolvedValue({ invitedById: "manager-1" });
    mocks.policyFindUnique.mockResolvedValue({
      enabled: false,
      workersEnabled: true,
      clientsEnabled: true,
      overrides: [{ enabled: true }],
    });
    await expect(isCopilotEnabledForUser("worker-1", UserRole.WORKER)).resolves.toBe(false);
  });

  it("applies individual allow and block exceptions before role defaults", async () => {
    mocks.invitationFindFirst.mockResolvedValue({ invitedById: "manager-1" });
    mocks.policyFindUnique
      .mockResolvedValueOnce({ enabled: true, workersEnabled: false, clientsEnabled: false, overrides: [{ enabled: true }] })
      .mockResolvedValueOnce({ enabled: true, workersEnabled: true, clientsEnabled: true, overrides: [{ enabled: false }] });
    await expect(isCopilotEnabledForUser("worker-1", UserRole.WORKER)).resolves.toBe(true);
    await expect(isCopilotEnabledForUser("worker-1", UserRole.WORKER)).resolves.toBe(false);
  });

  it("uses the configured client default when there is no individual exception", async () => {
    mocks.invitationFindFirst.mockResolvedValue({ invitedById: "manager-1" });
    mocks.policyFindUnique.mockResolvedValue({ enabled: true, workersEnabled: true, clientsEnabled: true, overrides: [] });
    await expect(isCopilotEnabledForUser("client-1", UserRole.CLIENT)).resolves.toBe(true);
  });

  it("resolves a client to a studio through a current project when no invitation is linked", async () => {
    mocks.invitationFindFirst.mockResolvedValue(null);
    mocks.projectFindFirst.mockResolvedValue({ managerId: "manager-2" });
    await expect(getCopilotStudioId("client-1", UserRole.CLIENT)).resolves.toBe("manager-2");
  });

  it("records usage for the user and role before allowing a shared request", async () => {
    mocks.policyFindUnique.mockResolvedValue({ dailyRequestLimit: 12 });
    mocks.usageCount.mockResolvedValue(3);
    mocks.usageCreate.mockResolvedValue({ id: "usage-1" });
    await expect(consumeCopilotDailyRequest("manager-1", "worker-1", UserRole.WORKER, "OPENAI", "gpt-6.1-sol"))
      .resolves.toEqual({ allowed: true });
    expect(mocks.usageCreate).toHaveBeenCalledWith({ data: {
      managerId: "manager-1",
      userId: "worker-1",
      role: UserRole.WORKER,
      provider: "OPENAI",
      model: "gpt-6.1-sol",
    } });
  });

  it("blocks a shared request after the member reaches the daily cap", async () => {
    mocks.policyFindUnique.mockResolvedValue({ dailyRequestLimit: 3 });
    mocks.usageCount.mockResolvedValue(3);
    await expect(consumeCopilotDailyRequest("manager-1", "client-1", UserRole.CLIENT, "OPENAI", "gpt-6.1-sol"))
      .resolves.toEqual({ allowed: false, limit: 3 });
    expect(mocks.usageCreate).not.toHaveBeenCalled();
  });
});
