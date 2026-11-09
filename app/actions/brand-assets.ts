
import { del } from "@vercel/blob";
import { Prisma, UserRole } from "@/generated/prisma/client";
import { requireStudioManagerArea } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import {
  createBrandAssetSchema,
  createBrandAssetsSchema,
  updateBrandAssetSchema,
  deleteBrandAssetSchema,
  type CreateBrandAssetInput,
  type UpdateBrandAssetInput,
} from "@/lib/validation/brand-assets";
import { getBrandAssets } from "@/lib/brand-assets";

export async function queryBrandAssets(rawQuery: Record<string, unknown>) {
  const result = await getBrandAssets(rawQuery);
  return {
    ...result,
    assets: result.assets.map((asset) => ({
      ...asset,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    })),
  };
}

export type BrandAssetActionState = {
  error?: string;
  success?: string;
  assetId?: string;
  assetIds?: string[];
};

function revalidateBrandAssets() {
  // TanStack Router invalidates route queries on navigation/mutation
}

function isManagedBrandAssetFile(fileUrl: string | null | undefined, fileKey: string | null | undefined) {
  if (!fileUrl || !fileKey?.startsWith("brand-assets/")) return false;
  try {
    const url = new URL(fileUrl);
    return url.protocol === "https:" &&
      url.hostname.endsWith(".private.blob.vercel-storage.com") &&
      decodeURIComponent(url.pathname.slice(1)) === fileKey;
  } catch {
    return false;
  }
}

async function deleteManagedBlob(fileUrl: string | null | undefined, fileKey: string | null | undefined) {
  if (!isManagedBrandAssetFile(fileUrl, fileKey)) return;
  try {
    const referenced = await prisma.brandAsset.count({ where: { fileUrl } });
    if (referenced > 0) return;
    await del(fileUrl!);
  } catch {
    // Storage cleanup is best effort after the database transaction succeeds.
  }
}

export async function createBrandAsset(
  rawInput: unknown
): Promise<BrandAssetActionState> {
  try {
    const { manager, context } = await requireStudioManagerArea("BRAND_ASSETS");

    const parsed = createBrandAssetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid brand asset data.",
      };
    }

    const data: CreateBrandAssetInput = parsed.data;

    if (data.fileUrl && !isManagedBrandAssetFile(data.fileUrl, data.fileKey)) {
      return { error: "Uploaded files must come from the authorized brand asset upload flow." };
    }
    if (data.fileUrl && await prisma.brandAsset.count({ where: { fileUrl: data.fileUrl } }) > 0) {
      return { error: "That uploaded file is already attached to another brand asset." };
    }

    let finalClientId = data.clientId;

    // Client-inheritance protection invariant:
    // If projectId is specified, asset MUST inherit the project's clientId.
    if (data.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        select: { id: true, clientId: true },
      });

      if (!project) {
        return { error: "The associated project was not found." };
      }

      finalClientId = project.clientId;
    } else if (finalClientId) {
      // If standalone client asset, verify client user exists and is a client
      const clientUser = await prisma.user.findFirst({
        where: { id: finalClientId, role: UserRole.CLIENT },
        select: { id: true },
      });

      if (!clientUser) {
        return { error: "The selected client was not found." };
      }
    }

    const asset = await prisma.brandAsset.create({
      data: {
        title: data.title,
        description: data.description,
        assetType: data.assetType,
        fileUrl: data.fileUrl,
        fileKey: data.fileKey,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileMime: data.fileMime,
        externalUrl: data.externalUrl,
        colorPalette: data.colorPalette
          ? (data.colorPalette as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        tags: data.tags || [],
        clientId: finalClientId,
        projectId: data.projectId,
        createdById: manager.actorId,
        studioId: context.studioId,
      },
      select: { id: true },
    });

    revalidateBrandAssets();

    return {
      success: "Brand asset created successfully.",
      assetId: asset.id,
    };
  } catch (err) {
    console.error("Error in createBrandAsset:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to create brand asset.",
    };
  }
}

export async function createBrandAssets(
  rawInput: unknown
): Promise<BrandAssetActionState> {
  try {
    const { manager, context } = await requireStudioManagerArea("BRAND_ASSETS");
    const parsed = createBrandAssetsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid brand asset data." };
    }

    const items = parsed.data;
    if (items.some((item) => !item.fileUrl || !item.fileKey)) {
      return { error: "Every batch item must include an uploaded file." };
    }
    if (items.some((item) => !isManagedBrandAssetFile(item.fileUrl, item.fileKey))) {
      return { error: "Uploaded files must come from the authorized brand asset upload flow." };
    }

    const fileUrls = items.map((item) => item.fileUrl!);
    if (new Set(fileUrls).size !== fileUrls.length) {
      return { error: "Each brand asset must use a different uploaded file." };
    }
    const alreadyAttached = await prisma.brandAsset.count({
      where: { fileUrl: { in: fileUrls } },
    });
    if (alreadyAttached) {
      return { error: "One or more uploaded files are already attached to a brand asset." };
    }

    const projectId = items[0].projectId;
    const clientId = items[0].clientId;
    if (items.some((item) => item.projectId !== projectId || item.clientId !== clientId)) {
      return { error: "A batch must use the same client and project scope for every asset." };
    }

    let finalClientId = clientId;
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, clientId: true },
      });
      if (!project) return { error: "The associated project was not found." };
      finalClientId = project.clientId;
    } else if (finalClientId) {
      const client = await prisma.user.findFirst({
        where: { id: finalClientId, role: UserRole.CLIENT },
        select: { id: true },
      });
      if (!client) return { error: "The selected client was not found." };
    }

    try {
      const assets = await prisma.$transaction(
        items.map((item) =>
          prisma.brandAsset.create({
            data: {
              title: item.title,
              description: item.description,
              assetType: item.assetType,
              fileUrl: item.fileUrl,
              fileKey: item.fileKey,
              fileName: item.fileName,
              fileSize: item.fileSize,
              fileMime: item.fileMime,
              tags: item.tags,
              clientId: finalClientId,
              projectId,
              createdById: manager.actorId,
              studioId: context.studioId,
            },
            select: { id: true },
          })
        )
      );
      revalidateBrandAssets();
      return {
        success: `${assets.length} brand ${assets.length === 1 ? "asset" : "assets"} created successfully.`,
        assetIds: assets.map((asset) => asset.id),
      };
    } catch {
      await Promise.allSettled(items.map((item) => deleteManagedBlob(item.fileUrl, item.fileKey)));
      return { error: "The asset batch could not be saved. Your uploaded files were removed; please try again." };
    }
  } catch (err) {
    console.error("Error in createBrandAssets:", err);
    return { error: err instanceof Error ? err.message : "Failed to create brand assets." };
  }
}

export async function discardUnusedBrandAssetUploads(
  rawFiles: unknown
): Promise<void> {
  await requireStudioManagerArea("BRAND_ASSETS");
  if (!Array.isArray(rawFiles) || rawFiles.length > 20) return;
  const files = rawFiles.filter(
    (item): item is { fileUrl: string; fileKey: string } =>
      typeof item === "object" && item !== null &&
      typeof (item as { fileUrl?: unknown }).fileUrl === "string" &&
      typeof (item as { fileKey?: unknown }).fileKey === "string"
  );
  await Promise.allSettled(
    files.map(({ fileUrl, fileKey }) => deleteManagedBlob(fileUrl, fileKey))
  );
}

export async function updateBrandAsset(
  rawInput: unknown
): Promise<BrandAssetActionState> {
  try {
    const { context } = await requireStudioManagerArea("BRAND_ASSETS");

    const parsed = updateBrandAssetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid brand asset data.",
      };
    }

    const data: UpdateBrandAssetInput = parsed.data;

    const existing = await prisma.brandAsset.findUnique({
      where: { id: data.id, studioId: context.studioId },
      select: { id: true, fileUrl: true, fileKey: true, fileName: true, fileSize: true, fileMime: true, externalUrl: true, colorPalette: true, projectId: true, clientId: true },
    });

    if (!existing) {
      return { error: "Brand asset not found." };
    }

    const finalFileUrl = data.fileUrl !== undefined ? data.fileUrl : existing.fileUrl;
    const finalFileKey = data.fileKey !== undefined ? data.fileKey : existing.fileKey;
    const finalExternalUrl = data.externalUrl !== undefined ? data.externalUrl : existing.externalUrl;
    const finalPalette = data.colorPalette !== undefined ? data.colorPalette : existing.colorPalette;
    if (!finalFileUrl && !finalExternalUrl && !(Array.isArray(finalPalette) && finalPalette.length)) {
      return { error: "Asset must include an uploaded file, an external link, or at least one color swatch." };
    }
    if (finalFileUrl && !isManagedBrandAssetFile(finalFileUrl, finalFileKey)) {
      return { error: "Uploaded files must come from the authorized brand asset upload flow." };
    }
    if (finalFileUrl && finalFileUrl !== existing.fileUrl && await prisma.brandAsset.count({ where: { fileUrl: finalFileUrl } }) > 0) {
      return { error: "That uploaded file is already attached to another brand asset." };
    }

    let finalClientId = data.clientId !== undefined ? data.clientId : existing.clientId;
    const finalProjectId =
      data.projectId !== undefined ? data.projectId : existing.projectId;

    if (finalProjectId) {
      const project = await prisma.project.findUnique({
        where: { id: finalProjectId },
        select: { id: true, clientId: true },
      });

      if (!project) {
        return { error: "The associated project was not found." };
      }

      finalClientId = project.clientId;
    } else if (finalClientId) {
      const clientUser = await prisma.user.findFirst({
        where: { id: finalClientId, role: UserRole.CLIENT },
        select: { id: true },
      });
      if (!clientUser) return { error: "The selected client was not found." };
    }

    await prisma.brandAsset.update({
      where: { id: data.id, studioId: context.studioId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.assetType !== undefined ? { assetType: data.assetType } : {}),
        ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl } : {}),
        ...(data.fileKey !== undefined ? { fileKey: data.fileKey } : {}),
        ...(data.fileName !== undefined ? { fileName: data.fileName } : {}),
        ...(data.fileSize !== undefined ? { fileSize: data.fileSize } : {}),
        ...(data.fileMime !== undefined ? { fileMime: data.fileMime } : {}),
        ...(data.externalUrl !== undefined
          ? { externalUrl: data.externalUrl }
          : {}),
        ...(data.colorPalette !== undefined
          ? {
              colorPalette: data.colorPalette
                ? (data.colorPalette as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        clientId: finalClientId,
        projectId: finalProjectId,
      },
    });

    if (existing.fileUrl && existing.fileUrl !== finalFileUrl) {
      await deleteManagedBlob(existing.fileUrl, existing.fileKey);
    }

    revalidateBrandAssets();

    return {
      success: "Brand asset updated successfully.",
      assetId: data.id,
    };
  } catch (err) {
    console.error("Error in updateBrandAsset:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to update brand asset.",
    };
  }
}

export async function deleteBrandAsset(
  rawInput: unknown
): Promise<BrandAssetActionState> {
  try {
    const { context } = await requireStudioManagerArea("BRAND_ASSETS");

    const parsed = deleteBrandAssetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid asset ID.",
      };
    }

    const { id } = parsed.data;

    const existing = await prisma.brandAsset.findUnique({
      where: { id, studioId: context.studioId },
      select: { id: true, fileUrl: true, fileKey: true },
    });

    if (!existing) {
      return { error: "Brand asset not found." };
    }

    await prisma.brandAsset.delete({
      where: { id, studioId: context.studioId },
    });
    await deleteManagedBlob(existing.fileUrl, existing.fileKey);

    revalidateBrandAssets();

    return {
      success: "Brand asset deleted successfully.",
      assetId: id,
    };
  } catch (err) {
    console.error("Error in deleteBrandAsset:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to delete brand asset.",
    };
  }
}
