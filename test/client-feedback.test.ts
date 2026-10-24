import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireRole: vi.fn(),
  findFirstProject: vi.fn(),
  findFirstTask: vi.fn(),
  updateTask: vi.fn(),
  findFirstUser: vi.fn(),
  findUniqueTaskAssignee: vi.fn(),
  updateTaskAssignee: vi.fn(),
  updateManyTaskAssignee: vi.fn(),
  createTaskAssignee: vi.fn(),
  createClientFeedback: vi.fn(),
  findFirstClientFeedback: vi.fn(),
  updateClientFeedback: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/authz", () => ({
  requireRole: mocks.requireRole,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: mocks.findFirstProject,
    },
    task: {
      findFirst: mocks.findFirstTask,
      update: mocks.updateTask,
    },
    user: {
      findFirst: mocks.findFirstUser,
    },
    taskAssignee: {
      findUnique: mocks.findUniqueTaskAssignee,
      update: mocks.updateTaskAssignee,
      updateMany: mocks.updateManyTaskAssignee,
      create: mocks.createTaskAssignee,
    },
    clientFeedback: {
      create: mocks.createClientFeedback,
      findFirst: mocks.findFirstClientFeedback,
      update: mocks.updateClientFeedback,
    },
  },
}));

import {
  createClientFeedback,
  resolveFeedback,
  delegateFeedbackToWorker,
  submitWorkerRevision,
} from "@/app/actions/feedback";
import { FeedbackStatus, FeedbackType, TaskStatus, UserRole } from "@/generated/prisma/client";

describe("Client Feedback & Request Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createClientFeedback", () => {
    it("validates required fields: rejects missing project", async () => {
      mocks.requireRole.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT });

      const formData = new FormData();
      formData.set("title", "Fix lighting on hero shot");
      formData.set("details", "Too dark in the bottom right corner.");

      const result = await createClientFeedback({}, formData);
      expect(result.error).toBe("Please choose a campaign or project.");
      expect(mocks.createClientFeedback).not.toHaveBeenCalled();
    });

    it("validates title length", async () => {
      mocks.requireRole.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT });

      const formData = new FormData();
      formData.set("projectId", "proj-1");
      formData.set("title", "No");
      formData.set("details", "Needs color temperature adjustments.");

      const result = await createClientFeedback({}, formData);
      expect(result.error).toBe("Request title must be between 3 and 150 characters.");
      expect(mocks.createClientFeedback).not.toHaveBeenCalled();
    });

    it("validates details length", async () => {
      mocks.requireRole.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT });

      const formData = new FormData();
      formData.set("projectId", "proj-1");
      formData.set("title", "Color adjustment");
      formData.set("details", "Bad");

      const result = await createClientFeedback({}, formData);
      expect(result.error).toBe("Request details must be between 5 and 5,000 characters.");
      expect(mocks.createClientFeedback).not.toHaveBeenCalled();
    });

    it("ensures the project belongs to the requesting client", async () => {
      mocks.requireRole.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT });
      mocks.findFirstProject.mockResolvedValue(null);

      const formData = new FormData();
      formData.set("projectId", "proj-other");
      formData.set("title", "Exposure revision");
      formData.set("details", "Please increase exposure on the key light.");

      const result = await createClientFeedback({}, formData);
      expect(result.error).toBe("This project is not accessible to your client account.");
      expect(mocks.createClientFeedback).not.toHaveBeenCalled();
    });

    it("successfully creates a revision request without a satisfaction rating", async () => {
      mocks.requireRole.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT });
      mocks.findFirstProject.mockResolvedValue({ id: "proj-1" });
      mocks.createClientFeedback.mockResolvedValue({ id: "fb-123" });

      const formData = new FormData();
      formData.set("projectId", "proj-1");
      formData.set("title", "Color grade tweak on coats");
      formData.set("details", "Please cool down the warmth by 200K.");
      formData.set("type", "REVISION");

      const result = await createClientFeedback({}, formData);
      expect(result.success).toBe("Request submitted successfully to the studio team.");
      expect(result.createdId).toBe("fb-123");

      expect(mocks.createClientFeedback).toHaveBeenCalledWith({
        data: {
          projectId: "proj-1",
          taskId: null,
          clientId: "client-1",
          type: FeedbackType.REVISION,
          status: FeedbackStatus.NEW,
          score: null,
          title: "Color grade tweak on coats",
          details: "Please cool down the warmth by 200K.",
        },
      });

      expect(mocks.revalidatePath).toHaveBeenCalledWith("/client/project-feedback");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/manager/reviews");
    });
  });

  describe("delegateFeedbackToWorker", () => {
    it("validates worker and instructions presence", async () => {
      mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });

      const formData = new FormData();
      formData.set("feedbackId", "fb-123");
      formData.set("workerId", "");
      formData.set("delegationNote", "Fix highlights");

      const result = await delegateFeedbackToWorker({}, formData);
      expect(result.error).toBe("Please choose a worker to delegate this revision to.");
      expect(mocks.updateClientFeedback).not.toHaveBeenCalled();
    });

    it("verifies manager permissions and delegates revision to selected worker", async () => {
      mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
      mocks.findFirstClientFeedback.mockResolvedValue({
        id: "fb-123",
        taskId: "task-01",
        projectId: "proj-1",
      });
      mocks.findFirstUser.mockResolvedValue({ id: "worker-1", name: "Elena Rostova" });
      mocks.findUniqueTaskAssignee.mockResolvedValue({ taskId: "task-01", userId: "worker-1" });

      const formData = new FormData();
      formData.set("feedbackId", "fb-123");
      formData.set("workerId", "worker-1");
      formData.set("delegationNote", "Please crop tighter on frame 014 and reduce highlight clip.");

      const result = await delegateFeedbackToWorker({}, formData);
      expect(result.success).toBe("Revision delegated to Elena Rostova.");

      expect(mocks.updateClientFeedback).toHaveBeenCalledWith({
        where: { id: "fb-123" },
        data: {
          status: FeedbackStatus.ASSIGNED_TO_WORKER,
          assignedWorkerId: "worker-1",
          delegationNote: "Please crop tighter on frame 014 and reduce highlight clip.",
          delegatedAt: expect.any(Date),
          workerNote: null,
          workerSubmittedAt: null,
        },
      });

      expect(mocks.updateTaskAssignee).toHaveBeenCalledWith({
        where: { taskId_userId: { taskId: "task-01", userId: "worker-1" } },
        data: {
          status: TaskStatus.IN_PROGRESS,
          submittedAt: null,
          managerNote: "Please crop tighter on frame 014 and reduce highlight clip.",
        },
      });
    });

    it("rejects delegating a client review", async () => {
      mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
      mocks.findFirstClientFeedback.mockResolvedValue({
        id: "fb-review",
        type: FeedbackType.REVIEW,
      });

      const formData = new FormData();
      formData.set("feedbackId", "fb-review");
      formData.set("workerId", "worker-1");
      formData.set("delegationNote", "Please revise this deliverable.");

      const result = await delegateFeedbackToWorker({}, formData);
      expect(result.error).toBe("Client reviews cannot be delegated to workers.");
      expect(mocks.findFirstUser).not.toHaveBeenCalled();
      expect(mocks.updateClientFeedback).not.toHaveBeenCalled();
    });
  });

  describe("submitWorkerRevision", () => {
    it("rejects submitting a client review as a worker revision", async () => {
      mocks.requireRole.mockResolvedValue({ id: "worker-1", role: UserRole.WORKER });
      mocks.findFirstClientFeedback.mockResolvedValue({
        id: "fb-review",
        type: FeedbackType.REVIEW,
      });

      const formData = new FormData();
      formData.set("feedbackId", "fb-review");
      formData.set("workerNote", "Finished the requested changes.");

      const result = await submitWorkerRevision({}, formData);
      expect(result.error).toBe("Client reviews do not have a worker revision workflow.");
      expect(mocks.updateClientFeedback).not.toHaveBeenCalled();
      expect(mocks.updateManyTaskAssignee).not.toHaveBeenCalled();
    });

    it("allows assigned worker to submit revision adjustments for manager review", async () => {
      mocks.requireRole.mockResolvedValue({ id: "worker-1", role: UserRole.WORKER });
      mocks.findFirstClientFeedback.mockResolvedValue({
        id: "fb-123",
        taskId: "task-01",
      });

      const formData = new FormData();
      formData.set("feedbackId", "fb-123");
      formData.set("workerNote", "Completed highlight reduction in Lightroom and pushed master TIFF.");

      const result = await submitWorkerRevision({}, formData);
      expect(result.success).toBe("Revisions submitted to manager for review.");

      expect(mocks.updateClientFeedback).toHaveBeenCalledWith({
        where: { id: "fb-123" },
        data: {
          status: FeedbackStatus.IN_REVIEW,
          workerNote: "Completed highlight reduction in Lightroom and pushed master TIFF.",
          workerSubmittedAt: expect.any(Date),
        },
      });

      expect(mocks.updateManyTaskAssignee).toHaveBeenCalledWith({
        where: { taskId: "task-01", userId: "worker-1" },
        data: {
          status: TaskStatus.IN_REVIEW,
          submittedAt: expect.any(Date),
        },
      });
    });
  });

  describe("resolveFeedback", () => {
    it("validates resolution note presence", async () => {
      mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });

      const formData = new FormData();
      formData.set("feedbackId", "fb-123");
      formData.set("responseNote", " ");

      const result = await resolveFeedback({}, formData);
      expect(result.error).toBe("Resolution note must be between 3 and 5,000 characters.");
      expect(mocks.updateClientFeedback).not.toHaveBeenCalled();
    });

    it("verifies manager has permission over the project", async () => {
      mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
      mocks.findFirstClientFeedback.mockResolvedValue(null);

      const formData = new FormData();
      formData.set("feedbackId", "fb-unauthorized");
      formData.set("responseNote", "We have updated the master TIFF files.");

      const result = await resolveFeedback({}, formData);
      expect(result.error).toBe("You do not have permission to resolve this feedback.");
      expect(mocks.updateClientFeedback).not.toHaveBeenCalled();
    });

    it("rejects resolving a client review", async () => {
      mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
      mocks.findFirstClientFeedback.mockResolvedValue({
        id: "fb-review",
        type: FeedbackType.REVIEW,
      });

      const formData = new FormData();
      formData.set("feedbackId", "fb-review");
      formData.set("responseNote", "Thank you for the review.");

      const result = await resolveFeedback({}, formData);
      expect(result.error).toBe("Client reviews do not require a resolution action.");
      expect(mocks.updateClientFeedback).not.toHaveBeenCalled();
      expect(mocks.updateManyTaskAssignee).not.toHaveBeenCalled();
    });

    it("successfully marks feedback as RESOLVED with manager note and timestamp", async () => {
      mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
      mocks.findFirstClientFeedback.mockResolvedValue({ id: "fb-123", taskId: "task-01" });
      mocks.updateClientFeedback.mockResolvedValue({ id: "fb-123", status: FeedbackStatus.RESOLVED });

      const formData = new FormData();
      formData.set("feedbackId", "fb-123");
      formData.set("responseNote", "Temperature recalibrated in Capture One. New proofs pushed.");

      const result = await resolveFeedback({}, formData);
      expect(result.success).toBe("Resolution note recorded and ticket marked as resolved.");

      expect(mocks.updateClientFeedback).toHaveBeenCalledWith({
        where: { id: "fb-123" },
        data: {
          status: FeedbackStatus.RESOLVED,
          responseNote: "Temperature recalibrated in Capture One. New proofs pushed.",
          respondedAt: expect.any(Date),
          respondedById: "manager-1",
        },
      });

      expect(mocks.revalidatePath).toHaveBeenCalledWith("/manager/reviews");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/client/project-feedback");
    });
  });
});
