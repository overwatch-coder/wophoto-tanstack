import "server-only";

import { revalidatePath } from "next/cache";
import { TaskPriority, TaskType, UserRole, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/validation/common";
import { dailyEntrySchema } from "@/lib/validation/tasks";
import { z } from "zod";

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

export const dailyEntryProposalSchema = z.object({
  projectId: idSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000),
  priority: z.enum(TaskPriority),
  workDate: calendarDateSchema,
}).strict();

export type DailyEntryProposalInput = z.infer<typeof dailyEntryProposalSchema>;

function todayUtcDate() {
  return new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
}

export async function prepareDailyEntryProposal(userId: string, input: {
  projectName?: string;
  title: string;
  description?: string;
  workDate: string;
}) {
  const worker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
  if (worker?.role !== UserRole.WORKER || worker.status !== UserStatus.ACTIVE) {
    return { error: "Only active workers can log daily work." };
  }

  const date = calendarDateSchema.safeParse(input.workDate);
  if (!date.success) return { error: "Choose a valid work date." };
  if (new Date(`${date.data}T00:00:00.000Z`) > todayUtcDate()) {
    return { error: "Daily work cannot be logged for a future date." };
  }

  const projects = await prisma.project.findMany({
    where: {
      tasks: {
        some: {
          type: TaskType.ASSIGNED,
          deletedAt: null,
          assignees: { some: { userId } },
        },
      },
      ...(input.projectName ? { name: { contains: input.projectName.trim(), mode: "insensitive" as const } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  const exactMatches = input.projectName
    ? projects.filter((project) => project.name.toLocaleLowerCase() === input.projectName!.trim().toLocaleLowerCase())
    : [];
  const project = exactMatches.length === 1 ? exactMatches[0] : projects.length === 1 ? projects[0] : null;
  if (!project) {
    const message = projects.length === 0
      ? "I couldn't find a project where you have assigned work. Daily work can only be logged to a project with an assignment for you. Which assigned project should I use?"
      : `Which assigned project is this for? I found: ${projects.map((item) => item.name).slice(0, 10).join(", ")}.`;
    return { needsInput: true, message };
  }

  const description = input.description?.trim() ?? "";
  const proposal = {
    projectId: project.id,
    title: input.title.trim(),
    description,
    priority: TaskPriority.MEDIUM,
    workDate: date.data,
  } satisfies DailyEntryProposalInput;

  return {
    requiresConfirmation: true,
    proposalType: "CREATE_DAILY_ENTRY" as const,
    title: "Log Daily Work",
    description: `This will log “${proposal.title}” for ${project.name} on ${date.data}. Review the entry before saving it.`,
    dailyEntryPreview: {
      projectName: project.name,
      title: proposal.title,
      description: proposal.description,
      workDate: date.data,
    },
    payload: proposal,
  };
}

export async function createDailyEntryForWorker(userId: string, rawInput: DailyEntryProposalInput) {
  const worker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
  if (worker?.role !== UserRole.WORKER || worker.status !== UserStatus.ACTIVE) {
    return { error: "Only active workers can log daily work." };
  }

  const parsed = dailyEntryProposalSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The daily work entry is invalid." };
  const values = parsed.data;
  const input = dailyEntrySchema.safeParse({
    ...values,
    startAt: "",
    dueAt: "",
  });
  if (!input.success) return { error: input.error.issues[0]?.message ?? "The daily work entry is invalid." };
  if (input.data.workDate && input.data.workDate > todayUtcDate()) {
    return { error: "Choose today or a past work date." };
  }

  const eligible = await prisma.project.findFirst({
    where: {
      id: values.projectId,
      tasks: {
        some: {
          type: TaskType.ASSIGNED,
          deletedAt: null,
          assignees: { some: { userId } },
        },
      },
    },
    select: { id: true, name: true },
  });
  if (!eligible) return { error: "That project is no longer available for your daily work entries." };

  const task = await prisma.task.create({
    data: {
      title: input.data.title,
      description: input.data.description,
      priority: input.data.priority,
      projectId: eligible.id,
      createdById: userId,
      type: TaskType.DAILY_ENTRY,
      workDate: input.data.workDate,
      assignees: { create: { userId } },
    },
    select: { id: true },
  });

  revalidatePath("/worker/tasks");
  revalidatePath("/manager/tasks");
  return { message: `Daily work logged for ${eligible.name}.`, taskId: task.id };
}
