import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { StudioArea, StudioAccessLevel } from "@/generated/prisma/client";
import { getStudioAccessContext, hasStudioAccess } from "@/lib/studio-access";

const maxFileSize = 25 * 1024 * 1024;
const allowedContentTypes = [
  "image/svg+xml", "image/png", "image/jpeg", "image/webp", "application/pdf",
  "font/otf", "font/ttf", "font/woff", "font/woff2", "application/zip",
  "application/x-zip-compressed", "application/postscript",
  "application/illustrator", "image/vnd.adobe.photoshop",
];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const context = await getStudioAccessContext(session.user.id, session.user.role);
  if (!context || !hasStudioAccess(context, StudioArea.BRAND_ASSETS, StudioAccessLevel.MANAGE)) {
    return Response.json({ error: "Brand asset management access is required." }, { status: 403 });
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
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload could not be authorized.";
    return Response.json({ error: message }, { status: 400 });
  }
}
