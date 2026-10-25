import { describe, expect, it } from "vitest";
import { WorkRequestStatus, WorkRequestType } from "@/generated/prisma/client";
import { acceptWorkRequestSchema, createWorkRequestSchema, reviewWorkRequestSchema } from "@/lib/validation/work-requests";

describe("work request validation", () => {
  it("requires an owned project reference for existing work requests", () => {
    expect(createWorkRequestSchema.safeParse({ type: WorkRequestType.WORK, title: "Retouch portraits", details: "Please retouch the new portraits.", projectId: "" }).success).toBe(false);
    const valid = createWorkRequestSchema.safeParse({ type: WorkRequestType.WORK, title: "Retouch portraits", details: "Please retouch the new portraits.", projectId: "project-1" });
    expect(valid.success).toBe(true);
  });

  it("accepts a new project request without an existing project", () => {
    const parsed = createWorkRequestSchema.safeParse({ type: WorkRequestType.PROJECT, title: "Spring campaign", details: "We need a new spring campaign photo project.", projectId: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.projectId).toBeNull();
  });

  it("requires worker assignments when accepting a request", () => {
    expect(acceptWorkRequestSchema.safeParse({ requestId: "request-1", workerIds: [], taskTitle: "Initial photography task" }).success).toBe(false);
    expect(acceptWorkRequestSchema.safeParse({ requestId: "request-1", workerIds: ["worker-1"], taskTitle: "Initial photography task" }).success).toBe(true);
  });

  it("only allows the manager review actions represented in the workflow", () => {
    expect(reviewWorkRequestSchema.safeParse({ requestId: "request-1", nextStatus: WorkRequestStatus.NEEDS_INFO, managerNote: "Please provide the requested image list." }).success).toBe(true);
    expect(reviewWorkRequestSchema.safeParse({ requestId: "request-1", nextStatus: WorkRequestStatus.IN_PROGRESS, managerNote: "Approved" }).success).toBe(false);
  });
});
