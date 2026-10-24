"use server"

import { revalidatePath } from "next/cache"
import {
  FeedbackStatus,
  FeedbackType,
  TaskStatus,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client"
import { requireRole } from "@/lib/authz"
import { prisma } from "@/lib/prisma"

export type FeedbackActionState = {
  error?: string
  success?: string
  createdId?: string
}

class FeedbackValidationError extends Error {}

export async function createClientFeedback(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const client = await requireRole(UserRole.CLIENT)

  try {
    const projectId = String(formData.get("projectId") ?? "").trim()
    const taskId = String(formData.get("taskId") ?? "").trim() || null
    const typeRaw = String(formData.get("type") ?? "REVISION").trim()
    const type = (
      ["REVISION", "REVIEW", "COMPLAINT"].includes(typeRaw)
        ? typeRaw
        : "REVISION"
    ) as FeedbackType
    const scoreRaw = Number(formData.get("score") ?? 0)
    const submittedTitle = String(formData.get("title") ?? "").trim()
    const title = type === FeedbackType.REVIEW ? "Project review" : submittedTitle
    const details = String(formData.get("details") ?? "").trim()

    if (!projectId) {
      throw new FeedbackValidationError("Please choose a campaign or project.")
    }

    if (type !== FeedbackType.REVIEW && (title.length < 3 || title.length > 150)) {
      throw new FeedbackValidationError("Request title must be between 3 and 150 characters.")
    }

    if (details.length < 5 || details.length > 5000) {
      throw new FeedbackValidationError(
        "Request details must be between 5 and 5,000 characters."
      )
    }

    if (type === FeedbackType.REVIEW && (!Number.isInteger(scoreRaw) || scoreRaw < 1 || scoreRaw > 5)) {
      throw new FeedbackValidationError("Choose a rating from 1 to 5 stars for your review.")
    }

    const score = type === FeedbackType.REVIEW ? scoreRaw : null

    // Verify project belongs to this client
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        clientId: client.id,
      },
      select: { id: true },
    })

    if (!project) {
      throw new FeedbackValidationError(
        "This project is not accessible to your client account."
      )
    }

    // If taskId is provided, verify it belongs to this project
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          projectId: project.id,
          deletedAt: null,
        },
        select: { id: true },
      })

      if (!task) {
        throw new FeedbackValidationError(
          "Selected deliverable is not valid for this project."
        )
      }
    }

    const created = await prisma.clientFeedback.create({
      data: {
        projectId: project.id,
        taskId: taskId || null,
        clientId: client.id,
        type,
        status: FeedbackStatus.NEW,
        score,
        title,
        details,
      },
    })

    revalidatePath("/client/project-feedback")
    revalidatePath("/manager/reviews")
    revalidatePath("/client")

    return {
      success:
        type === FeedbackType.REVIEW
          ? "Review submitted successfully."
          : "Request submitted successfully to the studio team.",
      createdId: created.id,
    }
  } catch (error) {
    if (!(error instanceof FeedbackValidationError)) {
      console.error("Client feedback submission failed:", error)
    }

    return {
      error:
        error instanceof FeedbackValidationError
          ? error.message
          : "Could not submit your request. Please try again.",
    }
  }
}

export async function resolveFeedback(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const manager = await requireRole(UserRole.MANAGER)

  try {
    const feedbackId = String(formData.get("feedbackId") ?? "").trim()
    const responseNote = String(formData.get("responseNote") ?? "").trim()

    if (!feedbackId) {
      throw new FeedbackValidationError("Feedback ID is required.")
    }

    if (responseNote.length < 3 || responseNote.length > 5000) {
      throw new FeedbackValidationError(
        "Resolution note must be between 3 and 5,000 characters."
      )
    }

    // Verify feedback belongs to a project managed by this manager
    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id: feedbackId,
        project: {
          managerId: manager.id,
        },
      },
      select: { id: true, taskId: true, type: true },
    })

    if (!feedback) {
      throw new FeedbackValidationError(
        "You do not have permission to resolve this feedback."
      )
    }

    if (feedback.type === FeedbackType.REVIEW) {
      throw new FeedbackValidationError("Client reviews do not require a resolution action.")
    }

    await prisma.clientFeedback.update({
      where: { id: feedback.id },
      data: {
        status: FeedbackStatus.RESOLVED,
        responseNote,
        respondedAt: new Date(),
        respondedById: manager.id,
      },
    })

    // If linked to a task, mark as completed
    if (feedback.taskId) {
      await prisma.taskAssignee.updateMany({
        where: { taskId: feedback.taskId },
        data: { status: TaskStatus.COMPLETED },
      })
      await prisma.task.update({
        where: { id: feedback.taskId },
        data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
      })
    }

    revalidatePath("/manager/reviews")
    revalidatePath("/client/project-feedback")
    revalidatePath("/worker/reviews")
    revalidatePath("/worker/tasks")
    revalidatePath("/manager/tasks")
    revalidatePath("/client")

    return {
      success: "Resolution note recorded and ticket marked as resolved.",
    }
  } catch (error) {
    return {
      error:
        error instanceof FeedbackValidationError
          ? error.message
          : "Could not resolve the feedback item. Please try again.",
    }
  }
}

export async function delegateFeedbackToWorker(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const manager = await requireRole(UserRole.MANAGER)

  try {
    const feedbackId = String(formData.get("feedbackId") ?? "").trim()
    const workerId = String(formData.get("workerId") ?? "").trim()
    const delegationNote = String(formData.get("delegationNote") ?? "").trim()

    if (!feedbackId) {
      throw new FeedbackValidationError("Feedback ID is required.")
    }
    if (!workerId) {
      throw new FeedbackValidationError("Please choose a worker to delegate this revision to.")
    }
    if (delegationNote.length < 3 || delegationNote.length > 5000) {
      throw new FeedbackValidationError("Delegation instructions must be between 3 and 5,000 characters.")
    }

    // Verify feedback belongs to a project managed by this manager
    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id: feedbackId,
        project: {
          managerId: manager.id,
        },
      },
      select: {
        id: true,
        type: true,
        taskId: true,
        projectId: true,
        title: true,
        details: true,
      },
    })

    if (!feedback) {
      throw new FeedbackValidationError("You do not have permission to delegate this feedback.")
    }

    if (feedback.type === FeedbackType.REVIEW) {
      throw new FeedbackValidationError("Client reviews cannot be delegated to workers.")
    }

    // Verify worker exists and is active
    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        role: UserRole.WORKER,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, name: true },
    })

    if (!worker) {
      throw new FeedbackValidationError("The selected worker is not available.")
    }

    // If feedback is linked to a task, update task and assignee
    if (feedback.taskId) {
      const existingAssignee = await prisma.taskAssignee.findUnique({
        where: {
          taskId_userId: {
            taskId: feedback.taskId,
            userId: worker.id,
          },
        },
      })

      if (existingAssignee) {
        await prisma.taskAssignee.update({
          where: {
            taskId_userId: {
              taskId: feedback.taskId,
              userId: worker.id,
            },
          },
          data: {
            status: TaskStatus.IN_PROGRESS,
            submittedAt: null,
            managerNote: delegationNote,
          },
        })
      } else {
        await prisma.taskAssignee.create({
          data: {
            taskId: feedback.taskId,
            userId: worker.id,
            status: TaskStatus.IN_PROGRESS,
            managerNote: delegationNote,
          },
        })
      }

      await prisma.task.update({
        where: { id: feedback.taskId },
        data: {
          status: TaskStatus.IN_PROGRESS,
          completedAt: null,
        },
      })
    }

    // Update feedback record
    await prisma.clientFeedback.update({
      where: { id: feedback.id },
      data: {
        status: FeedbackStatus.ASSIGNED_TO_WORKER,
        assignedWorkerId: worker.id,
        delegationNote,
        delegatedAt: new Date(),
        workerNote: null,
        workerSubmittedAt: null,
      },
    })

    revalidatePath("/manager/reviews")
    revalidatePath("/client/project-feedback")
    revalidatePath("/worker/reviews")
    revalidatePath("/worker/tasks")
    revalidatePath("/manager/tasks")

    return {
      success: `Revision delegated to ${worker.name || "worker"}.`,
    }
  } catch (error) {
    return {
      error:
        error instanceof FeedbackValidationError
          ? error.message
          : "Could not delegate this feedback. Please try again.",
    }
  }
}

export async function submitWorkerRevision(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const worker = await requireRole(UserRole.WORKER)

  try {
    const feedbackId = String(formData.get("feedbackId") ?? "").trim()
    const workerNote = String(formData.get("workerNote") ?? "").trim()

    if (!feedbackId) {
      throw new FeedbackValidationError("Feedback ID is required.")
    }
    if (workerNote.length < 3 || workerNote.length > 5000) {
      throw new FeedbackValidationError("Submission note must be between 3 and 5,000 characters.")
    }

    // Verify feedback is assigned to this worker
    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id: feedbackId,
        assignedWorkerId: worker.id,
      },
      select: {
        id: true,
        type: true,
        taskId: true,
      },
    })

    if (!feedback) {
      throw new FeedbackValidationError("You do not have permission to submit revisions for this feedback.")
    }

    if (feedback.type === FeedbackType.REVIEW) {
      throw new FeedbackValidationError("Client reviews do not have a worker revision workflow.")
    }

    // If feedback is linked to a task, update the task assignee status to IN_REVIEW
    if (feedback.taskId) {
      await prisma.taskAssignee.updateMany({
        where: {
          taskId: feedback.taskId,
          userId: worker.id,
        },
        data: {
          status: TaskStatus.IN_REVIEW,
          submittedAt: new Date(),
        },
      })

      await prisma.task.update({
        where: { id: feedback.taskId },
        data: {
          status: TaskStatus.IN_REVIEW,
        },
      })
    }

    // Update feedback status to IN_REVIEW
    await prisma.clientFeedback.update({
      where: { id: feedback.id },
      data: {
        status: FeedbackStatus.IN_REVIEW,
        workerNote,
        workerSubmittedAt: new Date(),
      },
    })

    revalidatePath("/worker/reviews")
    revalidatePath("/manager/reviews")
    revalidatePath("/client/project-feedback")
    revalidatePath("/worker/tasks")
    revalidatePath("/manager/tasks")

    return {
      success: "Revisions submitted to manager for review.",
    }
  } catch (error) {
    return {
      error:
        error instanceof FeedbackValidationError
          ? error.message
          : "Could not submit your revision. Please try again.",
    }
  }
}

export async function updateClientFeedback(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const client = await requireRole(UserRole.CLIENT)

  try {
    const feedbackId = String(formData.get("feedbackId") ?? "").trim()
    const projectId = String(formData.get("projectId") ?? "").trim()
    const taskId = String(formData.get("taskId") ?? "").trim() || null
    const typeRaw = String(formData.get("type") ?? "").trim()
    const scoreRaw = Number(formData.get("score") ?? 0)
    const submittedTitle = String(formData.get("title") ?? "").trim()
    const title = typeRaw === FeedbackType.REVIEW ? "Project review" : submittedTitle
    const details = String(formData.get("details") ?? "").trim()

    if (!feedbackId || !projectId) {
      throw new FeedbackValidationError("Choose a project for this request.")
    }
    if (!(Object.values(FeedbackType) as string[]).includes(typeRaw)) {
      throw new FeedbackValidationError("Choose a valid request type.")
    }
    const type = typeRaw as FeedbackType

    if (type !== FeedbackType.REVIEW && (title.length < 3 || title.length > 150)) {
      throw new FeedbackValidationError(
        "Request title must be between 3 and 150 characters."
      )
    }
    if (details.length < 5 || details.length > 5000) {
      throw new FeedbackValidationError(
        "Request details must be between 5 and 5,000 characters."
      )
    }
    if (
      type === FeedbackType.REVIEW &&
      (!Number.isInteger(scoreRaw) || scoreRaw < 1 || scoreRaw > 5)
    ) {
      throw new FeedbackValidationError("Choose a rating from 1 to 5 stars for your review.")
    }

    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id: feedbackId,
        clientId: client.id,
        status: FeedbackStatus.NEW,
      },
      select: { id: true },
    })
    if (!feedback) {
      throw new FeedbackValidationError("Only new requests can be edited.")
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, clientId: client.id },
      select: { id: true },
    })
    if (!project) {
      throw new FeedbackValidationError(
        "This project is not accessible to your client account."
      )
    }

    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId: project.id, deletedAt: null },
        select: { id: true },
      })
      if (!task) {
        throw new FeedbackValidationError(
          "Selected deliverable is not valid for this project."
        )
      }
    }

    const score = type === FeedbackType.REVIEW ? scoreRaw : null
    await prisma.clientFeedback.update({
      where: { id: feedback.id },
      data: {
        projectId: project.id,
        taskId,
        type,
        score,
        title,
        details,
      },
    })

    revalidatePath("/client/project-feedback")
    revalidatePath("/client")
    return {
      success: type === FeedbackType.REVIEW
        ? "Review updated."
        : "Feedback request updated.",
    }
  } catch (error) {
    return {
      error:
        error instanceof FeedbackValidationError
          ? error.message
          : "Could not update your request. Please try again.",
    }
  }
}

export async function deleteClientFeedback(
  feedbackId: string
): Promise<FeedbackActionState> {
  const client = await requireRole(UserRole.CLIENT)

  try {
    const id = feedbackId.trim()
    if (!id) throw new FeedbackValidationError("Feedback ID is required.")

    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id,
        clientId: client.id,
        status: FeedbackStatus.NEW,
      },
      select: { id: true },
    })
    if (!feedback) {
      throw new FeedbackValidationError("Only new requests can be deleted.")
    }

    await prisma.clientFeedback.delete({ where: { id: feedback.id } })
    revalidatePath("/client/project-feedback")
    revalidatePath("/client")
    revalidatePath("/manager/reviews")
    return { success: "Feedback request deleted." }
  } catch (error) {
    return {
      error:
        error instanceof FeedbackValidationError
          ? error.message
          : "Could not delete this request. Please try again.",
    }
  }
}
