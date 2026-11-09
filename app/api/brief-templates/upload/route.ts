import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { StudioArea, StudioAccessLevel } from "@/generated/prisma/client";
import { getStudioAccessContext, hasStudioAccess } from "@/lib/studio-access";

const maxImageBytes = 10 * 1024 * 1024;
const maxAttachmentBytes = 25 * 1024 * 1024;
const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const attachmentTypes = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const context = await getStudioAccessContext(session.user.id, session.user.role);
  if (!context || !hasStudioAccess(context, StudioArea.BRIEFS, StudioAccessLevel.MANAGE)) {
    return Response.json({ error: "Brief management access is required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (pathname.includes("..") || pathname.startsWith("/") || pathname.includes("\\")) {
          throw new Error("Invalid brief template upload path.");
        }
        if (pathname.startsWith("brief-templates/covers/")) {
          return {
            access: "private",
            addRandomSuffix: true,
            allowedContentTypes: imageTypes,
            maximumSizeInBytes: maxImageBytes,
            tokenPayload: JSON.stringify({ userId: session.user.id }),
          };
        }
        if (pathname.startsWith("brief-templates/attachments/")) {
          return {
            access: "private",
            addRandomSuffix: true,
            allowedContentTypes: attachmentTypes,
            maximumSizeInBytes: maxAttachmentBytes,
            tokenPayload: JSON.stringify({ userId: session.user.id }),
          };
        }
        throw new Error("Invalid brief template upload path.");
      },
    });
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload could not be authorized.";
    return Response.json({ error: message }, { status: 400 });
  }
}
