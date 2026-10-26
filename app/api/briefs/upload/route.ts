import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { StudioArea, StudioAccessLevel } from "@/generated/prisma/client";
import { getStudioAccessContext, hasStudioAccess } from "@/lib/studio-access";

const maxFileSize = 25 * 1024 * 1024;
const allowedContentTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const context = await getStudioAccessContext(session.user.id, session.user.role);
  if (!context || !hasStudioAccess(context, StudioArea.BRIEFS, StudioAccessLevel.MANAGE)) {
    return NextResponse.json({ error: "Brief management access is required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("briefs/") || pathname.includes("..")) {
          throw new Error("Invalid creative brief upload path.");
        }
        return {
          access: "private",
          addRandomSuffix: true,
          allowedContentTypes,
          maximumSizeInBytes: maxFileSize,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload could not be authorized.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
