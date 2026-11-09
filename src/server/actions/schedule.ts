import { createServerFn } from "@tanstack/react-start";
import { decodeActionArguments, encodeActionArguments, type EncodedActionArguments } from "@/lib/server-action-args";

import { StudioArea } from "@/generated/prisma/client";
import { requireStudioManagerArea } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import {
  detectScheduleConflicts,
  type ScheduleConflictWarning,
} from "@/lib/schedule";
import {
  createScheduleEventSchema,
  updateScheduleEventSchema,
  deleteScheduleEventSchema,
  checkScheduleConflictsSchema,
} from "@/lib/validation/schedule";

export type ScheduleActionState = {
  error?: string;
  success?: string;
  eventId?: string;
  warnings?: ScheduleConflictWarning[];
};

function revalidateSchedule() {
  // TanStack Router invalidates route queries on navigation/mutation
}

function normalizeAllDayBounds(startAt: Date, endAt: Date, allDay: boolean) {
  if (!allDay) return { startAt, endAt };

  const startUtc = new Date(
    Date.UTC(
      startAt.getUTCFullYear(),
      startAt.getUTCMonth(),
      startAt.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  const endUtc = new Date(
    Date.UTC(
      endAt.getUTCFullYear(),
      endAt.getUTCMonth(),
      endAt.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  return { startAt: startUtc, endAt: endUtc };
}

async function checkScheduleConflictsServerImplementation(
  data: unknown
): Promise<{ error?: string; conflicts: ScheduleConflictWarning[] }> {
  try {
    const { context } = await requireStudioManagerArea(StudioArea.SCHEDULE);

    const parsed = checkScheduleConflictsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid conflict check parameters.",
        conflicts: [],
      };
    }

    const { startAt, endAt, location, assigneeIds, excludeEventId } = parsed.data;

    const conflicts = await detectScheduleConflicts(prisma, {
      startAt,
      endAt,
      location,
      assigneeIds,
      studioId: context.studioId,
      excludeEventId,
    });

    return { conflicts };
  } catch (error) {
    console.error("checkScheduleConflicts error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to check schedule conflicts.",
      conflicts: [],
    };
  }
}

async function createScheduleEventServerImplementation(
  data: unknown
): Promise<ScheduleActionState> {
  try {
    const { actor, context } = await requireStudioManagerArea(StudioArea.SCHEDULE);

    const parsed = createScheduleEventSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." };
    }

    const {
      title,
      description,
      eventType,
      startAt: rawStart,
      endAt: rawEnd,
      allDay,
      location,
      projectId,
      assigneeIds,
    } = parsed.data;

    const { startAt, endAt } = normalizeAllDayBounds(rawStart, rawEnd, allDay);

    // Validate project existence if provided
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, studioId: context.studioId },
        select: { id: true },
      });
      if (!project) {
        return { error: "Specified project does not exist." };
      }
    }

    // Check for soft conflicts
    const warnings = await detectScheduleConflicts(prisma, {
      startAt,
      endAt,
      location,
      assigneeIds,
    });

    const event = await prisma.scheduleEvent.create({
      data: {
        title,
        description,
        eventType,
        startAt,
        endAt,
        allDay,
        location,
        projectId: projectId || null,
        studioId: context.studioId,
      createdById: actor.id,
        assignees: assigneeIds && assigneeIds.length > 0
          ? { connect: assigneeIds.map((id) => ({ id })) }
          : undefined,
      },
    });

    revalidateSchedule();

    return {
      success: `Event "${event.title}" scheduled successfully.`,
      eventId: event.id,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error("createScheduleEvent error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create schedule event.",
    };
  }
}

async function updateScheduleEventServerImplementation(
  data: unknown
): Promise<ScheduleActionState> {
  try {
    const { context } = await requireStudioManagerArea(StudioArea.SCHEDULE);

    const parsed = updateScheduleEventSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." };
    }

    const {
      id,
      title,
      description,
      eventType,
      startAt: rawStart,
      endAt: rawEnd,
      allDay,
      location,
      projectId,
      assigneeIds,
    } = parsed.data;

    const existing = await prisma.scheduleEvent.findFirst({
      where: { id, studioId: context.studioId },
      include: { assignees: { select: { id: true } } },
    });

    if (!existing) {
      return { error: "Schedule event not found." };
    }

    const effectiveAllDay = allDay !== undefined ? allDay : existing.allDay;
    const effectiveStart = rawStart || existing.startAt;
    const effectiveEnd = rawEnd || existing.endAt;

    if (effectiveEnd.getTime() < effectiveStart.getTime()) {
      return { error: "End time must be equal to or later than start time." };
    }

    const { startAt, endAt } = normalizeAllDayBounds(
      effectiveStart,
      effectiveEnd,
      effectiveAllDay
    );

    const effectiveLocation = location !== undefined ? location : existing.location;
    const effectiveAssignees =
      assigneeIds !== undefined
        ? assigneeIds
        : existing.assignees.map((a) => a.id);

    // Validate project existence if changed
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, studioId: context.studioId },
        select: { id: true },
      });
      if (!project) {
        return { error: "Specified project does not exist." };
      }
    }

    // Check soft conflicts excluding current event
    const warnings = await detectScheduleConflicts(prisma, {
      startAt,
      endAt,
      location: effectiveLocation,
      assigneeIds: effectiveAssignees,
      excludeEventId: id,
      studioId: context.studioId,
    });

    const updated = await prisma.scheduleEvent.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(eventType !== undefined ? { eventType } : {}),
        startAt,
        endAt,
        allDay: effectiveAllDay,
        ...(location !== undefined ? { location } : {}),
        ...(projectId !== undefined ? { projectId } : {}),
        ...(assigneeIds !== undefined
          ? {
              assignees: {
                set: assigneeIds.map((assigneeId) => ({ id: assigneeId })),
              },
            }
          : {}),
      },
    });

    revalidateSchedule();

    return {
      success: `Event "${updated.title}" updated successfully.`,
      eventId: updated.id,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error("updateScheduleEvent error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update schedule event.",
    };
  }
}

async function deleteScheduleEventServerImplementation(
  data: unknown
): Promise<ScheduleActionState> {
  try {
    const { context } = await requireStudioManagerArea(StudioArea.SCHEDULE);

    const parsed = deleteScheduleEventSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." };
    }

    const { id } = parsed.data;

    const existing = await prisma.scheduleEvent.findFirst({
      where: { id, studioId: context.studioId },
      select: { id: true, title: true },
    });

    if (!existing) {
      return { error: "Schedule event not found." };
    }

    await prisma.scheduleEvent.delete({ where: { id } });

    revalidateSchedule();

    return {
      success: `Event "${existing.title}" deleted successfully.`,
      eventId: id,
    };
  } catch (error) {
    console.error("deleteScheduleEvent error:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete schedule event.",
    };
  }
}


const checkScheduleConflictsServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof checkScheduleConflictsServerImplementation>>) => args)
  .handler(async ({ data }) => checkScheduleConflictsServerImplementation(...decodeActionArguments<Parameters<typeof checkScheduleConflictsServerImplementation>>(data)));
export const checkScheduleConflicts = async (...args: Parameters<typeof checkScheduleConflictsServerImplementation>) => checkScheduleConflictsServerFunction({ data: await encodeActionArguments(args) });

const createScheduleEventServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof createScheduleEventServerImplementation>>) => args)
  .handler(async ({ data }) => createScheduleEventServerImplementation(...decodeActionArguments<Parameters<typeof createScheduleEventServerImplementation>>(data)));
export const createScheduleEvent = async (...args: Parameters<typeof createScheduleEventServerImplementation>) => createScheduleEventServerFunction({ data: await encodeActionArguments(args) });

const updateScheduleEventServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateScheduleEventServerImplementation>>) => args)
  .handler(async ({ data }) => updateScheduleEventServerImplementation(...decodeActionArguments<Parameters<typeof updateScheduleEventServerImplementation>>(data)));
export const updateScheduleEvent = async (...args: Parameters<typeof updateScheduleEventServerImplementation>) => updateScheduleEventServerFunction({ data: await encodeActionArguments(args) });


const deleteScheduleEventServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof deleteScheduleEventServerImplementation>>) => args)
  .handler(async ({ data }) => deleteScheduleEventServerImplementation(...decodeActionArguments<Parameters<typeof deleteScheduleEventServerImplementation>>(data)));
export const deleteScheduleEvent = async (...args: Parameters<typeof deleteScheduleEventServerImplementation>) => deleteScheduleEventServerFunction({ data: await encodeActionArguments(args) });
