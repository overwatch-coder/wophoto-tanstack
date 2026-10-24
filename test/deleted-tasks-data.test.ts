import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  count: vi.fn(),
  findManyTasks: vi.fn(),
  findManyProjects: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { count: mocks.count, findMany: mocks.findManyTasks },
    project: { findMany: mocks.findManyProjects },
  },
}));

import { getDeletedTasks } from "@/lib/tasks";
import { TaskPriority, UserRole } from "@/generated/prisma/client";

describe("deleted task page query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
    mocks.count.mockResolvedValueOnce(100).mockResolvedValueOnce(100);
    mocks.findManyTasks.mockResolvedValue([]);
    mocks.findManyProjects.mockResolvedValue([]);
  });

  it("limits task rows and applies the requested filters in the database", async () => {
    const result = await getDeletedTasks({
      page: 3,
      search: "chair",
      projectId: "project-7",
      priority: TaskPriority.HIGH,
    });

    expect(mocks.findManyTasks).toHaveBeenCalledWith(expect.objectContaining({
      take: 20,
      skip: 40,
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      where: expect.objectContaining({
        deletedAt: { not: null },
        priority: TaskPriority.HIGH,
        project: expect.objectContaining({ managerId: "manager-1", id: "project-7" }),
        OR: expect.arrayContaining([
          { title: { contains: "chair", mode: "insensitive" } },
          { description: { contains: "chair", mode: "insensitive" } },
        ]),
      }),
    }));
    expect(result).toMatchObject({ page: 3, total: 100, totalPages: 5, trashCount: 100 });
    expect(mocks.findManyProjects).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it("clamps out of range pages and caps search text", async () => {
    await getDeletedTasks({ page: 100, search: "x".repeat(150) });

    expect(mocks.findManyTasks).toHaveBeenCalledWith(expect.objectContaining({
      take: 20,
      skip: 80,
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { title: { contains: "x".repeat(120), mode: "insensitive" } },
        ]),
      }),
    }));
  });
});
