import { get } from "@vercel/blob";
import { auth } from "@/auth";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function isManagedBriefTemplateBlob(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const pathname = decodeURIComponent(url.pathname.slice(1));
    return url.protocol === "https:" &&
      url.hostname.endsWith(".private.blob.vercel-storage.com") &&
      (pathname.startsWith("brief-templates/") || pathname.startsWith("briefs/"));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== UserRole.MANAGER && session.user.role !== UserRole.WORKER)) {
    return new Response("Not found", { status: 404 });
  }

  const fileUrl = new URL(request.url).searchParams.get("url");
  if (!fileUrl || !isManagedBriefTemplateBlob(fileUrl)) {
    return new Response("Not found", { status: 404 });
  }

  if (session.user.role === UserRole.WORKER) {
    const referencedByActiveTemplate = await prisma.briefTemplate.count({
      where: {
        isArchived: false,
        OR: [{ coverImageUrl: fileUrl }, { attachmentUrl: fileUrl }],
      },
    });
    if (!referencedByActiveTemplate) return new Response("Not found", { status: 404 });
  }

  try {
    const blob = await get(fileUrl, { access: "private" });
    if (!blob || blob.statusCode !== 200) return new Response("Not found", { status: 404 });
    const filename = decodeURIComponent(new URL(fileUrl).pathname.split("/").at(-1) || "brief-template-file").replace(/[\r\n"\\]/g, "_");
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(blob.stream, {
      headers: {
        "Content-Type": blob.blob.contentType || "application/octet-stream",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
        ETag: blob.blob.etag,
      },
    });
  } catch (error) {
    console.error("Private brief template file read failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response("File unavailable", { status: 502 });
  }
}
