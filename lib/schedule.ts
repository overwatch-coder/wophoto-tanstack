import "server-only";

import {
  Prisma,
  ScheduleEventType,
  TaskStatus,
  UserRole,
} from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { requireStudioArea } from "@/lib/studio-access";
import { StudioArea } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getScheduleEventsQuerySchema } from "@/lib/validation/schedule";

export interface ScheduleConflictWarning {
  type: "LOCATION" | "WORKER";
  conflictingEventId: string;
  conflictingEventTitle: string;
  entityName: string;
  message: string;
}

export const EXEMPT_LOCATIONS = [
  "On Location",
  "Remote / Client Site",
  "Remote",
  "Client Site",
];

export async function detectScheduleConflicts(
  db: Prisma.TransactionClient | typeof prisma,
  params: {
    startAt: Date;
    endAt: Date;
    location?: string | null;
    assigneeIds?: string[];
    excludeEventId?: string | null;
    studioId?: string;
  }
): Promise<ScheduleConflictWarning[]> {
  const { startAt, endAt, location, assigneeIds = [], excludeEventId, studioId } = params;
  const warnings: ScheduleConflictWarning[] = [];

  // Overlap condition: startAt < existing.endAt AND endAt > existing.startAt
  const timeOverlapCondition: Prisma.ScheduleEventWhereInput = {
    startAt: { lt: endAt },
    endAt: { gt: startAt },
    ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
    ...(studioId ? { studioId } : {}),
  };

  // 1. Location conflict check
  if (
    location &&
    location.trim() !== "" &&
    !EXEMPT_LOCATIONS.includes(location.trim())
  ) {
    const conflictingLocationEvents = await db.scheduleEvent.findMany({
      where: {
        ...timeOverlapCondition,
        location: { equals: location.trim(), mode: Prisma.QueryMode.insensitive },
      },
      select: {
        id: true,
        title: true,
        location: true,
        startAt: true,
        endAt: true,
      },
    });

    for (const event of conflictingLocationEvents) {
      warnings.push({
        type: "LOCATION",
        conflictingEventId: event.id,
        conflictingEventTitle: event.title,
        entityName: event.location || location,
        message: `Location "${event.location}" is already booked for "${event.title}".`,
      });
    }
  }

  // 2. Worker crew conflict check
  if (assigneeIds.length > 0) {
    const conflictingWorkerEvents = await db.scheduleEvent.findMany({
      where: {
        ...timeOverlapCondition,
        assignees: {
          some: {
            id: { in: assigneeIds },
          },
        },
      },
      select: {
        id: true,
        title: true,
        assignees: {
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, email: true },
        },
      },
    });

    for (const event of conflictingWorkerEvents) {
      for (const worker of event.assignees) {
        warnings.push({
          type: "WORKER",
          conflictingEventId: event.id,
          conflictingEventTitle: event.title,
          entityName: worker.name || worker.email,
          message: `Team member ${worker.name || worker.email} is already scheduled on "${event.title}".`,
        });
      }
    }
  }

  return warnings;
}

export async function getScheduleEvents(rawQuery: unknown) {
  const current = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
  const studio = current.role === UserRole.WORKER ? null : await requireStudioArea(StudioArea.SCHEDULE);
  const user = current.role === UserRole.WORKER ? current : { ...current, id: studio!.context.ownerUserId };
  const parsed = getScheduleEventsQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid schedule query.");
  }

  const { startDate, endDate, projectId, eventType } = parsed.data;

  // Range condition for events: event must intersect [startDate, endDate]
  const dateIntersectionWhere: Prisma.ScheduleEventWhereInput = {
    startAt: { lte: endDate },
    endAt: { gte: startDate },
  };

  const roleEventWhere: Prisma.ScheduleEventWhereInput =
    user.role !== UserRole.WORKER
      ? { studioId: studio!.context.studioId }
      : {
          OR: [
            { assignees: { some: { id: user.id } } },
            {
              eventType: {
                in: [
                  ScheduleEventType.STUDIO_BOOKING,
                  ScheduleEventType.MAINTENANCE,
                ],
              },
            },
            { assignees: { none: {} } },
          ],
        };

  const eventTypeFilter: Prisma.ScheduleEventWhereInput =
    eventType && Object.values(ScheduleEventType).includes(eventType as ScheduleEventType)
      ? { eventType: eventType as ScheduleEventType }
      : {};

  const projectFilter: Prisma.ScheduleEventWhereInput = projectId
    ? { projectId }
    : {};

  // 1. Fetch schedule events
  const events = await prisma.scheduleEvent.findMany({
    where: {
      ...dateIntersectionWhere,
      ...roleEventWhere,
      ...eventTypeFilter,
      ...projectFilter,
    },
    orderBy: { startAt: "asc" },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignees: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  // 2. Fetch task deadlines intersecting the window
  const taskWhere: Prisma.TaskWhereInput = {
    deletedAt: null,
    dueAt: { gte: startDate, lte: endDate },
    status: {
      in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW],
    },
    ...(user.role !== UserRole.WORKER
      ? { project: { studioId: studio!.context.studioId } }
      : { assignees: { some: { userId: user.id } } }),
    ...(projectId ? { projectId } : {}),
  };

  const tasks = await prisma.task.findMany({
    where: taskWhere,
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      title: true,
      dueAt: true,
      status: true,
      priority: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      assignees: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
  });

  const formattedTaskDeadlines = tasks
    .filter((t) => t.dueAt !== null)
    .map((task) => ({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt as Date,
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      projectName: task.project?.name || null,
      assignees: task.assignees.map((a) => a.user),
    }));

  return {
    events,
    taskDeadlines: formattedTaskDeadlines,
  };
}

export async function getScheduleEventById(id: string) {
  const current = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
  const studio = current.role === UserRole.WORKER ? null : await requireStudioArea(StudioArea.SCHEDULE);
  const user = current.role === UserRole.WORKER ? current : { ...current, id: studio!.context.ownerUserId };

  const event = await prisma.scheduleEvent.findFirst({
    where: { id, ...(user.role === UserRole.WORKER ? {} : { studioId: studio!.context.studioId }) },
    include: {
      project: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      assignees: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  if (!event) return null;

  // Authorization check for worker
  if (user.role === UserRole.WORKER) {
    const isAssigned = event.assignees.some((a) => a.id === user.id);
    const isGeneralBooking =
      event.eventType === ScheduleEventType.STUDIO_BOOKING ||
      event.eventType === ScheduleEventType.MAINTENANCE ||
      event.assignees.length === 0;

    if (!isAssigned && !isGeneralBooking) {
      return null;
    }
  }

  return event;
}
