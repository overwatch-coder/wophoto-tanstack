import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { isCopilotEnabledForUser } from "@/lib/ai/copilot-access";
import {
  processUploadedFile,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_BATCH_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  type ExtractedAttachmentResult,
} from "@/lib/ai/attachments";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isCopilotEnabledForUser(session.user.id, session.user.role))) {
      return NextResponse.json({ error: "Copilot is currently disabled for your account by your studio manager." }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 },
      );
    }

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_ATTACHMENT_BATCH_SIZE_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "The total attachment upload exceeds the 20MB limit." }, { status: 413 });
    }

    const formData = await req.formData();
    const files = formData.getAll("file") as File[];
    const allFiles = files.length > 0 ? files : (formData.getAll("files") as File[]);

    if (!allFiles || allFiles.length === 0) {
      return NextResponse.json(
        { error: "No files uploaded. Please attach at least one file." },
        { status: 400 },
      );
    }
    if (allFiles.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return NextResponse.json({ error: `Attach no more than ${MAX_ATTACHMENTS_PER_MESSAGE} files at once.` }, { status: 400 });
    }

    const validFiles = allFiles.filter((file): file is File => typeof file !== "string" && Boolean(file.name));
    const totalSize = validFiles.reduce((total, file) => total + file.size, 0);
    if (totalSize > MAX_ATTACHMENT_BATCH_SIZE_BYTES) {
      return NextResponse.json({ error: "The total attachment upload exceeds the 20MB limit." }, { status: 413 });
    }

    const results: ExtractedAttachmentResult[] = [];

    for (const file of validFiles) {

      if (file.size === 0) {
        return NextResponse.json(
          { error: `File "${file.name}" is empty (0 bytes).` },
          { status: 400 },
        );
      }

      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `File "${file.name}" exceeds the 10MB upload limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
          },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        const extracted = await processUploadedFile(buffer, file.name, file.type);
        results.push(extracted);
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : `Failed to process attachment "${file.name}".`,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      attachments: results,
    });
  } catch (error) {
    console.error("AI Attachment Upload Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while processing the file attachment.",
      },
      { status: 500 },
    );
  }
}
