import { get } from "@vercel/blob";
import { auth } from "@/auth";
import { BriefStatus, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { workerCanAccessBrief } from "@/lib/briefs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ briefId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Not found", { status: 404 });
  const { briefId } = await params;
  const brief = await prisma.creativeBrief.findUnique({
    where: { id: briefId },
    select: {
      fileUrl: true,
      fileKey: true,
      fileName: true,
      fileMime: true,
      status: true,
      project: { select: { clientId: true, managerId: true } },
    },
  });
  if (!brief?.fileUrl || !brief.fileKey?.startsWith("briefs/")) {
    return new Response("Not found", { status: 404 });
  }
  const role = session.user.role;
  const allowed = (role === UserRole.MANAGER && brief.project.managerId === session.user.id) ||
    (role === UserRole.CLIENT && brief.project.clientId === session.user.id && brief.status !== BriefStatus.DRAFT) ||
    (role === UserRole.WORKER && await workerCanAccessBrief(briefId, session.user.id));
  if (!allowed) return new Response("Not found", { status: 404 });
  try {
    const url = new URL(brief.fileUrl);
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname.slice(1));
    } catch {
      return new Response("Not found", { status: 404 });
    }
    if (url.protocol !== "https:" || !url.hostname.endsWith(".private.blob.vercel-storage.com") || pathname !== brief.fileKey) {
      return new Response("Not found", { status: 404 });
    }
    const blob = await get(brief.fileUrl, { access: "private" });
    if (!blob || blob.statusCode !== 200) return new Response("Not found", { status: 404 });
    const filename = (brief.fileName || "creative-brief-attachment").replace(/[\r\n"\\]/g, "_");
    return new Response(blob.stream, {
      headers: {
        "Content-Type": brief.fileMime || blob.blob.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
        ETag: blob.blob.etag,
      },
    });
  } catch (error) {
    console.error("Private brief attachment read failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return new Response("Attachment unavailable", { status: 502 });
  }
}
