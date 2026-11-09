import { get } from "@vercel/blob";
import { auth } from "@/auth";
import { StudioArea, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getStudioAccessContext, hasStudioAccess } from "@/lib/studio-access";

export async function GET(
  _request: Request,
  { params }: { params: { assetId: string } },
) {
  const session = await auth();
  const allowedRoles: UserRole[] = [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER];
  if (!session?.user?.id || !allowedRoles.includes(session.user.role)) {
    return new Response("Not found", { status: 404 });
  }
  const { assetId } = params;
  const context = await getStudioAccessContext(session.user.id, session.user.role);
  const invitation = !context && session.user.role === UserRole.WORKER
    ? await prisma.invitation.findFirst({ where: { acceptedUserId: session.user.id, status: "USED" }, orderBy: { usedAt: "desc" }, select: { studioId: true } })
    : null;
  const studioId = context?.studioId ?? invitation?.studioId;
  if (!studioId) return new Response("Not found", { status: 404 });
  const asset = await prisma.brandAsset.findFirst({
    where: { id: assetId, studioId },
    select: { fileUrl: true, fileKey: true, fileMime: true, fileName: true, studioId: true },
  });
  if (context && !hasStudioAccess(context, StudioArea.BRAND_ASSETS)) return new Response("Not found", { status: 404 });
  if (!asset?.fileUrl || !asset.fileKey?.startsWith("brand-assets/")) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const url = new URL(asset.fileUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".private.blob.vercel-storage.com") || decodeURIComponent(url.pathname.slice(1)) !== asset.fileKey) {
      return new Response("Not found", { status: 404 });
    }
    const blob = await get(asset.fileUrl, { access: "private" });
    if (!blob || blob.statusCode !== 200) return new Response("Not found", { status: 404 });
    const filename = (asset.fileName || "brand-asset").replace(/[\r\n"\\]/g, "_");
    return new Response(blob.stream, {
      headers: {
        "Content-Type": asset.fileMime || blob.blob.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
        ETag: blob.blob.etag,
      },
    });
  } catch (error) {
    console.error("Private brand asset read failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return new Response("Asset unavailable", { status: 502 });
  }
}
