import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  projectFindFirst: vi.fn(),
  invitationFindFirst: vi.fn(),
  workRequestCreate: vi.fn(),
  workRequestFindFirst: vi.fn(),
  workRequestUpdate: vi.fn(),
  userFindMany: vi.fn(),
  projectCreate: vi.fn(),
  taskCreate: vi.fn(),
  transaction: vi.fn(),
  raw: vi.fn(),
  notify: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authz", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/notifications", () => ({ createNotification: mocks.notify }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  project: { findFirst: mocks.projectFindFirst, create: mocks.projectCreate },
  invitation: { findFirst: mocks.invitationFindFirst },
  workRequest: { create: mocks.workRequestCreate, findFirst: mocks.workRequestFindFirst, update: mocks.workRequestUpdate },
  user: { findMany: mocks.userFindMany },
  task: { create: mocks.taskCreate },
  $transaction: mocks.transaction,
} }));

import { acceptWorkRequest, createWorkRequest } from "@/app/actions/work-requests";
import { UserRole, WorkRequestStatus, WorkRequestType } from "@/generated/prisma/client";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("work request actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notify.mockResolvedValue(undefined);
    mocks.revalidatePath.mockReturnValue(undefined);
  });

  it("creates a work request only after resolving its project through client ownership", async () => {
    mocks.requireRole.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT, name: "Client" });
    mocks.projectFindFirst.mockResolvedValue({ id: "project-1", managerId: "manager-1" });
    mocks.workRequestCreate.mockResolvedValue({ id: "request-1", type: WorkRequestType.WORK, title: "Retouch portraits", managerId: "manager-1", projectId: "project-1" });

    const result = await createWorkRequest({}, form({ type: "WORK", projectId: "project-1", title: "Retouch portraits", details: "Please retouch the new portrait images." }));

    expect(result.success).toBe("Request sent to the studio.");
    expect(mocks.projectFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "project-1", clientId: "client-1" } }));
    expect(mocks.workRequestCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientId: "client-1", managerId: "manager-1", projectId: "project-1" }) }));
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "manager-1", category: "ACTION_REQUIRED" }));
  });

  it("rejects a work request if the chosen project is not owned by the client", async () => {
    mocks.requireRole.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT });
    mocks.projectFindFirst.mockResolvedValue(null);
    const result = await createWorkRequest({}, form({ type: "WORK", projectId: "foreign-project", title: "Retouch portraits", details: "Please retouch the new portrait images." }));
    expect(result.error).toBe("Choose a project that belongs to your account.");
    expect(mocks.workRequestCreate).not.toHaveBeenCalled();
  });

  it("routes new project requests to the manager who invited the client", async () => {
    mocks.requireRole.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT });
    mocks.invitationFindFirst.mockResolvedValue({ invitedById: "manager-1" });
    mocks.workRequestCreate.mockResolvedValue({ id: "request-2", type: WorkRequestType.PROJECT, title: "Spring campaign", managerId: "manager-1", projectId: null });
    const result = await createWorkRequest({}, form({ type: "PROJECT", projectId: "", title: "Spring campaign", details: "We need a new spring campaign photo project." }));
    expect(result.requestId).toBe("request-2");
    expect(mocks.workRequestCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: WorkRequestType.PROJECT, projectId: null, managerId: "manager-1" }) }));
  });

  it("accepts a new project request and atomically creates its project and assigned task", async () => {
    mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
    mocks.userFindMany.mockResolvedValue([{ id: "worker-1" }]);
    const tx = {
      $queryRaw: mocks.raw.mockResolvedValue([]),
      workRequest: { findFirst: mocks.workRequestFindFirst.mockResolvedValue({ id: "request-3", type: WorkRequestType.PROJECT, title: "Spring campaign", details: "We need a new spring campaign photo project.", requestedDueAt: null, clientId: "client-1", projectId: null, createdTaskId: null, createdProjectId: null }), update: mocks.workRequestUpdate.mockResolvedValue({}) },
      project: { create: mocks.projectCreate.mockResolvedValue({ id: "project-new" }) },
      task: { create: mocks.taskCreate.mockResolvedValue({ id: "task-new" }) },
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));

    const result = await acceptWorkRequest({}, form({ requestId: "request-3", workerId: "worker-1", taskTitle: "Initial campaign shoot", priority: "HIGH", dueAt: "" }));

    expect(result.success).toBe("Project created and initial work assigned.");
    expect(mocks.projectCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: "Spring campaign", clientId: "client-1", managerId: "manager-1" }) }));
    expect(mocks.taskCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ projectId: "project-new", createdById: "manager-1", title: "Initial campaign shoot" }) }));
    expect(mocks.workRequestUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdProjectId: "project-new", createdTaskId: "task-new", status: WorkRequestStatus.IN_PROGRESS }) }));
  });
});
