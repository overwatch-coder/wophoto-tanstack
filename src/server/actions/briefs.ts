import { createServerFn } from "@tanstack/react-start";
import { decodeActionArguments, encodeActionArguments, type EncodedActionArguments } from "@/lib/server-action-args";

import { del } from "@vercel/blob";
import {
  Prisma,
  BriefStatus,
  SignOffStatus,
  StudioArea,
  UserRole,
} from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { managerCanAccessBrief, workerCanAccessBrief } from "@/lib/briefs";
import { requireStudioManagerArea } from "@/lib/studio-access";
import {
  createCreativeBriefSchema,
  updateCreativeBriefSchema,
  setBriefStatusSchema,
  submitBriefSignOffSchema,
  waiveBriefSignOffSchema,
  addBriefReviewerSchema,
  removeBriefReviewerSchema,
  updateShotItemStatusSchema,
  postBriefQuestionSchema,
  resolveBriefQuestionSchema,
  type CreateCreativeBriefInput,
  type UpdateCreativeBriefInput,
  type ShotItem,
} from "@/lib/validation/briefs";

export type BriefActionState = {
  error?: string;
  success?: string;
  briefId?: string;
  signOffId?: string;
  questionId?: string;
};

function revalidateBriefs() {
  // TanStack Router invalidates route queries on navigation/mutation
}

function isManagedBriefFile(fileUrl?: string | null, fileKey?: string | null) {
  if (!fileUrl || !fileKey?.startsWith("briefs/")) return false;
  try {
    const url = new URL(fileUrl);
    return url.protocol === "https:" &&
      url.hostname.endsWith(".private.blob.vercel-storage.com") &&
      decodeURIComponent(url.pathname.slice(1)) === fileKey;
  } catch {
    return false;
  }
}

async function createCreativeBriefServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.BRIEFS);

    const parsed = createCreativeBriefSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid brief data.",
      };
    }

    const data: CreateCreativeBriefInput = parsed.data;

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, managerId: true },
    });

    if (!project || project.managerId !== manager.id) {
      return { error: "The associated project was not found." };
    }

    if (data.fileUrl && !isManagedBriefFile(data.fileUrl, data.fileKey)) {
      return { error: "Uploaded files must come from the authorized brief upload flow." };
    }

    const brief = await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.creativeBrief.updateMany({
          where: { projectId: data.projectId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.creativeBrief.create({
        data: {
          title: data.title,
          summary: data.summary,
          status: BriefStatus.DRAFT,
          isPrimary: data.isPrimary,
          deliverables: data.deliverables,
          guidelines: data.guidelines,
          shotList: data.shotList
            ? (data.shotList as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          externalUrl: data.externalUrl,
          fileUrl: data.fileUrl,
          fileKey: data.fileKey,
          fileName: data.fileName,
          fileSize: data.fileSize,
          fileMime: data.fileMime,
          tags: data.tags || [],
          projectId: data.projectId,
      createdById: manager.actorId,
        },
        select: { id: true },
      });
    });

    revalidateBriefs();

    return {
      success: "Creative brief created successfully.",
      briefId: brief.id,
    };
  } catch (err) {
    console.error("Error in createCreativeBrief:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to create creative brief.",
    };
  }
}

async function updateCreativeBriefServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.BRIEFS);

    const parsed = updateCreativeBriefSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid brief update data.",
      };
    }

    const data: UpdateCreativeBriefInput = parsed.data;

    if (data.fileUrl && !isManagedBriefFile(data.fileUrl, data.fileKey)) {
      return { error: "Uploaded files must come from the authorized brief upload flow." };
    }

    const existing = await prisma.creativeBrief.findUnique({
      where: { id: data.id },
      include: {
        signOffs: {
          where: { version: { equals: undefined } }, // will filter below
          select: { userId: true, version: true },
        },
      },
    });

    if (!existing) {
      return { error: "Creative brief not found." };
    }
    if (!(await managerCanAccessBrief(existing.id, manager.id))) {
      return { error: "Creative brief not found." };
    }

    // Clean up old blob if replaced
    if (
      data.fileUrl !== undefined &&
      existing.fileUrl &&
      data.fileUrl !== existing.fileUrl &&
      isManagedBriefFile(existing.fileUrl, existing.fileKey)
    ) {
      try {
        await del(existing.fileUrl);
      } catch {
        // ignore deletion error
      }
    }

    const isMajor =
      data.majorRevision &&
      existing.status !== BriefStatus.DRAFT;

    const newVersion = isMajor ? existing.version + 1 : existing.version;

    await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.creativeBrief.updateMany({
          where: {
            projectId: existing.projectId,
            id: { not: existing.id },
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }

      await tx.creativeBrief.update({
        where: { id: data.id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.summary !== undefined ? { summary: data.summary } : {}),
          ...(data.deliverables !== undefined
            ? { deliverables: data.deliverables }
            : {}),
          ...(data.guidelines !== undefined
            ? { guidelines: data.guidelines }
            : {}),
          ...(data.shotList !== undefined
            ? {
                shotList: data.shotList
                  ? (data.shotList as unknown as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
              }
            : {}),
          ...(data.externalUrl !== undefined
            ? { externalUrl: data.externalUrl }
            : {}),
          ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
          ...(data.fileKey !== undefined ? { fileKey: data.fileKey } : {}),
          ...(data.fileName !== undefined ? { fileName: data.fileName } : {}),
          ...(data.fileSize !== undefined ? { fileSize: data.fileSize } : {}),
          ...(data.fileMime !== undefined ? { fileMime: data.fileMime } : {}),
          ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
          ...(data.tags !== undefined ? { tags: data.tags } : {}),
          ...(data.revisionSummary !== undefined
            ? { revisionSummary: data.revisionSummary }
            : {}),
          version: newVersion,
          status: isMajor ? BriefStatus.IN_REVIEW : undefined,
        },
      });

      // If major revision on published brief, create new PENDING sign-offs for all past reviewers
      if (isMajor) {
        const pastReviewerIds = Array.from(
          new Set(
            existing.signOffs
              .filter((s) => s.version === existing.version)
              .map((s) => s.userId)
          )
        );

        for (const userId of pastReviewerIds) {
          await tx.briefSignOff.create({
            data: {
              briefId: existing.id,
              userId,
              version: newVersion,
              status: SignOffStatus.PENDING,
            },
          });
        }
      }
    });

    revalidateBriefs();

    return {
      success: isMajor
        ? `Brief updated to version ${newVersion}. Reviewers requested for re-acknowledgment.`
        : "Creative brief updated successfully.",
      briefId: data.id,
    };
  } catch (err) {
    console.error("Error in updateCreativeBrief:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to update creative brief.",
    };
  }
}

async function deleteCreativeBriefServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const { manager, context } = await requireStudioManagerArea(StudioArea.BRIEFS);

    const id = typeof rawInput === "object" && rawInput !== null && "id" in rawInput
      ? String((rawInput as { id: unknown }).id)
      : String(rawInput);

    if (!id || id.trim() === "") {
      return { error: "Brief ID is required." };
    }

    if (!(await managerCanAccessBrief(id, manager.id))) {
      return { error: "Creative brief not found." };
    }

    const deletedFile = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.creativeBrief.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            fileUrl: true,
            fileKey: true,
            project: { select: { studioId: true } },
            signOffs: { select: { status: true } },
            _count: { select: { questions: true } },
          },
        });

        if (!existing || existing.project.studioId !== context.studioId) {
          return { error: "Creative brief not found." } as const;
        }
        if (existing.status !== BriefStatus.DRAFT) {
          return {
            error: "Only unpublished draft briefs can be deleted.",
          } as const;
        }
        if (
          existing.signOffs.some((signOff) => signOff.status !== SignOffStatus.PENDING) ||
          existing._count.questions > 0
        ) {
          return {
            error:
              "This draft has completed review or discussion history and cannot be deleted.",
          } as const;
        }

        await tx.creativeBrief.delete({ where: { id: existing.id } });
        return { fileUrl: existing.fileUrl, fileKey: existing.fileKey } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if ("error" in deletedFile) return { error: deletedFile.error };

    if (isManagedBriefFile(deletedFile.fileUrl, deletedFile.fileKey)) {
      try {
        await del(deletedFile.fileUrl!);
      } catch (error) {
        console.error("Failed to remove deleted brief attachment:", error);
      }
    }

    revalidateBriefs();

    return {
      success: "Creative brief deleted successfully.",
      briefId: id,
    };
  } catch (err) {
    console.error("Error in deleteCreativeBrief:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to delete creative brief.",
    };
  }
}

async function publishCreativeBriefServerImplementation(
  briefId: string
): Promise<BriefActionState & { enrolledCount?: number }> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.BRIEFS);

    if (!briefId || briefId.trim() === "") {
      return { error: "Brief ID is required." };
    }

    const brief = await prisma.creativeBrief.findUnique({
      where: { id: briefId },
      include: {
        project: {
          select: {
            id: true,
            tasks: {
              select: {
                assignees: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!brief) {
      return { error: "Creative brief not found." };
    }
    if (!(await managerCanAccessBrief(brief.id, manager.id))) {
      return { error: "Creative brief not found." };
    }

    // Extract all distinct worker userIds assigned to project tasks
    const workerIds = new Set<string>();
    for (const task of brief.project.tasks) {
      for (const assignee of task.assignees) {
        if (assignee.userId) {
          workerIds.add(assignee.userId);
        }
      }
    }

    const enrolledIds = Array.from(workerIds);

    await prisma.$transaction(async (tx) => {
      await tx.creativeBrief.update({
        where: { id: brief.id },
        data: { status: BriefStatus.IN_REVIEW },
      });

      for (const userId of enrolledIds) {
        await tx.briefSignOff.upsert({
          where: {
            briefId_userId_version: {
              briefId: brief.id,
              userId,
              version: brief.version,
            },
          },
          update: {},
          create: {
            briefId: brief.id,
            userId,
            version: brief.version,
            status: SignOffStatus.PENDING,
          },
        });
      }
    });

    revalidateBriefs();

    return {
      success: `Brief published. Enrolled ${enrolledIds.length} crew reviewers.`,
      briefId: brief.id,
      enrolledCount: enrolledIds.length,
    };
  } catch (err) {
    console.error("Error in publishCreativeBrief:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to publish creative brief.",
    };
  }
}

async function setBriefStatusServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.BRIEFS);

    const parsed = setBriefStatusSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid status transition.",
      };
    }

    const { id, status } = parsed.data;

    if (!(await managerCanAccessBrief(id, manager.id))) {
      return { error: "Creative brief not found." };
    }

    await prisma.creativeBrief.update({
      where: { id },
      data: { status },
    });

    revalidateBriefs();

    return {
      success: `Brief status updated to ${status}.`,
      briefId: id,
    };
  } catch (err) {
    console.error("Error in setBriefStatus:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to update brief status.",
    };
  }
}

async function addBriefReviewerServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.BRIEFS);

    const parsed = addBriefReviewerSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid reviewer input.",
      };
    }

    const { briefId, userId } = parsed.data;

    const brief = await prisma.creativeBrief.findUnique({
      where: { id: briefId },
      select: { id: true, version: true },
    });

    if (!brief) {
      return { error: "Brief not found." };
    }
    if (!(await managerCanAccessBrief(brief.id, manager.id))) {
      return { error: "Brief not found." };
    }

    const signOff = await prisma.briefSignOff.upsert({
      where: {
        briefId_userId_version: {
          briefId,
          userId,
          version: brief.version,
        },
      },
      update: {},
      create: {
        briefId,
        userId,
        version: brief.version,
        status: SignOffStatus.PENDING,
      },
      select: { id: true },
    });

    revalidateBriefs();

    return {
      success: "Reviewer added to creative brief.",
      signOffId: signOff.id,
    };
  } catch (err) {
    console.error("Error in addBriefReviewer:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to add brief reviewer.",
    };
  }
}

async function removeBriefReviewerServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.BRIEFS);

    const parsed = removeBriefReviewerSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid reviewer input.",
      };
    }

    const { briefId, userId } = parsed.data;

    const brief = await prisma.creativeBrief.findUnique({
      where: { id: briefId },
      select: { id: true, version: true },
    });

    if (!brief) {
      return { error: "Brief not found." };
    }
    if (!(await managerCanAccessBrief(brief.id, manager.id))) {
      return { error: "Brief not found." };
    }

    await prisma.briefSignOff.deleteMany({
      where: {
        briefId,
        userId,
        version: brief.version,
      },
    });

    revalidateBriefs();

    return {
      success: "Reviewer removed from creative brief.",
    };
  } catch (err) {
    console.error("Error in removeBriefReviewer:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to remove brief reviewer.",
    };
  }
}

async function waiveBriefSignOffServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.BRIEFS);

    const parsed = waiveBriefSignOffSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid waive input.",
      };
    }

    const { briefId, userId, reason } = parsed.data;

    const brief = await prisma.creativeBrief.findUnique({
      where: { id: briefId },
      select: { id: true, version: true },
    });

    if (!brief) {
      return { error: "Brief not found." };
    }
    if (!(await managerCanAccessBrief(brief.id, manager.id))) {
      return { error: "Brief not found." };
    }

    await prisma.briefSignOff.updateMany({
      where: {
        briefId,
        userId,
        version: brief.version,
      },
      data: {
        status: SignOffStatus.WAIVED,
        waivedById: manager.id,
        waivedAt: new Date(),
        waiveReason: reason,
      },
    });

    revalidateBriefs();

    return {
      success: "Worker sign-off waived successfully.",
    };
  } catch (err) {
    console.error("Error in waiveBriefSignOff:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to waive worker sign-off.",
    };
  }
}

async function submitBriefSignOffServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const worker = await requireRole(UserRole.WORKER);

    const parsed = submitBriefSignOffSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid sign-off input.",
      };
    }

    const { briefId, version, note } = parsed.data;

    const brief = await prisma.creativeBrief.findUnique({
      where: { id: briefId },
      select: { id: true, version: true, status: true },
    });

    if (!brief) {
      return { error: "Creative brief not found." };
    }

    // Concurrency guard: reject if version has moved
    if (brief.version !== version) {
      return {
        error: `The brief has been updated to version ${brief.version}. Please review the updated specifications before signing off.`,
      };
    }

    if (brief.status === BriefStatus.DRAFT) {
      return { error: "Cannot sign off on a draft brief." };
    }

    const signOff = await prisma.briefSignOff.findUnique({
      where: {
        briefId_userId_version: {
          briefId,
          userId: worker.id,
          version,
        },
      },
    });

    if (!signOff) {
      return {
        error: "You are not currently enrolled as a required reviewer for this brief.",
      };
    }

    if (signOff.status === SignOffStatus.SIGNED) {
      return { error: "You have already signed off on this brief version." };
    }

    await prisma.briefSignOff.update({
      where: { id: signOff.id },
      data: {
        status: SignOffStatus.SIGNED,
        signedAt: new Date(),
        note: note || null,
      },
    });

    revalidateBriefs();

    return {
      success: "Sign-off recorded successfully. Thank you for confirming readiness.",
      signOffId: signOff.id,
    };
  } catch (err) {
    console.error("Error in submitBriefSignOff:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to record sign-off.",
    };
  }
}

async function updateShotItemStatusServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const user = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
    const manager = user.role === UserRole.WORKER ? null : (await requireStudioManagerArea(StudioArea.BRIEFS)).manager;

    const parsed = updateShotItemStatusSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid shot update data.",
      };
    }

    const { briefId, shotId, status } = parsed.data;

    const brief = await prisma.creativeBrief.findUnique({
      where: { id: briefId },
      select: { id: true, shotList: true, status: true },
    });

    if (!brief) {
      return { error: "Brief not found." };
    }

    if (user.role === UserRole.WORKER && !(await workerCanAccessBrief(briefId, user.id))) {
      return { error: "You do not have access to this brief." };
    }
    if (manager && !(await managerCanAccessBrief(briefId, manager.id))) {
      return { error: "You do not have access to this brief." };
    }

    if (!Array.isArray(brief.shotList)) {
      return { error: "Brief has no shot list." };
    }

    const shots = [...(brief.shotList as unknown as ShotItem[])];
    const shotIdx = shots.findIndex((s) => s.id === shotId);

    if (shotIdx === -1) {
      return { error: "Shot item not found in brief." };
    }

    shots[shotIdx] = {
      ...shots[shotIdx],
      status,
    };

    await prisma.creativeBrief.update({
      where: { id: briefId },
      data: {
        shotList: shots as unknown as Prisma.InputJsonValue,
      },
    });

    revalidateBriefs();

    return {
      success: `Shot status updated to ${status}.`,
    };
  } catch (err) {
    console.error("Error in updateShotItemStatus:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to update shot status.",
    };
  }
}

async function postBriefQuestionServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const user = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
    const manager = user.role === UserRole.WORKER ? null : (await requireStudioManagerArea(StudioArea.BRIEFS)).manager;

    const parsed = postBriefQuestionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid question input.",
      };
    }

    const { briefId, content, isBlocker, parentId } = parsed.data;

    const brief = await prisma.creativeBrief.findUnique({
      where: { id: briefId },
      select: { id: true, version: true, status: true },
    });

    if (!brief) {
      return { error: "Creative brief not found." };
    }

    if (user.role === UserRole.WORKER && !(await workerCanAccessBrief(brief.id, user.id))) {
      return { error: "You do not have access to this brief." };
    }
    if (manager && !(await managerCanAccessBrief(brief.id, manager.id))) {
      return { error: "You do not have access to this brief." };
    }

    // If reply, verify parent exists and has no parent itself (max 1 level depth)
    if (parentId) {
      const parent = await prisma.briefQuestion.findUnique({
        where: { id: parentId },
          select: { id: true, parentId: true, briefId: true },
      });
      if (!parent) {
        return { error: "Parent question not found." };
      }
      if (parent.parentId) {
        return { error: "Thread nesting is limited to direct replies." };
      }
      if (parent.briefId !== briefId) {
        return { error: "Replies must belong to the same brief discussion." };
      }
    }

    const question = await prisma.$transaction(async (tx) => {
      // If blocker posted by a worker, optionally transition to CHANGES_REQUESTED
      if (isBlocker && brief.status === BriefStatus.IN_REVIEW) {
        await tx.creativeBrief.update({
          where: { id: brief.id },
          data: { status: BriefStatus.CHANGES_REQUESTED },
        });
      }

      return tx.briefQuestion.create({
        data: {
          briefId: brief.id,
          authorId: user.id,
          briefVersion: brief.version,
          content,
          isBlocker: Boolean(isBlocker),
          parentId: parentId || null,
        },
        select: { id: true },
      });
    });

    revalidateBriefs();

    return {
      success: isBlocker
        ? "Question posted and flagged as blocker."
        : "Message posted to brief discussion.",
      questionId: question.id,
    };
  } catch (err) {
    console.error("Error in postBriefQuestion:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to post question.",
    };
  }
}

async function resolveBriefQuestionServerImplementation(
  rawInput: unknown
): Promise<BriefActionState> {
  try {
    const user = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
    const manager = user.role === UserRole.WORKER ? null : (await requireStudioManagerArea(StudioArea.BRIEFS)).manager;

    const parsed = resolveBriefQuestionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid resolution input.",
      };
    }

    const { questionId, isResolved } = parsed.data;

    const question = await prisma.briefQuestion.findUnique({
      where: { id: questionId },
      select: { id: true, authorId: true, briefId: true },
    });

    if (!question) {
      return { error: "Question not found." };
    }

    if (user.role === UserRole.WORKER && !(await workerCanAccessBrief(question.briefId, user.id))) {
      return { error: "You do not have access to this brief discussion." };
    }
    if (manager && !(await managerCanAccessBrief(question.briefId, manager.id))) {
      return { error: "You do not have access to this brief discussion." };
    }

    // Only manager or author can resolve
    if (!manager && question.authorId !== user.id) {
      return { error: "Only a manager or the question author can resolve this question." };
    }

    await prisma.briefQuestion.update({
      where: { id: questionId },
      data: { isResolved },
    });

    revalidateBriefs();

    return {
      success: isResolved ? "Question marked resolved." : "Question reopened.",
      questionId,
    };
  } catch (err) {
    console.error("Error in resolveBriefQuestion:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to resolve question.",
    };
  }
}


const createCreativeBriefServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof createCreativeBriefServerImplementation>>) => args)
  .handler(async ({ data }) => createCreativeBriefServerImplementation(...decodeActionArguments<Parameters<typeof createCreativeBriefServerImplementation>>(data)));
export const createCreativeBrief = async (...args: Parameters<typeof createCreativeBriefServerImplementation>) => createCreativeBriefServerFunction({ data: await encodeActionArguments(args) });

const updateCreativeBriefServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateCreativeBriefServerImplementation>>) => args)
  .handler(async ({ data }) => updateCreativeBriefServerImplementation(...decodeActionArguments<Parameters<typeof updateCreativeBriefServerImplementation>>(data)));
export const updateCreativeBrief = async (...args: Parameters<typeof updateCreativeBriefServerImplementation>) => updateCreativeBriefServerFunction({ data: await encodeActionArguments(args) });

const deleteCreativeBriefServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof deleteCreativeBriefServerImplementation>>) => args)
  .handler(async ({ data }) => deleteCreativeBriefServerImplementation(...decodeActionArguments<Parameters<typeof deleteCreativeBriefServerImplementation>>(data)));
export const deleteCreativeBrief = async (...args: Parameters<typeof deleteCreativeBriefServerImplementation>) => deleteCreativeBriefServerFunction({ data: await encodeActionArguments(args) });

const publishCreativeBriefServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof publishCreativeBriefServerImplementation>>) => args)
  .handler(async ({ data }) => publishCreativeBriefServerImplementation(...decodeActionArguments<Parameters<typeof publishCreativeBriefServerImplementation>>(data)));
export const publishCreativeBrief = async (...args: Parameters<typeof publishCreativeBriefServerImplementation>) => publishCreativeBriefServerFunction({ data: await encodeActionArguments(args) });

const setBriefStatusServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof setBriefStatusServerImplementation>>) => args)
  .handler(async ({ data }) => setBriefStatusServerImplementation(...decodeActionArguments<Parameters<typeof setBriefStatusServerImplementation>>(data)));
export const setBriefStatus = async (...args: Parameters<typeof setBriefStatusServerImplementation>) => setBriefStatusServerFunction({ data: await encodeActionArguments(args) });

const addBriefReviewerServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof addBriefReviewerServerImplementation>>) => args)
  .handler(async ({ data }) => addBriefReviewerServerImplementation(...decodeActionArguments<Parameters<typeof addBriefReviewerServerImplementation>>(data)));
export const addBriefReviewer = async (...args: Parameters<typeof addBriefReviewerServerImplementation>) => addBriefReviewerServerFunction({ data: await encodeActionArguments(args) });

const removeBriefReviewerServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof removeBriefReviewerServerImplementation>>) => args)
  .handler(async ({ data }) => removeBriefReviewerServerImplementation(...decodeActionArguments<Parameters<typeof removeBriefReviewerServerImplementation>>(data)));
export const removeBriefReviewer = async (...args: Parameters<typeof removeBriefReviewerServerImplementation>) => removeBriefReviewerServerFunction({ data: await encodeActionArguments(args) });

const waiveBriefSignOffServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof waiveBriefSignOffServerImplementation>>) => args)
  .handler(async ({ data }) => waiveBriefSignOffServerImplementation(...decodeActionArguments<Parameters<typeof waiveBriefSignOffServerImplementation>>(data)));
export const waiveBriefSignOff = async (...args: Parameters<typeof waiveBriefSignOffServerImplementation>) => waiveBriefSignOffServerFunction({ data: await encodeActionArguments(args) });

const submitBriefSignOffServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof submitBriefSignOffServerImplementation>>) => args)
  .handler(async ({ data }) => submitBriefSignOffServerImplementation(...decodeActionArguments<Parameters<typeof submitBriefSignOffServerImplementation>>(data)));
export const submitBriefSignOff = async (...args: Parameters<typeof submitBriefSignOffServerImplementation>) => submitBriefSignOffServerFunction({ data: await encodeActionArguments(args) });

const updateShotItemStatusServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateShotItemStatusServerImplementation>>) => args)
  .handler(async ({ data }) => updateShotItemStatusServerImplementation(...decodeActionArguments<Parameters<typeof updateShotItemStatusServerImplementation>>(data)));
export const updateShotItemStatus = async (...args: Parameters<typeof updateShotItemStatusServerImplementation>) => updateShotItemStatusServerFunction({ data: await encodeActionArguments(args) });

const postBriefQuestionServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof postBriefQuestionServerImplementation>>) => args)
  .handler(async ({ data }) => postBriefQuestionServerImplementation(...decodeActionArguments<Parameters<typeof postBriefQuestionServerImplementation>>(data)));
export const postBriefQuestion = async (...args: Parameters<typeof postBriefQuestionServerImplementation>) => postBriefQuestionServerFunction({ data: await encodeActionArguments(args) });


const resolveBriefQuestionServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof resolveBriefQuestionServerImplementation>>) => args)
  .handler(async ({ data }) => resolveBriefQuestionServerImplementation(...decodeActionArguments<Parameters<typeof resolveBriefQuestionServerImplementation>>(data)));
export const resolveBriefQuestion = async (...args: Parameters<typeof resolveBriefQuestionServerImplementation>) => resolveBriefQuestionServerFunction({ data: await encodeActionArguments(args) });
