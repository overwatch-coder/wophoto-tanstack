import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliverableType, EditCause, NotificationType, ProjectCollaboratorRole, TaskStatus, UserRole, UserStatus } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  projectFindUnique: vi.fn(),
  projectUpdate: vi.fn(),
  projectCollaboratorCreate: vi.fn(),
  projectCollaboratorDelete: vi.fn(),
  userFindUnique: vi.fn(),
  taskFindUnique: vi.fn(),
  taskUpdate: vi.fn(),
  taskRevisionCreate: vi.fn(),
  ratingUpsert: vi.fn(),
  commentCreate: vi.fn(),
  deliverableCreate: vi.fn(),
  deliverableDelete: vi.fn(),
  deliverableFindUnique: vi.fn(),
  createNotification: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: mocks.createNotification,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: mocks.projectFindUnique,
      update: mocks.projectUpdate,
    },
    projectCollaborator: {
      create: mocks.projectCollaboratorCreate,
      delete: mocks.projectCollaboratorDelete,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
    task: {
      findUnique: mocks.taskFindUnique,
      update: mocks.taskUpdate,
    },
    taskRevision: {
      create: mocks.taskRevisionCreate,
    },
    rating: {
      upsert: mocks.ratingUpsert,
    },
    comment: {
      create: mocks.commentCreate,
    },
    taskDeliverable: {
      create: mocks.deliverableCreate,
      delete: mocks.deliverableDelete,
      findUnique: mocks.deliverableFindUnique,
    },
    taskAssignee: {
      updateMany: vi.fn(),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        taskRevision: { create: mocks.taskRevisionCreate },
        task: { update: mocks.taskUpdate },
        taskAssignee: { updateMany: vi.fn() },
      }),
  },
}));

import { addProjectCollaborator, removeProjectCollaborator } from "@/src/server/actions/projects";
import { getProjectWorkspace } from "@/lib/projects";
import { addTaskComment, requestTaskEdit, submitTaskRating, uploadTaskDeliverable } from "@/src/server/actions/task-workflow";

describe("Multi-Client Project Collaboration & Taski Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Collaborator Management (e.g. Kojo inviting Ama)", () => {
    it("allows primary client Kojo to add collaborator Ama mid-project", async () => {
      const kojoSession = { user: { id: "user-kojo", name: "Kojo", role: UserRole.CLIENT } };
      mocks.auth.mockResolvedValue(kojoSession);

      mocks.projectFindUnique.mockResolvedValue({
        id: "proj-1",
        name: "Kick-off Campaign",
        managerId: "mgr-1",
        clientId: "user-kojo",
        collaborators: [],
      });

      mocks.userFindUnique.mockResolvedValue({
        id: "user-ama",
        name: "Ama",
        email: "ama@example.com",
        status: UserStatus.ACTIVE,
      });

      mocks.projectCollaboratorCreate.mockResolvedValue({
        id: "collab-1",
        projectId: "proj-1",
        userId: "user-ama",
        role: ProjectCollaboratorRole.COLLABORATOR,
      });

      const result = await addProjectCollaborator("proj-1", "ama@example.com");

      expect(result.success).toContain("Successfully added Ama");
      expect(mocks.projectCollaboratorCreate).toHaveBeenCalledWith({
        data: {
          projectId: "proj-1",
          userId: "user-ama",
          role: ProjectCollaboratorRole.COLLABORATOR,
          addedById: "user-kojo",
        },
      });
      expect(mocks.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-ama",
          actorId: "user-kojo",
          title: "Added to project workspace",
        })
      );
    });

    it("prevents duplicate collaborator additions", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "user-kojo", role: UserRole.CLIENT } });

      mocks.projectFindUnique.mockResolvedValue({
        id: "proj-1",
        name: "Kick-off Campaign",
        managerId: "mgr-1",
        clientId: "user-kojo",
        collaborators: [{ userId: "user-ama" }],
      });

      mocks.userFindUnique.mockResolvedValue({
        id: "user-ama",
        name: "Ama",
        email: "ama@example.com",
        status: UserStatus.ACTIVE,
      });

      const result = await addProjectCollaborator("proj-1", "ama@example.com");
      expect(result.error).toContain("already a collaborator");
    });

    it("scopes collaborator deletion to the project whose manager was authorized", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "manager-a", role: UserRole.MANAGER } });
      mocks.projectFindUnique.mockResolvedValue({
        id: "project-a",
        managerId: "manager-a",
        clientId: "client-a",
        collaborators: [],
      });
      mocks.projectCollaboratorDelete.mockResolvedValue({ id: "collab-other-project" });

      await removeProjectCollaborator("project-a", "collab-other-project");

      expect(mocks.projectCollaboratorDelete).toHaveBeenCalledWith({
        where: { id: "collab-other-project", projectId: "project-a" },
      });
    });

    it("does not expose all project tasks to a worker assigned to only one of them", async () => {
      mocks.auth.mockResolvedValue({ user: { id: "worker-a", role: UserRole.WORKER } });
      mocks.projectFindUnique.mockResolvedValue({
        id: "project-a",
        managerId: "manager-a",
        clientId: "client-a",
        studioId: "studio-a",
        collaborators: [],
        tasks: [{ assignees: [{ userId: "worker-a" }] }],
      });

      await expect(getProjectWorkspace("project-a")).rejects.toThrow(
        "You do not have permission to view this project."
      );
    });
  });

  describe("Taski 'To Edit' Revision Loop", () => {
    it("creates a revision record with REQUIREMENT_ADJUSTMENT and moves task to TO_EDIT", async () => {
      mocks.auth.mockResolvedValue({
        user: { id: "user-ama", name: "Ama", role: UserRole.CLIENT },
      });

      mocks.taskFindUnique.mockResolvedValue({
        id: "task-video-1",
        title: "Video Editing",
        projectId: "proj-1",
        status: TaskStatus.COMPLETED,
        project: {
          managerId: "mgr-1",
          clientId: "user-kojo",
          collaborators: [{ userId: "user-ama" }],
        },
        assignees: [{ userId: "worker-specialist" }],
      });

      const result = await requestTaskEdit({
        taskId: "task-video-1",
        cause: EditCause.REQUIREMENT_ADJUSTMENT,
        description: "Pacing in intro needs to be faster, adjust cuts around 0:15",
      });

      expect(result.success).toBe("Revision request submitted to the team.");
      expect(mocks.taskRevisionCreate).toHaveBeenCalledWith({
        data: {
          taskId: "task-video-1",
          cause: EditCause.REQUIREMENT_ADJUSTMENT,
          description: "Pacing in intro needs to be faster, adjust cuts around 0:15",
          requestedById: "user-ama",
        },
      });
      expect(mocks.taskUpdate).toHaveBeenCalledWith({
        where: { id: "task-video-1" },
        data: { status: TaskStatus.TO_EDIT, completedAt: null },
      });
      expect(mocks.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "worker-specialist",
          type: NotificationType.TASK_RETURNED,
        })
      );
    });

    it("supports DELIVERY_QUALITY_ISSUE edit cause with prompt notifications", async () => {
      mocks.auth.mockResolvedValue({
        user: { id: "user-kojo", name: "Kojo", role: UserRole.CLIENT },
      });

      mocks.taskFindUnique.mockResolvedValue({
        id: "task-totem",
        title: "Totem Display",
        projectId: "proj-1",
        status: TaskStatus.COMPLETED,
        project: {
          managerId: "mgr-1",
          clientId: "user-kojo",
          collaborators: [],
        },
        assignees: [{ userId: "worker-designer" }],
      });

      const result = await requestTaskEdit({
        taskId: "task-totem",
        cause: EditCause.DELIVERY_QUALITY_ISSUE,
        description: "Export resolution is pixelated on 4K digital screen.",
      });

      expect(result.success).toBe("Revision request submitted to the team.");
      expect(mocks.taskRevisionCreate).toHaveBeenCalledWith({
        data: {
          taskId: "task-totem",
          cause: EditCause.DELIVERY_QUALITY_ISSUE,
          description: "Export resolution is pixelated on 4K digital screen.",
          requestedById: "user-kojo",
        },
      });
    });
  });

  describe("Task 5-Star Satisfaction Rating", () => {
    it("allows clients to submit a 1 to 5 star rating for completed deliverables", async () => {
      mocks.auth.mockResolvedValue({
        user: { id: "user-ama", name: "Ama", role: UserRole.CLIENT },
      });

      mocks.taskFindUnique.mockResolvedValue({
        id: "task-video-1",
        title: "Video Best of",
        projectId: "proj-1",
        project: {
          managerId: "mgr-1",
          clientId: "user-kojo",
          collaborators: [{ userId: "user-ama" }],
        },
        assignees: [{ userId: "worker-specialist" }],
      });

      mocks.ratingUpsert.mockResolvedValue({
        id: "rating-1",
        score: 5,
        feedback: "Super clean color grade and audio mix!",
      });

      const result = await submitTaskRating({
        taskId: "task-video-1",
        score: 5,
        feedback: "Super clean color grade and audio mix!",
      });

      expect(result.success).toBe("Thank you for rating! (5 ★)");
      expect(mocks.ratingUpsert).toHaveBeenCalledWith({
        where: {
          clientId_taskId: {
            clientId: "user-ama",
            taskId: "task-video-1",
          },
        },
        create: {
          score: 5,
          feedback: "Super clean color grade and audio mix!",
          clientId: "user-ama",
          projectId: "proj-1",
          taskId: "task-video-1",
        },
        update: {
          score: 5,
          feedback: "Super clean color grade and audio mix!",
        },
      });
    });
  });

  describe("Task Deliverables & Discussion Comments", () => {
    it("records specialist output deliverables and notifies project clients", async () => {
      mocks.auth.mockResolvedValue({
        user: { id: "worker-specialist", name: "Specialist", role: UserRole.WORKER },
      });

      mocks.taskFindUnique.mockResolvedValue({
        id: "task-video-1",
        title: "Video Best of",
        projectId: "proj-1",
        project: {
          managerId: "mgr-1",
          clientId: "user-kojo",
          collaborators: [{ userId: "user-ama" }],
        },
      });

      const result = await uploadTaskDeliverable({
        taskId: "task-video-1",
        name: "final_cut_4k.mp4",
        fileUrl: "https://blob.wophoto.app/final_cut_4k.mp4",
        fileSize: 104857600,
        type: DeliverableType.OUTPUT,
      });

      expect(result.success).toBe("File uploaded successfully.");
      expect(mocks.deliverableCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: "task-video-1",
          name: "final_cut_4k.mp4",
          type: DeliverableType.OUTPUT,
          uploadedById: "worker-specialist",
        }),
      });
      // Check that both Kojo (primary) and Ama (collaborator) receive notifications
      expect(mocks.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-kojo",
          type: NotificationType.TASK_REVIEW_READY,
        })
      );
      expect(mocks.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-ama",
          type: NotificationType.TASK_REVIEW_READY,
        })
      );
    });

    it("posts comments visible to all project collaborators and managers", async () => {
      mocks.auth.mockResolvedValue({
        user: { id: "user-ama", name: "Ama", role: UserRole.CLIENT },
      });

      mocks.taskFindUnique.mockResolvedValue({
        id: "task-video-1",
        title: "Video Best of",
        projectId: "proj-1",
        project: {
          managerId: "mgr-1",
          clientId: "user-kojo",
          collaborators: [{ userId: "user-ama" }],
        },
        assignees: [{ userId: "worker-specialist" }],
      });

      const result = await addTaskComment({
        taskId: "task-video-1",
        body: "Can we check whether the drone shot at the start conforms to the brand palette?",
      });

      expect(result.success).toBe("Comment posted.");
      expect(mocks.commentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: "task-video-1",
          projectId: "proj-1",
          authorId: "user-ama",
          body: "Can we check whether the drone shot at the start conforms to the brand palette?",
        }),
      });
    });
  });
});
