
import * as XLSX from "xlsx";
import * as mammoth from "mammoth";
import { extractText as extractPdfText } from "unpdf";
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_ATTACHMENT_BATCH_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  ALLOWED_MIME_TYPES,
  type ChatAttachment,
} from "./attachment-types";

export {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_BATCH_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  ALLOWED_MIME_TYPES,
};
export type ExtractedAttachmentResult = ChatAttachment;

export async function processUploadedFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ExtractedAttachmentResult> {
  const size = buffer.length;

  if (size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(
      `File "${filename}" exceeds the 10MB maximum upload limit (${(size / (1024 * 1024)).toFixed(1)}MB).`
    );
  }

  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const lowerName = filename.toLowerCase();
  const extension = lowerName.split(".").pop() ?? "";
  const expectedMimeTypes: Record<string, string[]> = {
    png: ["image/png"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    webp: ["image/webp"],
    gif: ["image/gif"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    xls: ["application/vnd.ms-excel"],
    csv: ["text/csv"],
    pdf: ["application/pdf"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    txt: ["text/plain"],
    md: ["text/markdown", "text/plain"],
  };
  if (!expectedMimeTypes[extension]) {
    throw new Error(
      `Unsupported file format for "${filename}". Please upload images (PNG, JPG, WebP), spreadsheets (XLSX, CSV), PDFs, or Word documents (.docx).`
    );
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error(`Unsupported file type for "${filename}".`);
  }
  if (!expectedMimeTypes[extension]?.includes(mimeType)) {
    throw new Error(`The file type does not match the extension for "${filename}".`);
  }

  const hasPrefix = (...bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
  if (extension === "png" && !hasPrefix(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    throw new Error(`The uploaded file "${filename}" is not a valid PNG image.`);
  }
  if (extension === "jpg" || extension === "jpeg") {
    if (!hasPrefix(0xff, 0xd8, 0xff)) throw new Error(`The uploaded file "${filename}" is not a valid JPEG image.`);
  }
  if (extension === "webp" && !(buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP")) {
    throw new Error(`The uploaded file "${filename}" is not a valid WebP image.`);
  }
  if (extension === "gif" && !(buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")) {
    throw new Error(`The uploaded file "${filename}" is not a valid GIF image.`);
  }
  if (extension === "pdf" && buffer.toString("ascii", 0, 5) !== "%PDF-") {
    throw new Error(`The uploaded file "${filename}" is not a valid PDF document.`);
  }
  if ((extension === "xlsx" || extension === "docx") && !hasPrefix(0x50, 0x4b, 0x03, 0x04)) {
    throw new Error(`The uploaded file "${filename}" is not a valid ${extension.toUpperCase()} document.`);
  }
  if (extension === "xls" && !hasPrefix(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) {
    throw new Error(`The uploaded file "${filename}" is not a valid XLS spreadsheet.`);
  }

  // 1. Process Images (Native Vision)
  if (
    mimeType.startsWith("image/")
  ) {
    const base64 = buffer.toString("base64");
    const resolvedMime = mimeType.startsWith("image/") ? mimeType : "image/jpeg";
    const dataUrl = `data:${resolvedMime};base64,${base64}`;

    return {
      id,
      name: filename,
      size,
      type: resolvedMime,
      isImage: true,
      dataUrl,
    };
  }

  // 2. Process Spreadsheets (Excel .xlsx, .xls, .csv)
  if (
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".csv") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  ) {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetTexts: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const csvContent = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        if (csvContent.trim()) {
          sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csvContent.slice(0, MAX_EXTRACTED_TEXT_CHARS)}`);
        }
        if (sheetTexts.join("\n\n").length >= MAX_EXTRACTED_TEXT_CHARS) break;
      }

      const extractedText = (sheetTexts.join("\n\n") || "Empty spreadsheet.").slice(0, MAX_EXTRACTED_TEXT_CHARS);
      return {
        id,
        name: filename,
        size,
        type: mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        isImage: false,
        extractedText,
      };
    } catch (err) {
      console.error("Spreadsheet parsing failed:", err);
      throw new Error(`Failed to parse spreadsheet "${filename}". Ensure the file is not corrupted.`);
    }
  }

  // 3. Process PDFs
  if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
    try {
      const { text } = await extractPdfText(new Uint8Array(buffer));
      const extractedText = (Array.isArray(text) ? text.join("\n") : String(text || "No readable text found in PDF.")).slice(0, MAX_EXTRACTED_TEXT_CHARS);

      return {
        id,
        name: filename,
        size,
        type: "application/pdf",
        isImage: false,
        extractedText: extractedText.trim(),
      };
    } catch (err) {
      console.error("PDF parsing failed:", err);
      throw new Error(`Failed to extract text from PDF "${filename}".`);
    }
  }

  // 4. Process Word Documents (.docx)
  if (
    lowerName.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return {
        id,
        name: filename,
        size,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isImage: false,
        extractedText: (value.trim() || "No readable text found in document.").slice(0, MAX_EXTRACTED_TEXT_CHARS),
      };
    } catch (err) {
      console.error("Word document parsing failed:", err);
      throw new Error(`Failed to extract text from Word document "${filename}".`);
    }
  }

  // 5. Plain Text / Markdown
  if (
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    mimeType.startsWith("text/")
  ) {
    const text = buffer.toString("utf-8");
    return {
      id,
      name: filename,
      size,
      type: "text/plain",
      isImage: false,
      extractedText: text.trim().slice(0, MAX_EXTRACTED_TEXT_CHARS),
    };
  }

  throw new Error(
    `Unsupported file format for "${filename}". Please upload images (PNG, JPG, WebP), spreadsheets (XLSX, CSV), PDFs, or Word documents (.docx).`
  );
}
