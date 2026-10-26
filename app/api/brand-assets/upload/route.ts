import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { UserRole } from "@/generated/prisma/client";

const maxFileSize = 25 * 1024 * 1024;
const allowedContentTypes = [
  "image/svg+xml", "image/png", "image/jpeg", "image/webp", "application/pdf",
  "font/otf", "font/ttf", "font/woff", "font/woff2", "application/zip",
  "application/x-zip-compressed", "application/postscript",
  "application/illustrator", "image/vnd.adobe.photoshop",
];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== UserRole.MANAGER) {
    return NextResponse.json({ error: "Only managers can upload brand assets." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("brand-assets/") || pathname.includes("..")) {
          throw new Error("Invalid brand asset upload path.");
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
