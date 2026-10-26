import { get } from "@vercel/blob";
import { auth } from "@/auth";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== UserRole.MANAGER && session.user.role !== UserRole.WORKER)) {
    return new Response("Not found", { status: 404 });
  }
  const { assetId } = await params;
  const asset = await prisma.brandAsset.findUnique({
    where: { id: assetId },
    select: { fileUrl: true, fileKey: true, fileMime: true, fileName: true },
  });
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
