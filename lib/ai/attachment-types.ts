export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENT_BATCH_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_EXTRACTED_TEXT_CHARS = 100_000;

export const ALLOWED_MIME_TYPES = [
  // Images
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // Spreadsheets
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  // Documents
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
];

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  isImage: boolean;
  dataUrl?: string;
  extractedText?: string;
}
