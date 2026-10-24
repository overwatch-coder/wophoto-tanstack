import "server-only";

import { z } from "zod";
import { TaskPriority, UserRole, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clientEmail: z.string().trim().email().max(254),
}).strict();

export const createTaskBatchInputSchema = z.object({
  projectId: z.string().trim().min(1).max(100),
  taskCount: z.number().int().min(1).max(20),
  baseTitle: z.string().trim().min(2).max(120),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
}).strict();

type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
type CreateTaskBatchInput = z.infer<typeof createTaskBatchInputSchema>;

export async function createProjectForManager(managerId: string, input: CreateProjectInput) {
  const parsed = createProjectInputSchema.parse(input);
  const client = await prisma.user.findFirst({
    where: {
      email: { equals: parsed.clientEmail, mode: "insensitive" },
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
    },
    select: { id: true },
  });

  if (!client) {
    return { error: "No active client account matches that email. Check the address and try again." };
  }

  const project = await prisma.project.create({
    data: { name: parsed.name, managerId, clientId: client.id },
    select: { id: true, name: true },
  });

  return {
    success: true,
    projectId: project.id,
    name: project.name,
    href: "/manager/projects",
    message: `Project "${project.name}" has been created.`,
  };
}

export async function createTaskBatchForManager(managerId: string, input: CreateTaskBatchInput) {
  const parsed = createTaskBatchInputSchema.parse(input);
  const project = await prisma.project.findFirst({
    where: { id: parsed.projectId, managerId },
    select: { id: true },
  });
  if (!project) return { error: "That project is not available in your manager workspace." };

  const workers = await prisma.user.findMany({
    where: {
      role: UserRole.WORKER,
      status: UserStatus.ACTIVE,
      acceptedInvitation: { is: { invitedById: managerId } },
    },
    select: {
      id: true,
      taskAssignments: {
        where: {
          task: {
            deletedAt: null,
            status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
            project: { managerId },
          },
        },
        select: { taskId: true },
      },
    },
    take: 100,
  });

  if (workers.length === 0) {
    return { error: "Invite an active worker before creating an assigned task batch." };
  }

  const workload = workers
    .map((worker) => ({ id: worker.id, activeTasks: worker.taskAssignments.length }))
    .sort((a, b) => a.activeTasks - b.activeTasks || a.id.localeCompare(b.id));

  const tasks = await prisma.$transaction(
    Array.from({ length: parsed.taskCount }, (_, index) => {
      const assignee = workload[index % workload.length];
      assignee.activeTasks += 1;
      return prisma.task.create({
        data: {
          title: `${parsed.baseTitle} #${index + 1}`,
          priority: parsed.priority,
          status: "TODO",
          createdById: managerId,
          projectId: project.id,
          assignees: { create: { userId: assignee.id, status: "TODO" } },
        },
        select: { id: true, title: true },
      });
    }),
  );

  return {
    success: true,
    count: tasks.length,
    href: "/manager/tasks",
    message: `Created and distributed ${tasks.length} tasks across ${new Set(workload.map((worker) => worker.id)).size} active workers.`,
  };
}
