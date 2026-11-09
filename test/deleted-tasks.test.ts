import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireRole: vi.fn(),
  findFirstTask: vi.fn(),
  updateTask: vi.fn(),
  updateManyTask: vi.fn(),
  deleteTask: vi.fn(),
  deleteManyTask: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/authz", () => ({
  requireRole: mocks.requireRole,
}));
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
    $transaction: <T>(fn: (tx: {
      $queryRaw: typeof mocks.queryRaw;
      task: {
        findFirst: typeof mocks.findFirstTask;
        update: typeof mocks.updateTask;
        delete: typeof mocks.deleteTask;
      };
    }) => Promise<T>) => fn({
      $queryRaw: mocks.queryRaw,
      task: {
        findFirst: mocks.findFirstTask,
        update: mocks.updateTask,
        delete: mocks.deleteTask,
      },
    }),
    task: {
      findFirst: mocks.findFirstTask,
      update: mocks.updateTask,
      updateMany: mocks.updateManyTask,
      delete: mocks.deleteTask,
      deleteMany: mocks.deleteManyTask,
    },
  },
}));

import {
  restoreTask,
  restoreMultipleTasks,
  permanentlyDeleteTask,
  emptyTrash,
} from "@/src/server/actions/tasks";
import { UserRole } from "@/generated/prisma/client";

describe("Deleted Tasks Trash & Recovery actions", () => {
  const managerUser = { id: "mgr_1", role: UserRole.MANAGER };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue(managerUser);
  });

  describe("restoreTask", () => {
    it("restores a soft-deleted task back to active", async () => {
      mocks.findFirstTask.mockResolvedValue({ id: "task_123" });
      mocks.updateTask.mockResolvedValue({ id: "task_123", deletedAt: null });

      const result = await restoreTask("task_123");

      expect(mocks.requireRole).toHaveBeenCalledWith(UserRole.MANAGER);
      expect(mocks.findFirstTask).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "task_123",
            deletedAt: { not: null },
            project: { managerId: managerUser.id },
          }),
        })
      );
      expect(mocks.updateTask).toHaveBeenCalledWith({
        where: { id: "task_123" },
        data: { deletedAt: null },
      });
      expect(result).toEqual({
        success: "Task restored successfully.",
        taskId: "task_123",
      });
    });

    it("returns an error if task is not in trash or belongs to another manager", async () => {
      mocks.findFirstTask.mockResolvedValue(null);

      const result = await restoreTask("missing_task");

      expect(result.error).toBe("Task not found or is not in trash.");
      expect(mocks.updateTask).not.toHaveBeenCalled();
    });

    it("rejects non-manager roles", async () => {
      mocks.requireRole.mockRejectedValue(new Error("Unauthorized."));

      const result = await restoreTask("task_123");

      expect(result.error).toBe("Unauthorized.");
    });
  });

  describe("restoreMultipleTasks", () => {
    it("batch restores multiple tasks in one call", async () => {
      mocks.updateManyTask.mockResolvedValue({ count: 3 });

      const result = await restoreMultipleTasks(["t1", "t2", "t3"]);

      expect(mocks.updateManyTask).toHaveBeenCalledWith({
        where: {
          id: { in: ["t1", "t2", "t3"] },
          deletedAt: { not: null },
          project: { managerId: managerUser.id },
        },
        data: { deletedAt: null },
      });
      expect(result).toEqual({ success: "3 task(s) restored successfully." });
    });

    it("validates empty selection", async () => {
      const result = await restoreMultipleTasks([]);
      expect(result.error).toBe("Select at least one valid task to restore.");
      expect(mocks.updateManyTask).not.toHaveBeenCalled();
    });
  });

  describe("permanentlyDeleteTask", () => {
    it("permanently deletes a soft-deleted task", async () => {
      mocks.findFirstTask.mockResolvedValue({ id: "task_del_1" });
      mocks.deleteTask.mockResolvedValue({ id: "task_del_1" });

      const result = await permanentlyDeleteTask("task_del_1");

      expect(mocks.findFirstTask).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "task_del_1",
            deletedAt: { not: null },
            project: { managerId: managerUser.id },
          }),
        })
      );
      expect(mocks.deleteTask).toHaveBeenCalledWith({
        where: { id: "task_del_1" },
      });
      expect(result).toEqual({
        success: "Task permanently deleted.",
        taskId: "task_del_1",
      });
    });

    it("returns error if task not found", async () => {
      mocks.findFirstTask.mockResolvedValue(null);

      const result = await permanentlyDeleteTask("unknown_task");

      expect(result.error).toBe("Task not found or is not in trash.");
      expect(mocks.deleteTask).not.toHaveBeenCalled();
    });
  });

  describe("emptyTrash", () => {
    it("purges all soft-deleted tasks for projects managed by the manager", async () => {
      mocks.deleteManyTask.mockResolvedValue({ count: 7 });

      const result = await emptyTrash();

      expect(mocks.deleteManyTask).toHaveBeenCalledWith({
        where: {
          deletedAt: { not: null },
          project: { managerId: managerUser.id },
        },
      });
      expect(result).toEqual({
        success: "Trash emptied. 7 task(s) permanently removed.",
      });
    });
  });

  describe("Retention calculation logic", () => {
    it("calculates remaining retention days within 30 days window", () => {
      const now = new Date("2026-10-24T12:00:00Z").getTime();
      const RETENTION_DAYS = 30;

      // Deleted 5 days ago
      const deletedAt5DaysAgo = new Date("2026-10-19T12:00:00Z").getTime();
      const daysPassed5 = Math.floor((now - deletedAt5DaysAgo) / (1000 * 60 * 60 * 24));
      const remaining5 = Math.max(0, RETENTION_DAYS - daysPassed5);
      expect(remaining5).toBe(25);

      // Deleted 35 days ago (expired retention window)
      const deletedAt35DaysAgo = new Date("2026-09-19T12:00:00Z").getTime();
      const daysPassed35 = Math.floor((now - deletedAt35DaysAgo) / (1000 * 60 * 60 * 24));
      const remaining35 = Math.max(0, RETENTION_DAYS - daysPassed35);
      expect(remaining35).toBe(0);
    });
  });
});
