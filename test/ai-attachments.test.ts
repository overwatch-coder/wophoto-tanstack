import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import {
  processUploadedFile,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/lib/ai/attachments";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isCopilotEnabled: vi.fn(() => true),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/ai/copilot-access", () => ({ isCopilotEnabledForUser: mocks.isCopilotEnabled }));

import { POST } from "@/app/api/chat/attachments/route";

describe("AI Attachment Processing (lib/ai/attachments)", () => {
  it("enforces the 10MB maximum file size limit", async () => {
    const oversizedBuffer = Buffer.alloc(MAX_ATTACHMENT_SIZE_BYTES + 1024);
    await expect(
      processUploadedFile(oversizedBuffer, "large_file.png", "image/png")
    ).rejects.toThrow(/exceeds the 10MB maximum upload limit/);
  });

  it("processes images into base64 data URLs for native vision", async () => {
    const rawData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const result = await processUploadedFile(rawData, "screenshot.png", "image/png");

    expect(result.isImage).toBe(true);
    expect(result.name).toBe("screenshot.png");
    expect(result.dataUrl).toBe(`data:image/png;base64,${rawData.toString("base64")}`);
    expect(result.extractedText).toBeUndefined();
  });

  it("rejects a file whose MIME type does not match its extension", async () => {
    const buffer = Buffer.from("Name,Value\nScene,1");
    await expect(
      processUploadedFile(buffer, "brief.csv", "image/png")
    ).rejects.toThrow(/does not match the extension/);
  });

  it("rejects image files with invalid signatures", async () => {
    await expect(
      processUploadedFile(Buffer.from("not an image"), "brief.png", "image/png")
    ).rejects.toThrow(/not a valid PNG image/);
  });

  it("parses CSV spreadsheets into tabular text", async () => {
    const csvContent = "Item,Retoucher,Deadline\nColor Correction,Alex,2026-10-30\nRetouching,Elena,2026-10-31";
    const csvBuffer = Buffer.from(csvContent, "utf-8");

    const result = await processUploadedFile(csvBuffer, "tasks.csv", "text/csv");
    expect(result.isImage).toBe(false);
    expect(result.name).toBe("tasks.csv");
    expect(result.extractedText).toContain("Color Correction,Alex");
    expect(result.extractedText).toContain("Retouching,Elena");
  });

  it("parses multi-sheet Excel (.xlsx) workbooks", async () => {
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["Shot", "Model", "Deliverable"],
      ["Shot 1", "Maya", "Hero Banner"],
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["Notes", "Revision"],
      ["High contrast", "Final Approval"],
    ]);

    XLSX.utils.book_append_sheet(wb, ws1, "ShotList");
    XLSX.utils.book_append_sheet(wb, ws2, "Revisions");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = await processUploadedFile(
      xlsxBuffer,
      "campaign_shots.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    expect(result.isImage).toBe(false);
    expect(result.extractedText).toContain("--- Sheet: ShotList ---");
    expect(result.extractedText).toContain("Shot 1,Maya,Hero Banner");
    expect(result.extractedText).toContain("--- Sheet: Revisions ---");
    expect(result.extractedText).toContain("High contrast,Final Approval");
  });

  it("parses plain text and markdown documents", async () => {
    const notes = "# Creative Brief\nDeliver 5 editorial beauty images with high skin detail.";
    const buffer = Buffer.from(notes, "utf-8");

    const result = await processUploadedFile(buffer, "brief.md", "text/markdown");
    expect(result.isImage).toBe(false);
    expect(result.name).toBe("brief.md");
    expect(result.extractedText).toBe(notes);
  });

  it("rejects unsupported file formats cleanly", async () => {
    const buffer = Buffer.from("some binary executable payload");
    await expect(
      processUploadedFile(buffer, "malicious.exe", "application/x-msdownload")
    ).rejects.toThrow(/Unsupported file format for "malicious.exe"/);
  });
});

describe("AI Attachments Upload Endpoint (app/api/chat/attachments/route)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when the user is not authenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const formData = new FormData();
    formData.append("file", new File(["test"], "test.txt", { type: "text/plain" }));

    const req = new Request("http://localhost/api/chat/attachments", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when content-type is not multipart/form-data", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "MANAGER" } });

    const req = new Request("http://localhost/api/chat/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "none" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("multipart/form-data");
  });

  it("successfully uploads and parses attached files for authenticated users", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "MANAGER" } });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["Task,Status\nShoot,Done"], "schedule.csv", { type: "text/csv" })
    );

    const req = new Request("http://localhost/api/chat/attachments", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].name).toBe("schedule.csv");
    expect(body.attachments[0].isImage).toBe(false);
    expect(body.attachments[0].extractedText).toContain("Shoot,Done");
  });

  it("rejects attachment batches above the per message file limit", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "MANAGER" } });

    const formData = new FormData();
    for (let i = 0; i < 6; i += 1) {
      formData.append("files", new File([`Task ${i}`], `task-${i}.txt`, { type: "text/plain" }));
    }

    const req = new Request("http://localhost/api/chat/attachments", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("no more than 5 files");
  });
});
