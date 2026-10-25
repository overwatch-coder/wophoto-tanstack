import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { project: { findMany: mocks.projectFindMany } } }));
vi.mock("@/lib/ai/actions", () => ({
  createProjectForManager: vi.fn(),
  createTaskBatchForManager: vi.fn(),
  prepareTaskBatchForManager: vi.fn(),
}));
vi.mock("@/lib/ai/inventory-proposals", () => ({
  inventoryActionPayloadSchema: {},
  prepareInventoryAction: vi.fn(),
}));

import { UserRole } from "@/generated/prisma/client";
import { createStudioTools } from "@/lib/ai/tools";

describe("Copilot client work request proposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectFindMany.mockResolvedValue([{ id: "project-1", name: "Spring campaign" }]);
  });

  it("prepares an owned-project request card without writing a request", async () => {
    const tools = createStudioTools({
      userId: "client-1",
      role: UserRole.CLIENT,
      userEmail: "client@example.com",
      autonomousExecution: true,
    });
    const prepare = tools.prepare_work_request as unknown as {
      execute: (args: Record<string, unknown>) => Promise<unknown>;
    };

    const result = await prepare.execute({
      type: "WORK",
      projectName: "Spring campaign",
      title: "Retouch product photos",
      details: "Please retouch the new product photos before the campaign launch.",
      requestedDueAt: "2026-11-04",
    });

    expect(result).toMatchObject({
      workRequestDraft: {
        type: "WORK",
        projectId: "project-1",
        projectName: "Spring campaign",
        title: "Retouch product photos",
        requestedDueAt: "2026-11-04",
      },
    });
    expect(mocks.projectFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { clientId: "client-1", name: { contains: "Spring campaign", mode: "insensitive" } },
    }));
  });

  it("asks the client to identify the project when several match", async () => {
    mocks.projectFindMany.mockResolvedValue([
      { id: "project-1", name: "Spring campaign" },
      { id: "project-2", name: "Spring campaign portraits" },
    ]);
    const tools = createStudioTools({
      userId: "client-1",
      role: UserRole.CLIENT,
      userEmail: "client@example.com",
      autonomousExecution: false,
    });
    const prepare = tools.prepare_work_request as unknown as {
      execute: (args: Record<string, unknown>) => Promise<unknown>;
    };

    const result = await prepare.execute({
      type: "WORK",
      projectName: "Spring",
      title: "Retouch product photos",
      details: "Please retouch the new product photos before the campaign launch.",
    });

    expect(result).toMatchObject({ needsInput: true });
  });
});
