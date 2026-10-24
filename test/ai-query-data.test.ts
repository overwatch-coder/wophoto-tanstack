import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectCount: vi.fn(),
  projectFindMany: vi.fn(),
  taskCount: vi.fn(),
  taskFindMany: vi.fn(),
  taskGroupBy: vi.fn(),
  feedbackCount: vi.fn(),
  feedbackFindMany: vi.fn(),
  notificationCount: vi.fn(),
  notificationFindMany: vi.fn(),
  commentCount: vi.fn(),
  commentFindMany: vi.fn(),
  ratingCount: vi.fn(),
  ratingFindMany: vi.fn(),
  invitationCount: vi.fn(),
  invitationFindMany: vi.fn(),
  userCount: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { count: mocks.projectCount, findMany: mocks.projectFindMany },
    task: { count: mocks.taskCount, findMany: mocks.taskFindMany, groupBy: mocks.taskGroupBy },
    clientFeedback: { count: mocks.feedbackCount, findMany: mocks.feedbackFindMany },
    notification: { count: mocks.notificationCount, findMany: mocks.notificationFindMany },
    comment: { count: mocks.commentCount, findMany: mocks.commentFindMany },
    rating: { count: mocks.ratingCount, findMany: mocks.ratingFindMany },
    invitation: { count: mocks.invitationCount, findMany: mocks.invitationFindMany },
    user: { count: mocks.userCount, findMany: mocks.userFindMany },
  },
}));

import { UserRole } from "@/generated/prisma/client";
import { queryStudioData, studioDataQuerySchema } from "@/lib/ai/query-data";

const manager = { userId: "manager-1", role: UserRole.MANAGER };
const worker = { userId: "worker-1", role: UserRole.WORKER };
const client = { userId: "client-1", role: UserRole.CLIENT };

describe("Studio Copilot database queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectCount.mockResolvedValue(1);
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.taskCount.mockResolvedValue(0);
    mocks.taskFindMany.mockResolvedValue([]);
    mocks.taskGroupBy.mockImplementation(({ by }: { by: string[] }) =>
      Promise.resolve(by.includes("status")
        ? [{ projectId: "project-1", status: "IN_REVIEW", _count: { _all: 1 } }]
        : [{ projectId: "project-1", _max: { dueAt: new Date("2026-10-30T12:00:00Z") } }]),
    );
  });

  it("returns the exact manager scoped project count with no filters", async () => {
    const input = studioDataQuerySchema.parse({ entity: "PROJECTS", operation: "COUNT" });

    const result = await queryStudioData(manager, input);

    expect(result).toMatchObject({ entity: "PROJECTS", operation: "COUNT", count: 1 });
    expect(mocks.projectCount).toHaveBeenCalledWith({
      where: { AND: [{ managerId: "manager-1" }] },
    });
  });

  it("caps project lists at 20 and returns the next page offset", async () => {
    mocks.projectCount.mockResolvedValue(21);
    mocks.projectFindMany.mockResolvedValue(Array.from({ length: 21 }, (_, index) => ({
      id: `project-${index + 1}`,
      name: `Project ${index + 1}`,
      description: null,
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-02T00:00:00Z"),
      client: { name: "Client" },
    })));
    const input = studioDataQuerySchema.parse({
      entity: "PROJECTS", operation: "LIST", limit: 20, offset: 20,
    });

    const result = await queryStudioData(manager, input);

    expect(mocks.projectFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 21, skip: 20 }));
    expect(result).toMatchObject({
      totalMatching: 21,
      returned: 20,
      page: { limit: 20, offset: 20, hasMore: true, nextOffset: 40 },
    });
  });

  it("denies clients task queries before reading the task table", async () => {
    const input = studioDataQuerySchema.parse({ entity: "TASKS", operation: "COUNT" });

    const result = await queryStudioData(client, input);

    expect(result).toMatchObject({ error: "Client accounts cannot query internal task records." });
    expect(mocks.taskCount).not.toHaveBeenCalled();
  });

  it("scopes client project counts to projects owned by that client", async () => {
    const input = studioDataQuerySchema.parse({ entity: "PROJECTS", operation: "COUNT" });

    await queryStudioData(client, input);

    expect(mocks.projectCount).toHaveBeenCalledWith({
      where: { AND: [{ clientId: "client-1" }] },
    });
  });

  it("scopes worker task counts to their assigned active tasks", async () => {
    const input = studioDataQuerySchema.parse({ entity: "TASKS", operation: "COUNT" });

    await queryStudioData(worker, input);

    expect(mocks.taskCount).toHaveBeenCalledWith({
      where: { AND: [{ AND: [{ deletedAt: null }, { assignees: { some: { userId: "worker-1" } } }] }] },
    });
  });

  it("scopes deleted task counts to the manager's projects", async () => {
    const input = studioDataQuerySchema.parse({ entity: "DELETED_TASKS", operation: "COUNT" });

    await queryStudioData(manager, input);

    expect(mocks.taskCount).toHaveBeenCalledWith({
      where: { AND: [{ AND: [{ deletedAt: { not: null } }, { project: { managerId: "manager-1" } }] }] },
    });
  });

  it("does not expose the deleted task archive to workers", async () => {
    const input = studioDataQuerySchema.parse({ entity: "DELETED_TASKS", operation: "COUNT" });

    const result = await queryStudioData(worker, input);

    expect(result).toMatchObject({ error: "Deleted tasks can only be queried by a manager." });
    expect(mocks.taskCount).not.toHaveBeenCalled();
  });

  it("limits a worker's project summary to tasks assigned to that worker", async () => {
    mocks.projectFindMany.mockResolvedValue([{
      id: "project-1",
      name: "Assigned project",
      description: null,
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-02T00:00:00Z"),
      client: { name: "Client" },
    }]);
    const input = studioDataQuerySchema.parse({ entity: "PROJECTS", operation: "LIST" });

    await queryStudioData(worker, input);

    expect(mocks.taskGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assignees: { some: { userId: "worker-1" } } }),
    }));
  });

  it("rejects unsupported filters without querying the database", async () => {
    const input = studioDataQuerySchema.parse({
      entity: "PROJECTS",
      operation: "COUNT",
      filters: [{ field: "managerId", operator: "EQUALS", value: "someone-else" }],
    });

    const result = await queryStudioData(manager, input);

    expect(result).toMatchObject({ error: expect.stringContaining("does not support") });
    expect(mocks.projectCount).not.toHaveBeenCalled();
  });
});
