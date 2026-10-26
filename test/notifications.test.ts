import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  findUniqueUserPreference: vi.fn(),
  findUniqueProject: vi.fn(),
  findUniqueStudio: vi.fn(),
  findFirstStudioMember: vi.fn(),
  createNotification: vi.fn(),
  findManyNotification: vi.fn(),
  findFirstNotification: vi.fn(),
  findUniqueNotification: vi.fn(),
  findManyTask: vi.fn(),
  countNotification: vi.fn(),
  updateManyNotification: vi.fn(),
  updateNotification: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUniqueUser,
    },
    userPreference: {
      findUnique: mocks.findUniqueUserPreference,
    },
    project: {
      findUnique: mocks.findUniqueProject,
    },
    studio: {
      findUnique: mocks.findUniqueStudio,
    },
    studioMember: {
      findFirst: mocks.findFirstStudioMember,
    },
    notification: {
      create: mocks.createNotification,
      findUnique: mocks.findUniqueNotification,
      findMany: mocks.findManyNotification,
      findFirst: mocks.findFirstNotification,
      count: mocks.countNotification,
      updateMany: mocks.updateManyNotification,
      update: mocks.updateNotification,
    },
    task: {
      findMany: mocks.findManyTask,
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendNotificationEmail: mocks.sendEmail,
}));

import {
  createNotification,
  createStudioAreaNotification,
  getNotificationPage,
  getLatestNotificationStreamCursor,
  getNotificationsAfter,
  createUpcomingDeadlineNotifications,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  registerSSEStream,
  broadcastToUser,
} from "@/lib/notifications";
import { NotificationCategory, NotificationType, StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/client";

describe("Notifications Service & Delivery Channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue({ success: true, status: "sent", messageId: "msg_123" });
    mocks.findUniqueUser.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === "usr_mgr"
        ? { id: "usr_mgr", email: "manager@example.com", name: "Manager", role: UserRole.MANAGER }
        : { id: where.id, email: "client@example.com", name: "Elena", role: where.id === "usr_worker" ? UserRole.WORKER : UserRole.CLIENT })
    );
    mocks.findUniqueUserPreference.mockResolvedValue(null);
    mocks.findUniqueProject.mockResolvedValue({ id: "proj_1", name: "Aura Lookbook" });
    mocks.findUniqueStudio.mockResolvedValue(null);
    mocks.findFirstStudioMember.mockResolvedValue(null);
    mocks.findUniqueNotification.mockResolvedValue(null);
    mocks.updateNotification.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "notif_1",
      type: NotificationType.FEEDBACK_RECEIVED,
      category: NotificationCategory.ACTION_REQUIRED,
      title: "New Client Revision Request",
      message: "Please adjust contrast on scene 2",
      link: "/manager/reviews",
      read: false,
      createdAt: new Date(),
      actor: { id: "act_1", name: "Elena", role: UserRole.CLIENT, image: null },
      project: { id: "proj_1", name: "Aura Lookbook" },
      task: null,
      ...data,
    }));
  });

  it("routes studio work notifications only to members with area view access", async () => {
    const roles: Record<string, UserRole> = {
      owner: UserRole.MANAGER,
      supervisor: UserRole.SUPERVISOR,
      projectViewer: UserRole.COLLABORATOR,
      unrelatedCollaborator: UserRole.COLLABORATOR,
    };
    mocks.findUniqueStudio.mockResolvedValue({
      ownerUserId: "owner",
      members: [
        { userId: "supervisor", user: { role: UserRole.SUPERVISOR } },
        { userId: "projectViewer", user: { role: UserRole.COLLABORATOR } },
        { userId: "unrelatedCollaborator", user: { role: UserRole.COLLABORATOR } },
      ],
    });
    mocks.findFirstStudioMember.mockImplementation(({ where }: { where: { userId: string } }) => {
      const permissions = where.userId === "projectViewer"
        ? [{ area: StudioArea.PROJECTS, accessLevel: StudioAccessLevel.VIEW }]
        : [];
      return Promise.resolve({
        id: `member-${where.userId}`,
        studio: { id: "studio-1", ownerUserId: "owner" },
        permissions,
      });
    });
    mocks.findUniqueUser.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve({
      id: where.id,
      email: `${where.id}@example.invalid`,
      name: where.id,
      role: roles[where.id],
    }));
    const notified: string[] = [];
    mocks.createNotification.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      notified.push(data.userId as string);
      return { id: `notif-${notified.length}`, ...data, actor: null, project: null, task: null, createdAt: new Date() };
    });

    await createStudioAreaNotification("studio-1", StudioArea.PROJECTS, {
      type: NotificationType.SYSTEM_ALERT,
      title: "Project changed",
      message: "A project was updated.",
      sendEmail: false,
    });

    expect(notified.sort()).toEqual(["owner", "projectViewer", "supervisor"]);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  describe("Delivery Channel Rules (Email vs In-App)", () => {
    it("dispatches email and in-app notification for FEEDBACK_RECEIVED", async () => {
      mocks.createNotification.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "notif_1",
        ...data,
        createdAt: new Date(),
        actor: { id: "act_1", name: "Elena", role: UserRole.CLIENT, image: null },
        project: { id: "proj_1", name: "Aura Lookbook" },
        task: null,
      }));

      await createNotification({
        userId: "usr_mgr",
        actorId: "usr_client",
        type: NotificationType.FEEDBACK_RECEIVED,
        title: "New Client Revision Request",
        message: "Please adjust contrast on scene 2",
        link: "/manager/reviews",
        projectId: "proj_1",
      });

      // Email was sent
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "manager@example.com",
          title: "New Client Revision Request",
        })
      );

      // The record starts pending, then stores the provider result as sent.
      expect(mocks.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "usr_mgr",
            type: NotificationType.FEEDBACK_RECEIVED,
            category: NotificationCategory.ACTION_REQUIRED,
            emailSent: false,
            emailStatus: "PENDING",
          }),
        })
      );
      expect(mocks.updateNotification).toHaveBeenCalledWith(expect.objectContaining({
        data: { emailSent: true, emailStatus: "SENT" },
      }));
    });

    it("creates in-app only notification for TASK_APPROVED without sending email", async () => {
      mocks.createNotification.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "notif_2",
        ...data,
        createdAt: new Date(),
        actor: null,
        project: null,
        task: null,
      }));

      await createNotification({
        userId: "usr_worker",
        type: NotificationType.TASK_APPROVED,
        title: "Task Approved",
        message: "Manager approved your retouches",
        link: "/worker/tasks",
      });

      // Email was NOT sent for ambient task approval
      expect(mocks.sendEmail).not.toHaveBeenCalled();

      // Created with UPDATE category and emailSent: false
      expect(mocks.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "usr_worker",
            type: NotificationType.TASK_APPROVED,
            category: NotificationCategory.UPDATE,
            emailSent: false,
          }),
        })
      );
    });

    it("creates system alert notification with SYSTEM category", async () => {
      mocks.createNotification.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "notif_3",
        ...data,
        createdAt: new Date(),
        actor: null,
        project: null,
        task: null,
      }));

      await createNotification({
        userId: "usr_mgr",
        type: NotificationType.SYSTEM_ALERT,
        title: "Vault Purge Warning",
        message: "3 tasks will be purged in 48h",
      });

      expect(mocks.sendEmail).not.toHaveBeenCalled();
      expect(mocks.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.SYSTEM_ALERT,
            category: NotificationCategory.SYSTEM,
            emailSent: false,
          }),
        })
      );
    });

    it("honors a saved choice to hide a notification and suppress email", async () => {
      mocks.findUniqueUserPreference.mockResolvedValue({
        notificationChannels: {
          FEEDBACK_RECEIVED: { inApp: false, email: false },
        },
      });
      mocks.createNotification.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "notif_hidden",
        ...data,
        createdAt: new Date(),
        actor: null,
        project: null,
        task: null,
      }));
      const enqueue = vi.fn();
      const unregister = registerSSEStream("usr_mgr", { enqueue } as unknown as ReadableStreamDefaultController<Uint8Array>);

      try {
        await createNotification({
          userId: "usr_mgr",
          type: NotificationType.FEEDBACK_RECEIVED,
          title: "New client feedback",
          message: "A review was submitted.",
        });
      } finally {
        unregister();
      }

      expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ inAppVisible: false, emailStatus: "NOT_REQUESTED" }),
      }));
      expect(mocks.sendEmail).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    });

    it("sends email for an event when that channel is explicitly enabled", async () => {
      mocks.findUniqueUserPreference.mockResolvedValue({
        notificationChannels: {
          TASK_APPROVED: { inApp: true, email: true },
        },
      });
      mocks.createNotification.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "notif_email_override",
        ...data,
        createdAt: new Date(),
        actor: null,
        project: null,
        task: null,
      }));

      await createNotification({
        userId: "usr_worker",
        type: NotificationType.TASK_APPROVED,
        title: "Task approved",
        message: "Your work was approved.",
      });

      expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: "client@example.com",
        title: "Task approved",
      }));
      expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ emailStatus: "PENDING", inAppVisible: true }),
      }));
    });
  });

  describe("Notification Query & Mark as Read", () => {
    it("fetches notifications list and counts unread", async () => {
      mocks.findManyNotification.mockResolvedValue([
        {
          id: "n1",
          type: NotificationType.FEEDBACK_RECEIVED,
          category: NotificationCategory.ACTION_REQUIRED,
          title: "Test",
          message: "Test message",
          link: "/manager/reviews",
          read: false,
          emailSent: true,
          emailStatus: "SENT",
          emailSubject: "Sub",
          createdAt: new Date("2026-10-24T10:00:00Z"),
          actor: { id: "a1", name: "David", role: UserRole.CLIENT, image: null },
          project: { id: "p1", name: "Wedding" },
          task: null,
        },
      ]);
      mocks.countNotification.mockResolvedValue(1);

      const items = await getNotifications("usr_1");
      const unreadCount = await getUnreadNotificationCount("usr_1");

      expect(items).toHaveLength(1);
      expect(items[0].channels.email).toBe(true);
      expect(unreadCount).toBe(1);
    });

    it("marks single notification as read", async () => {
      mocks.updateManyNotification.mockResolvedValue({ count: 1 });
      mocks.countNotification.mockResolvedValue(0);

      await markNotificationRead("n1", "usr_1");

      expect(mocks.updateManyNotification).toHaveBeenCalledWith({
          where: { id: "n1", userId: "usr_1", inAppVisible: true },
        data: { read: true },
      });
    });

    it("broadcasts the read state only to that notification recipient", async () => {
      mocks.updateManyNotification.mockResolvedValue({ count: 1 });
      mocks.countNotification.mockResolvedValue(0);
      const recipientEvents: string[] = [];
      const otherUserEvents: string[] = [];
      const makeController = (events: string[]) => ({
        enqueue: (chunk: Uint8Array) => events.push(new TextDecoder().decode(chunk)),
      }) as unknown as ReadableStreamDefaultController<Uint8Array>;
      const unregisterRecipient = registerSSEStream("usr_1", makeController(recipientEvents));
      const unregisterOther = registerSSEStream("usr_2", makeController(otherUserEvents));

      try {
        await markNotificationRead("n1", "usr_1");
      } finally {
        unregisterRecipient();
        unregisterOther();
      }

      expect(recipientEvents.join("")).toContain('"event":"NOTIFICATION_READ","notificationId":"n1"');
      expect(otherUserEvents).toHaveLength(0);
    });

    it("marks all notifications as read for a user", async () => {
      mocks.updateManyNotification.mockResolvedValue({ count: 5 });

      await markAllNotificationsRead("usr_1");

      expect(mocks.updateManyNotification).toHaveBeenCalledWith({
        where: { userId: "usr_1", inAppVisible: true, read: false },
        data: { read: true },
      });
    });
  });

  it("loads a bounded cursor page and applies server-side search filters", async () => {
    const record = (id: string) => ({
      id,
      type: NotificationType.FEEDBACK_RECEIVED,
      category: NotificationCategory.ACTION_REQUIRED,
      title: "Wedding edit",
      message: "Review these photos",
      link: "/manager/reviews",
      read: false,
      emailSent: false,
      emailStatus: "NOT_REQUESTED",
      emailSubject: null,
      createdAt: new Date("2026-10-24T10:00:00Z"),
      actor: null,
      project: { id: "p1", name: "Wedding" },
      task: null,
    });
    mocks.findManyNotification.mockResolvedValue([record("n1"), record("n2"), record("n3")]);

    const page = await getNotificationPage("usr_1", {
      limit: 2,
      cursor: "n0",
      query: "wedding",
      filterMode: "UNREAD",
    });

    expect(mocks.findManyNotification).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "usr_1",
        inAppVisible: true,
        read: false,
        OR: expect.arrayContaining([
          expect.objectContaining({ title: { contains: "wedding", mode: "insensitive" } }),
        ]),
      }),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
      cursor: { id: "n0" },
      skip: 1,
    }));
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("n2");
  });

  it("polls only notifications newer than the SSE cursor with a bounded batch", async () => {
    const createdAt = new Date("2026-10-24T10:00:00Z");
    mocks.findFirstNotification.mockResolvedValue({ id: "n1", createdAt });
    mocks.findManyNotification.mockResolvedValue([]);

    const cursor = await getLatestNotificationStreamCursor("usr_1");
    await getNotificationsAfter("usr_1", cursor);

    expect(mocks.findFirstNotification).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "usr_1", inAppVisible: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }));
    expect(mocks.findManyNotification).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "usr_1",
        inAppVisible: true,
        OR: [
          { createdAt: { gt: createdAt } },
          { createdAt, id: { gt: "n1" } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 50,
    }));
  });

  it("broadcasts the same normalized notification fields as the initial page query", async () => {
    mocks.createNotification.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "live_1",
      ...data,
      read: false,
      emailSent: false,
      emailStatus: "NOT_REQUESTED",
      emailSubject: null,
      createdAt: new Date("2026-10-24T10:00:00Z"),
      actor: null,
      project: null,
      task: null,
    }));
    const enqueue = vi.fn();
    const unregister = registerSSEStream("usr_live", { enqueue } as unknown as ReadableStreamDefaultController<Uint8Array>);

    await createNotification({
      userId: "usr_live",
      type: NotificationType.TASK_APPROVED,
      title: "Task approved",
      message: "The task is complete",
    });

    const payload = JSON.parse(new TextDecoder().decode(enqueue.mock.calls[0][0]).replace(/^data: /, ""));
    expect(payload.notification.channels).toEqual(expect.objectContaining({
      inApp: true,
      email: false,
      emailStatus: "NOT_REQUESTED",
    }));
    expect(payload.notification.actor.name).toBe("Studio System");
    unregister();
  });

  it("creates one deduplicated deadline notice for each manager and active assignee", async () => {
    const dueAt = new Date("2026-10-24T20:00:00Z");
    mocks.findManyTask.mockResolvedValue([{
      id: "task_1",
      title: "Album retouch",
      dueAt,
      projectId: "proj_1",
      project: { name: "Aura Lookbook", managerId: "usr_mgr" },
      assignees: [{ userId: "usr_worker" }],
    }]);
    mocks.createNotification.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `notification-${data.userId}`,
      ...data,
      read: false,
      createdAt: new Date(),
      actor: null,
      project: { id: "proj_1", name: "Aura Lookbook" },
      task: { id: "task_1", title: "Album retouch" },
    }));

    const result = await createUpcomingDeadlineNotifications(new Date("2026-10-24T10:00:00Z"));

    expect(result).toEqual({ tasksChecked: 1, notificationsCreated: 2 });
    expect(mocks.createNotification).toHaveBeenCalledTimes(2);
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "usr_mgr",
        type: NotificationType.DEADLINE_APPROACHING,
        dedupeKey: `deadline:task_1:${dueAt.getTime()}:usr_mgr`,
      }),
    }));
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "usr_worker",
        type: NotificationType.DEADLINE_APPROACHING,
        dedupeKey: `deadline:task_1:${dueAt.getTime()}:usr_worker`,
      }),
    }));
  });

  describe("Real-Time SSE Stream Broadcast", () => {
    it("pushes event data to registered controllers", () => {
      const enqueueMock = vi.fn();
      const controller = {
        enqueue: enqueueMock,
      } as unknown as ReadableStreamDefaultController<Uint8Array>;

      const unregister = registerSSEStream("usr_stream_test", controller);

      broadcastToUser("usr_stream_test", {
        event: "TEST_EVENT",
        message: "Hello live stream",
      });

      expect(enqueueMock).toHaveBeenCalled();
      const calledArg = enqueueMock.mock.calls[0][0];
      const decoded = new TextDecoder().decode(calledArg);
      expect(decoded).toContain("TEST_EVENT");
      expect(decoded).toContain("Hello live stream");

      // Clean up
      unregister();
    });
  });
});
