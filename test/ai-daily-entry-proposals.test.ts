import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  findProjects: vi.fn(),
  findEligibleProject: vi.fn(),
  createTask: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    project: { findMany: mocks.findProjects, findFirst: mocks.findEligibleProject },
    task: { create: mocks.createTask },
  },
}));

import { UserRole, UserStatus } from "@/generated/prisma/client";
import { createDailyEntryForWorker, prepareDailyEntryProposal } from "@/lib/ai/daily-entry-proposals";

const today = new Date().toISOString().slice(0, 10);

describe("Copilot daily work proposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({ role: UserRole.WORKER, status: UserStatus.ACTIVE });
    mocks.findProjects.mockResolvedValue([{ id: "project-1", name: "Jossy Wedding" }]);
    mocks.findEligibleProject.mockResolvedValue({ id: "project-1", name: "Jossy Wedding" });
    mocks.createTask.mockResolvedValue({ id: "daily-entry-1" });
  });

  it("prepares a readable daily entry proposal for a project the worker is assigned to", async () => {
    const result = await prepareDailyEntryProposal("worker-1", {
      projectName: "Jossy Wedding",
      title: "Logged 20 wedding photos",
      description: "Retouched 20 photos today.",
      workDate: today,
    });

    expect(result).toMatchObject({
      requiresConfirmation: true,
      proposalType: "CREATE_DAILY_ENTRY",
      dailyEntryPreview: {
        projectName: "Jossy Wedding",
        title: "Logged 20 wedding photos",
        workDate: today,
      },
      payload: { projectId: "project-1", title: "Logged 20 wedding photos", workDate: today },
    });
    expect(mocks.findProjects).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        name: { contains: "Jossy Wedding", mode: "insensitive" },
      }),
    }));
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  it("asks for project clarification when several assigned projects match", async () => {
    mocks.findProjects.mockResolvedValue([
      { id: "project-1", name: "Jossy Wedding" },
      { id: "project-2", name: "Jossy Wedding Reception" },
    ]);

    const result = await prepareDailyEntryProposal("worker-1", {
      projectName: "Jossy",
      title: "Logged 20 photos",
      workDate: today,
    });

    expect(result).toMatchObject({ needsInput: true });
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  it("saves only after confirmation and repeats the worker assignment check", async () => {
    const result = await createDailyEntryForWorker("worker-1", {
      projectId: "project-1",
      title: "Logged 20 wedding photos",
      description: "Retouched 20 photos today.",
      priority: "MEDIUM",
      workDate: today,
    });

    expect(result).toMatchObject({ message: "Daily work logged for Jossy Wedding.", taskId: "daily-entry-1" });
    expect(mocks.findEligibleProject).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "project-1",
        tasks: expect.objectContaining({ some: expect.objectContaining({ assignees: { some: { userId: "worker-1" } } }) }),
      }),
    }));
    expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ projectId: "project-1", createdById: "worker-1", type: "DAILY_ENTRY" }),
    }));
  });

  it("rejects future dates and non-worker accounts before writing", async () => {
    const futureDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const futureResult = await createDailyEntryForWorker("worker-1", {
      projectId: "project-1",
      title: "Future entry",
      description: "",
      priority: "MEDIUM",
      workDate: futureDate,
    });
    expect(futureResult).toMatchObject({ error: "Choose today or a past work date." });

    mocks.findUser.mockResolvedValue({ role: UserRole.MANAGER, status: UserStatus.ACTIVE });
    const managerResult = await createDailyEntryForWorker("manager-1", {
      projectId: "project-1",
      title: "Not allowed",
      description: "",
      priority: "MEDIUM",
      workDate: today,
    });
    expect(managerResult).toMatchObject({ error: "Only active workers can log daily work." });
    expect(mocks.createTask).not.toHaveBeenCalled();
  });
});
