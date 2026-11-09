
import { z } from "zod"
import {
  InvitationStatus,
  TaskPriority,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export const createProjectInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional(),
    clientEmail: z.string().trim().email().max(254),
  })
  .strict()

const taskDueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    )
  }, "Use a valid calendar date in YYYY-MM-DD format.")

export const createTaskBatchInputSchema = z
  .object({
    projectId: z.string().trim().min(1).max(100),
    tasks: z
      .array(
        z
          .object({
            title: z.string().trim().min(2).max(120),
            dueDate: taskDueDateSchema.optional(),
            assigneeId: z.string().trim().min(1).max(100),
            priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict()

export const createTaskBatchRequestSchema = z
  .object({
    projectId: z.string().trim().min(1).max(100).optional(),
    tasks: z
      .array(
        z
          .object({
            title: z.string().trim().min(2).max(120),
            dueDate: taskDueDateSchema.optional(),
            assignee: z.string().trim().min(1).max(254).optional(),
            priority: z.nativeEnum(TaskPriority).optional(),
          })
          .strict()
      )
      .min(1)
      .max(20)
      .optional(),
    taskCount: z.number().int().min(1).max(20).optional(),
    baseTitle: z.string().trim().min(2).max(120).optional(),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  })
  .strict()

type CreateProjectInput = z.infer<typeof createProjectInputSchema>
type CreateTaskBatchInput = z.infer<typeof createTaskBatchInputSchema>
export type CreateTaskBatchRequest = z.infer<
  typeof createTaskBatchRequestSchema
>

export async function createProjectForManager(
  managerId: string,
  input: CreateProjectInput
) {
  const parsed = createProjectInputSchema.parse(input)
  const client = await prisma.user.findFirst({
    where: {
      email: { equals: parsed.clientEmail, mode: "insensitive" },
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      acceptedInvitation: {
        is: {
          invitedById: managerId,
          status: InvitationStatus.USED,
        },
      },
    },
    select: { id: true },
  })

  if (!client) {
    return {
      error:
        "No active client account matches that email. Check the address and try again.",
    }
  }

  const studio = await prisma.studio.findUnique({ where: { ownerUserId: managerId }, select: { id: true } });
  if (!studio) return { error: "Your studio is not ready to create projects." };

  const project = await prisma.project.create({
    data: {
      name: parsed.name,
      description: parsed.description || null,
      managerId,
      clientId: client.id,
      studioId: studio.id,
    },
    select: { id: true, name: true },
  })

  return {
    success: true,
    projectId: project.id,
    name: project.name,
    href: "/manager/projects",
    description: parsed.description || null,
    message: `Project "${project.name}" has been created.`,
  }
}

export async function createTaskBatchForManager(
  managerId: string,
  input: CreateTaskBatchInput,
  actorId = managerId,
) {
  const parsed = createTaskBatchInputSchema.parse(input)
  const project = await prisma.project.findFirst({
    where: { id: parsed.projectId, managerId },
    select: { id: true },
  })
  if (!project)
    return { error: "That project is not available in your manager workspace." }

  const workers = await prisma.user.findMany({
    where: {
      role: UserRole.WORKER,
      status: UserStatus.ACTIVE,
      acceptedInvitation: { is: { invitedById: managerId } },
      id: { in: [...new Set(parsed.tasks.map((task) => task.assigneeId))] },
    },
    select: { id: true },
  })
  const authorizedWorkerIds = new Set(workers.map((worker) => worker.id))
  if (parsed.tasks.some((task) => !authorizedWorkerIds.has(task.assigneeId))) {
    return {
      error:
        "One or more assigned workers are no longer active on your team. Prepare the proposal again and review the assignments.",
    }
  }

  const tasks = await prisma.$transaction(
    parsed.tasks.map((task) => {
      return prisma.task.create({
        data: {
          title: task.title,
          priority: task.priority,
          status: "TODO",
          dueAt: task.dueDate
            ? new Date(`${task.dueDate}T12:00:00.000Z`)
            : null,
          createdById: actorId,
          projectId: project.id,
          assignees: { create: { userId: task.assigneeId, status: "TODO" } },
        },
        select: { id: true, title: true },
      })
    })
  )

  const assignees = await prisma.user.findMany({
    where: {
      id: { in: [...new Set(parsed.tasks.map((task) => task.assigneeId))] },
    },
    select: { id: true, name: true },
  })
  const assigneeNames = new Map(
    assignees.map((worker) => [worker.id, worker.name ?? "Worker"])
  )

  return {
    success: true,
    count: tasks.length,
    tasks: tasks.map((task, index) => ({
      id: task.id,
      title: task.title,
      assigneeName:
        assigneeNames.get(parsed.tasks[index].assigneeId) ?? "Worker",
      dueDate: parsed.tasks[index].dueDate ?? null,
    })),
    href: "/manager/tasks",
    message: `Created ${tasks.length} tasks with the reviewed titles, assignees, and due dates.`,
  }
}

export async function prepareTaskBatchForManager(
  managerId: string,
  input: CreateTaskBatchRequest
) {
  const parsed = createTaskBatchRequestSchema.parse(input)
  if (!parsed.tasks?.length && (!parsed.taskCount || !parsed.baseTitle)) {
    return {
      error:
        "Provide task rows from the attachment, or provide both a task count and a title.",
    }
  }

  const project = parsed.projectId
    ? await prisma.project.findFirst({
        where: { id: parsed.projectId, managerId },
        select: { id: true, name: true },
      })
    : await prisma.project.findFirst({
        where: { managerId },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true },
      })
  if (!project)
    return {
      error:
        "Choose a project owned by your manager workspace before creating tasks.",
    }

  const requestedTasks =
    parsed.tasks ??
    Array.from({ length: parsed.taskCount! }, (_, index) => ({
      title: `${parsed.baseTitle!} #${index + 1}`,
      priority: parsed.priority,
    }))
  const workers = await prisma.user.findMany({
    where: {
      role: UserRole.WORKER,
      status: UserStatus.ACTIVE,
      acceptedInvitation: { is: { invitedById: managerId } },
    },
    select: {
      id: true,
      name: true,
      email: true,
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
  })
  if (workers.length === 0)
    return { error: "Invite an active worker before creating assigned tasks." }

  const workload = workers
    .map((worker) => ({
      id: worker.id,
      name: worker.name ?? "Worker",
      email: worker.email,
      activeTasks: worker.taskAssignments.length,
    }))
    .sort((a, b) => a.activeTasks - b.activeTasks || a.id.localeCompare(b.id))
  const preparedTasks: CreateTaskBatchInput["tasks"] = []
  const preview: Array<{
    title: string
    assigneeName: string
    dueDate: string | null
    priority: TaskPriority
  }> = []

  for (const task of requestedTasks) {
    let assignedWorker = undefined as (typeof workload)[number] | undefined
    if ("assignee" in task && task.assignee) {
      const assignment = task.assignee.trim().toLocaleLowerCase()
      const matches = workload.filter(
        (worker) =>
          worker.email.toLocaleLowerCase() === assignment ||
          worker.name.toLocaleLowerCase() === assignment
      )
      if (matches.length !== 1) {
        const availableNames = workload.map((worker) => worker.name).join(", ")
        return {
          error:
            matches.length > 1
              ? `The assignee "${task.assignee}" matches more than one active worker. Use their email address to identify the right person.`
              : `The assignee "${task.assignee}" is not an active worker on your team. Available workers: ${availableNames}. Correct the sheet value or leave the assignee blank to distribute that task by workload.`,
        }
      }
      assignedWorker = matches[0]
    } else {
      assignedWorker = workload[0]
    }

    assignedWorker.activeTasks += 1
    const dueDate = "dueDate" in task ? task.dueDate : undefined
    const priority = task.priority ?? parsed.priority
    preparedTasks.push({
      title: task.title,
      dueDate,
      assigneeId: assignedWorker.id,
      priority,
    })
    preview.push({
      title: task.title,
      assigneeName: assignedWorker.name,
      dueDate: dueDate ?? null,
      priority,
    })
    workload.sort(
      (a, b) => a.activeTasks - b.activeTasks || a.id.localeCompare(b.id)
    )
  }

  return {
    payload: { projectId: project.id, tasks: preparedTasks },
    projectName: project.name,
    preview,
  }
}
