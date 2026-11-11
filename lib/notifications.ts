
import {
  Prisma,
  NotificationCategory,
  NotificationEmailStatus,
  TaskStatus,
  NotificationType,
  UserRole,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/email";
import { notificationActionLink } from "@/lib/notification-links";
import { DEFAULT_EMAIL_NOTIFICATION_TYPES } from "@/lib/settings-preferences";
import { getUserPreferences } from "@/lib/user-preferences";
import { StudioAccessLevel, StudioArea } from "@/generated/prisma/client";
import { getStudioAccessContext, hasStudioAccess } from "@/lib/studio-access";

// In-memory registry of active SSE stream controllers per user
type SSEController = ReadableStreamDefaultController<Uint8Array>;
const activeUserStreams = new Map<string, Set<SSEController>>();

export function registerSSEStream(userId: string, controller: SSEController) {
  if (!activeUserStreams.has(userId)) {
    activeUserStreams.set(userId, new Set());
  }
  activeUserStreams.get(userId)!.add(controller);

  return () => {
    const set = activeUserStreams.get(userId);
    if (set) {
      set.delete(controller);
      if (set.size === 0) {
        activeUserStreams.delete(userId);
      }
    }
  };
}

export function broadcastToUser(userId: string, event: Record<string, unknown>) {
  const set = activeUserStreams.get(userId);
  if (!set || set.size === 0) return;

  const payload = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
  for (const controller of set) {
    try {
      controller.enqueue(payload);
    } catch {
      // Controller may be closed or in error state
      set.delete(controller);
    }
  }
}

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  category?: NotificationCategory;
  title: string;
  message: string;
  link?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  actorId?: string | null;
  sendEmail?: boolean;
  /** Persist a stream cursor update without adding a visible bell notification. */
  refreshOnly?: boolean;
  emailSubject?: string | null;
  dedupeKey?: string | null;
};

export type NotificationFilterMode = "ALL" | "UNREAD" | "ACTION_REQUIRED";

export type NotificationPageOptions = {
  limit?: number;
  cursor?: string | null;
  query?: string;
  filterMode?: NotificationFilterMode;
};

const notificationRelations = {
  actor: { select: { id: true, name: true, role: true, image: true } },
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
} as const;

function notificationToView(n: {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  inAppVisible: boolean;
  emailSent: boolean;
  emailStatus: NotificationEmailStatus;
  emailSubject: string | null;
  createdAt: Date;
  actor: { id: string; name: string | null; role: UserRole; image: string | null } | null;
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
}) {
  return {
    id: n.id,
    type: n.type,
    category: n.category,
    title: n.title,
    message: n.message,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    projectName: n.project?.name,
    taskTitle: n.task?.title,
    actor: {
      name: n.actor?.name ?? "Studio System",
      role: n.actor?.role ?? UserRole.MANAGER,
      image: n.actor?.image ?? null,
    },
    channels: {
      inApp: n.inAppVisible,
      email: n.emailStatus === NotificationEmailStatus.SENT && n.emailSent,
      emailStatus: n.emailStatus,
      emailSubject: n.emailSubject ?? undefined,
    },
  };
}

export async function createNotification(input: CreateNotificationInput) {
  // Default category
  const category =
    input.category ||
    (input.type === NotificationType.SYSTEM_ALERT
      ? NotificationCategory.SYSTEM
      : ([
          NotificationType.FEEDBACK_RECEIVED,
          NotificationType.REVISION_DELEGATED,
          NotificationType.REVISION_SUBMITTED,
          NotificationType.TASK_REVIEW_READY,
          NotificationType.TASK_RETURNED,
          NotificationType.DEADLINE_APPROACHING,
        ] as NotificationType[]).includes(input.type)
      ? NotificationCategory.ACTION_REQUIRED
      : NotificationCategory.UPDATE);

  // Fetch recipient & project/actor details if email needed
  let recipientEmail: string | null = null;
  let actorName: string | null = null;
  let projectName: string | null = null;

  const [recipient, actor, project] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true, role: true },
    }),
    input.actorId
      ? prisma.user.findUnique({
          where: { id: input.actorId },
          select: { name: true },
        })
      : null,
    input.projectId
      ? prisma.project.findUnique({
          where: { id: input.projectId },
          select: { name: true },
        })
      : null,
  ]);

  const preferences = recipient
    ? await getUserPreferences(input.userId, recipient.role, { resolveCopilotName: false })
    : null;
  const channels = preferences?.notificationChannels[input.type];
  const showInApp = input.refreshOnly ? false : channels?.inApp ?? true;
  const shouldSendEmail = input.sendEmail === false
    ? false
    : channels?.email ?? DEFAULT_EMAIL_NOTIFICATION_TYPES.includes(input.type);

  if (recipient) recipientEmail = recipient.email;
  if (actor) actorName = actor.name;
  if (project) projectName = project.name;

  let emailStatus: NotificationEmailStatus = shouldSendEmail
    ? NotificationEmailStatus.PENDING
    : NotificationEmailStatus.NOT_REQUESTED;
  let emailSent = false;
  const subject = input.emailSubject || input.title;

  let created;
  try {
    created = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      category,
      title: input.title,
      message: input.message,
      link: input.link,
      inAppVisible: showInApp,
      projectId: input.projectId,
      taskId: input.taskId,
      actorId: input.actorId,
      emailSent,
      emailStatus,
      emailSubject: shouldSendEmail ? subject : null,
      dedupeKey: input.dedupeKey ?? null,
    },
    include: notificationRelations,
    });
  } catch (error) {
    if (
      input.dedupeKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.notification.findUnique({
        where: { dedupeKey: input.dedupeKey },
        include: notificationRelations,
      });
      if (existing) return existing;
    }
    throw error;
  }

  let notification = created;
  if (shouldSendEmail) {
    if (!recipientEmail) {
      emailStatus = NotificationEmailStatus.FAILED;
    } else {
      try {
        const emailResult = await sendNotificationEmail({
          to: recipientEmail,
          subject,
          title: input.title,
          message: input.message,
          link: input.link,
          projectName,
          actorName,
        });
        emailSent = emailResult.status === "sent";
        emailStatus = emailResult.status === "sent"
          ? NotificationEmailStatus.SENT
          : emailResult.status === "preview"
            ? NotificationEmailStatus.PREVIEW
            : NotificationEmailStatus.FAILED;
      } catch (err) {
        emailStatus = NotificationEmailStatus.FAILED;
        console.warn("[notifications] Failed to send email:", err);
      }
    }
    notification = await prisma.notification.update({
      where: { id: created.id },
      data: { emailSent, emailStatus },
      include: notificationRelations,
    });
  }

  if (showInApp) {
    broadcastToUser(input.userId, {
      event: "NEW_NOTIFICATION",
      notification: notificationToView(notification),
    });
  } else if (input.refreshOnly) {
    broadcastToUser(input.userId, { event: "DATA_CHANGED", id: notification.id });
  }

  return notification;
}

export async function createStudioAreaNotification(
  studioId: string,
  area: StudioArea,
  input: Omit<CreateNotificationInput, "userId">,
) {
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { ownerUserId: true, members: { where: { revokedAt: null }, select: { userId: true, user: { select: { role: true } } } } },
  });
  if (!studio) return;
  const userIds = [studio.ownerUserId];
  for (const member of studio.members) {
    const context = await getStudioAccessContext(member.userId, member.user.role);
    if (context && hasStudioAccess(context, area, StudioAccessLevel.VIEW)) userIds.push(member.userId);
  }
  await Promise.all([...new Set(userIds)].map((userId) => createNotification({ ...input, userId })));
}

export async function getNotificationPage(
  userId: string,
  options: NotificationPageOptions = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? 20, 50));
  const query = options.query?.trim();
  const where = {
    userId,
    inAppVisible: true,
    ...(options.filterMode === "UNREAD" ? { read: false } : {}),
    ...(options.filterMode === "ACTION_REQUIRED"
      ? { category: NotificationCategory.ACTION_REQUIRED }
      : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { message: { contains: query, mode: "insensitive" as const } },
            { project: { is: { name: { contains: query, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: notificationRelations,
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = pageRows.map(notificationToView);
  return {
    items,
    hasMore,
    nextCursor: hasMore ? pageRows.at(-1)?.id ?? null : null,
  };
}

export async function getNotifications(userId: string, limit = 6) {
  const page = await getNotificationPage(userId, { limit });
  return page.items;
}

export type NotificationStreamCursor = {
  createdAt: Date;
  id: string;
};

export async function getLatestNotificationStreamCursor(
  userId: string,
): Promise<NotificationStreamCursor | null> {
  return prisma.notification.findFirst({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true, id: true },
  });
}

export async function getNotificationsAfter(
  userId: string,
  cursor: NotificationStreamCursor | null,
) {
  const rows = await prisma.notification.findMany({
    where: {
      userId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50,
    include: notificationRelations,
  });
  const last = rows.at(-1);
  return {
    items: rows.filter((row) => row.inAppVisible).map(notificationToView),
    dataChangedIds: rows.filter((row) => !row.inAppVisible).map((row) => row.id),
    nextCursor: last ? { createdAt: last.createdAt, id: last.id } : cursor,
  };
}

export async function getNotificationCounts(userId: string) {
  const [all, unread, actionRequired, emailSent, unreadActionRequired, unreadUpdates] = await Promise.all([
    prisma.notification.count({ where: { userId, inAppVisible: true } }),
    prisma.notification.count({ where: { userId, inAppVisible: true, read: false } }),
    prisma.notification.count({
      where: { userId, inAppVisible: true, category: NotificationCategory.ACTION_REQUIRED },
    }),
    prisma.notification.count({ where: { userId, emailSent: true, emailStatus: NotificationEmailStatus.SENT } }),
    prisma.notification.count({ where: { userId, inAppVisible: true, read: false, category: NotificationCategory.ACTION_REQUIRED } }),
    prisma.notification.count({ where: { userId, inAppVisible: true, read: false, category: NotificationCategory.UPDATE } }),
  ]);
  return { all, unread, actionRequired, emailSent, unreadActionRequired, unreadUpdates };
}

export async function createUpcomingDeadlineNotifications(now = new Date()) {
  const deadlineLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dueTasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { not: TaskStatus.COMPLETED },
      dueAt: { gt: now, lte: deadlineLimit },
    },
    select: {
      id: true,
      title: true,
      dueAt: true,
      projectId: true,
      project: { select: { name: true, managerId: true } },
      assignees: {
        where: { status: { not: TaskStatus.COMPLETED } },
        select: { userId: true },
      },
    },
  });

  let created = 0;
  for (const task of dueTasks) {
    const recipientIds = new Set([
      ...(task.project.managerId ? [task.project.managerId] : []),
      ...task.assignees.map((assignee) => assignee.userId),
    ]);
    for (const userId of recipientIds) {
      const existing = await prisma.notification.findUnique({
        where: {
          dedupeKey: `deadline:${task.id}:${task.dueAt?.getTime() ?? "none"}:${userId}`,
        },
        select: { id: true },
      });
      if (existing) continue;
      await createNotification({
        userId,
        type: NotificationType.DEADLINE_APPROACHING,
        category: NotificationCategory.ACTION_REQUIRED,
        title: "Task due within 24 hours",
        message: `“${task.title}” for ${task.project.name} is due ${task.dueAt?.toLocaleString() ?? "within 24 hours"}.`,
        link: notificationActionLink({
          kind: "task",
          role: userId === task.project.managerId ? "MANAGER" : "WORKER",
          id: task.id,
        }),
        projectId: task.projectId,
        taskId: task.id,
        dedupeKey: `deadline:${task.id}:${task.dueAt?.getTime() ?? "none"}:${userId}`,
        emailSubject: `Deadline approaching: ${task.title}`,
      });
      created += 1;
    }
  }
  return { tasksChecked: dueTasks.length, notificationsCreated: created };
}

export type NotificationItemView = Awaited<ReturnType<typeof getNotifications>>[number];

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      inAppVisible: true,
      read: false,
    },
  });
}

export async function getUnreadNotificationCounts(userId: string) {
  const [unread, actionRequired, updates] = await Promise.all([
    getUnreadNotificationCount(userId),
    prisma.notification.count({
      where: { userId, inAppVisible: true, read: false, category: NotificationCategory.ACTION_REQUIRED },
    }),
    prisma.notification.count({
      where: { userId, inAppVisible: true, read: false, category: NotificationCategory.UPDATE },
    }),
  ]);
  return { unread, actionRequired, updates };
}

export async function markNotificationRead(id: string, userId: string) {
  const updated = await prisma.notification.updateMany({
    where: { id, userId, inAppVisible: true },
    data: { read: true },
  });

  if (updated.count > 0) {
    broadcastToUser(userId, {
      event: "NOTIFICATION_READ",
      notificationId: id,
    });
  }

  // Broadcast updated unread count to user's devices
  const counts = await getUnreadNotificationCounts(userId);
  broadcastToUser(userId, {
    event: "UNREAD_COUNTS",
    ...counts,
  });

  return updated;
}

export async function markAllNotificationsRead(userId: string) {
  const updated = await prisma.notification.updateMany({
    where: { userId, inAppVisible: true, read: false },
    data: { read: true },
  });

  broadcastToUser(userId, { event: "ALL_NOTIFICATIONS_READ" });

  // Broadcast zero unread counts
  broadcastToUser(userId, {
    event: "UNREAD_COUNTS",
    unread: 0,
    actionRequired: 0,
    updates: 0,
  });

  return updated;
}
