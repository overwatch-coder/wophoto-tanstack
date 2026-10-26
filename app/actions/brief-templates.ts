"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import {
  UserRole,
  UserStatus,
  BriefStatus,
  Prisma,
} from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  createBriefTemplateSchema,
  updateBriefTemplateSchema,
  archiveBriefTemplateSchema,
  convertBriefToTemplateSchema,
  instantiateBriefFromTemplateSchema,
  type CreateBriefTemplateInput,
  type UpdateBriefTemplateInput,
} from "@/lib/validation/brief-templates";
import { type ShotItem } from "@/lib/validation/briefs";

export type BriefTemplateActionState = {
  error?: string;
  success?: string;
  templateId?: string;
  briefId?: string;
  projectId?: string;
  coverImageUrl?: string;
  attachmentUrl?: string;
  attachmentName?: string;
};

const TEMPLATE_PATHS = [
  "/manager/explore-briefs",
  "/worker/explore-briefs",
  "/manager/brief-review",
  "/worker/brief-review",
];

function revalidateTemplatePaths() {
  for (const path of TEMPLATE_PATHS) {
    revalidatePath(path);
  }
}

function isManagedTemplateFile(fileUrl: string | null | undefined, allowBriefSource = false) {
  if (!fileUrl) return false;
  try {
    const url = new URL(fileUrl);
    const pathname = decodeURIComponent(url.pathname.slice(1));
    return url.protocol === "https:" &&
      url.hostname.endsWith(".private.blob.vercel-storage.com") &&
      (pathname.startsWith("brief-templates/") ||
        (allowBriefSource && pathname.startsWith("briefs/")));
  } catch {
    return false;
  }
}

async function deleteReplacedTemplateFile(
  fileUrl: string | null | undefined,
  nextUrl: string | null | undefined
) {
  if (!fileUrl || fileUrl === nextUrl || !isManagedTemplateFile(fileUrl)) return;
  try {
    const references = await prisma.briefTemplate.count({
      where: { OR: [{ coverImageUrl: fileUrl }, { attachmentUrl: fileUrl }] },
    });
    if (references === 0) await del(fileUrl);
  } catch {
    // Storage cleanup is best effort after the database write succeeds.
  }
}

export async function createBriefTemplate(
  rawInput: unknown
): Promise<BriefTemplateActionState> {
  try {
    const user = await requireRole(UserRole.MANAGER);

    const parsed = createBriefTemplateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid template data.",
      };
    }

    const data: CreateBriefTemplateInput = parsed.data;

    if ((data.coverImageUrl && !isManagedTemplateFile(data.coverImageUrl)) ||
        (data.attachmentUrl && !isManagedTemplateFile(data.attachmentUrl, true))) {
      return { error: "Template files must come from the authorized private upload flow." };
    }

    const template = await prisma.briefTemplate.create({
      data: {
        title: data.title,
        summary: data.summary,
        category: data.category,
        tags: data.tags,
        deliverables: data.deliverables,
        guidelines: data.guidelines,
        externalLinks: data.externalLinks
          ? (data.externalLinks as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        shotList: data.shotList
          ? (data.shotList as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        coverImageUrl: data.coverImageUrl,
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        createdById: user.id,
      },
    });

    revalidateTemplatePaths();
    return {
      success: "Template created successfully.",
      templateId: template.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create template.";
    return { error: message };
  }
}

export async function updateBriefTemplate(
  rawInput: unknown
): Promise<BriefTemplateActionState> {
  try {
    await requireRole(UserRole.MANAGER);

    const parsed = updateBriefTemplateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid template data.",
      };
    }

    const data: UpdateBriefTemplateInput = parsed.data;

    const existing = await prisma.briefTemplate.findUnique({
      where: { id: data.id },
    });

    if (!existing) {
      return { error: "Template not found." };
    }

    if ((data.coverImageUrl && !isManagedTemplateFile(data.coverImageUrl)) ||
        (data.attachmentUrl && !isManagedTemplateFile(data.attachmentUrl, true))) {
      return { error: "Template files must come from the authorized private upload flow." };
    }

    await prisma.briefTemplate.update({
      where: { id: data.id },
      data: {
        title: data.title,
        summary: data.summary,
        category: data.category,
        tags: data.tags,
        deliverables: data.deliverables,
        guidelines: data.guidelines,
        externalLinks: data.externalLinks
          ? (data.externalLinks as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        shotList: data.shotList
          ? (data.shotList as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        coverImageUrl: data.coverImageUrl,
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
      },
    });

    await Promise.all([
      deleteReplacedTemplateFile(existing.coverImageUrl, data.coverImageUrl),
      deleteReplacedTemplateFile(existing.attachmentUrl, data.attachmentUrl),
    ]);

    revalidateTemplatePaths();
    return {
      success: "Template updated successfully.",
      templateId: data.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update template.";
    return { error: message };
  }
}

export async function archiveBriefTemplate(
  rawInput: unknown
): Promise<BriefTemplateActionState> {
  try {
    await requireRole(UserRole.MANAGER);

    const parsed = archiveBriefTemplateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { error: "Invalid template identifier." };
    }

    const existing = await prisma.briefTemplate.findUnique({
      where: { id: parsed.data.id },
    });

    if (!existing) {
      return { error: "Template not found." };
    }

    await prisma.briefTemplate.update({
      where: { id: parsed.data.id },
      data: { isArchived: true },
    });

    revalidateTemplatePaths();
    return {
      success: "Template archived successfully.",
      templateId: parsed.data.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to archive template.";
    return { error: message };
  }
}

export async function unarchiveBriefTemplate(
  rawInput: unknown
): Promise<BriefTemplateActionState> {
  try {
    await requireRole(UserRole.MANAGER);

    const parsed = archiveBriefTemplateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { error: "Invalid template identifier." };
    }

    const existing = await prisma.briefTemplate.findUnique({
      where: { id: parsed.data.id },
    });

    if (!existing) {
      return { error: "Template not found." };
    }

    await prisma.briefTemplate.update({
      where: { id: parsed.data.id },
      data: { isArchived: false },
    });

    revalidateTemplatePaths();
    return {
      success: "Template restored successfully.",
      templateId: parsed.data.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to restore template.";
    return { error: message };
  }
}

export async function convertBriefToTemplate(
  rawInput: unknown
): Promise<BriefTemplateActionState> {
  try {
    const user = await requireRole(UserRole.MANAGER);

    const parsed = convertBriefToTemplateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid conversion request.",
      };
    }

    const { briefId, title, category, tags } = parsed.data;

    const brief = await prisma.creativeBrief.findUnique({
      where: { id: briefId },
      include: {
        project: {
          select: { id: true, managerId: true },
        },
      },
    });

    if (!brief) {
      return { error: "Source brief not found." };
    }

    if (brief.project.managerId !== user.id) {
      return { error: "You can only convert briefs from projects you manage." };
    }

    if (brief.status === BriefStatus.DRAFT) {
      return { error: "Draft briefs cannot be converted into templates. Review or approve the brief first." };
    }

    // Reset shot statuses to PLANNED for the template
    const rawShots = Array.isArray(brief.shotList)
      ? (brief.shotList as unknown as ShotItem[])
      : [];
    const templateShots = rawShots.map((shot) => ({
      ...shot,
      status: "PLANNED",
    }));

    const externalLinks = brief.externalUrl
      ? [{ label: "Original Reference", url: brief.externalUrl }]
      : [];

    const template = await prisma.briefTemplate.create({
      data: {
        title,
        summary: brief.summary,
        category,
        tags: tags.length > 0 ? tags : brief.tags,
        deliverables: brief.deliverables,
        guidelines: brief.guidelines,
        externalLinks: externalLinks.length > 0
          ? (externalLinks as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        shotList: templateShots.length > 0
          ? (templateShots as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        attachmentUrl: brief.fileUrl,
        attachmentName: brief.fileName,
        sourceBriefId: brief.id,
        createdById: user.id,
      },
    });

    revalidateTemplatePaths();
    return {
      success: "Brief converted into reusable template successfully.",
      templateId: template.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to convert brief into template.";
    return { error: message };
  }
}

export async function instantiateBriefFromTemplate(
  rawInput: unknown
): Promise<BriefTemplateActionState> {
  try {
    const user = await requireRole(UserRole.MANAGER);

    const parsed = instantiateBriefFromTemplateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid instantiation parameters.",
      };
    }

    const { templateId, target } = parsed.data;

    const template = await prisma.briefTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return { error: "Template not found." };
    }

    if (template.isArchived) {
      return { error: "Cannot instantiate an archived template. Please restore it first." };
    }

    const result = await prisma.$transaction(async (tx) => {
      let resolvedProjectId: string;
      let isPrimary = false;

      if (target.type === "NEW_PROJECT") {
        // Validate client is active and was invited by manager
        const clientUser = await tx.user.findFirst({
          where: {
            id: target.clientId,
            role: UserRole.CLIENT,
            status: UserStatus.ACTIVE,
            acceptedInvitation: { invitedById: user.id },
          },
        });

        if (!clientUser) {
          throw new Error("Specified client is not an active client invited by you.");
        }

        const project = await tx.project.create({
          data: {
            name: target.projectName,
            description: target.description ?? null,
            managerId: user.id,
            clientId: target.clientId,
          },
        });

        resolvedProjectId = project.id;
        isPrimary = true;
      } else {
        // Existing project: verify manager ownership
        const existingProject = await tx.project.findFirst({
          where: {
            id: target.projectId,
            managerId: user.id,
          },
        });

        if (!existingProject) {
          throw new Error("Project not found or you are not authorized to manage it.");
        }

        resolvedProjectId = existingProject.id;
        isPrimary = target.isPrimary ?? false;

        if (isPrimary) {
          await tx.creativeBrief.updateMany({
            where: { projectId: resolvedProjectId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
      }

      // Deep clone shot list with fresh UUIDs and PLANNED status
      const rawShots = Array.isArray(template.shotList)
        ? (template.shotList as unknown as ShotItem[])
        : [];
      const clonedShots = rawShots.map((shot) => ({
        ...shot,
        id: crypto.randomUUID(),
        status: "PLANNED",
      }));

      // Map primary external URL
      let externalUrl: string | null = null;
      if (Array.isArray(template.externalLinks) && template.externalLinks.length > 0) {
        const firstLink = template.externalLinks[0] as { url?: string };
        if (firstLink && typeof firstLink.url === "string") {
          externalUrl = firstLink.url;
        }
      }

      const briefTitle =
        target.title && target.title.trim() !== ""
          ? target.title.trim()
          : template.title;

      const newBrief = await tx.creativeBrief.create({
        data: {
          title: briefTitle,
          summary: template.summary,
          status: BriefStatus.DRAFT,
          isPrimary,
          deliverables: template.deliverables,
          guidelines: template.guidelines,
          shotList: clonedShots.length > 0
            ? (clonedShots as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          externalUrl,
          fileUrl: template.attachmentUrl,
          fileName: template.attachmentName,
          tags: template.tags,
          templateId: template.id,
          projectId: resolvedProjectId,
          createdById: user.id,
        },
      });

      // Increment template usage metric
      await tx.briefTemplate.update({
        where: { id: template.id },
        data: {
          usageCount: { increment: 1 },
        },
      });

      return {
        briefId: newBrief.id,
        projectId: resolvedProjectId,
      };
    });

    revalidateTemplatePaths();
    return {
      success: "Brief instantiated from template successfully.",
      briefId: result.briefId,
      projectId: result.projectId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to instantiate brief from template.";
    return { error: message };
  }
}
