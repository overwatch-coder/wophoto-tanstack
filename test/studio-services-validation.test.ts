import { describe, expect, it } from "vitest";
import { parseTaskQuery } from "@/lib/validation/queries";
import { createStudioServiceSchema, setStudioServiceActiveSchema } from "@/lib/validation/services";
import { createAssignedTaskSchema } from "@/lib/validation/tasks";

describe("studio service catalog validation", () => {
  it("normalizes service names and optional descriptions", () => {
    expect(createStudioServiceSchema.parse({ name: "  Event Coverage  ", description: "  " })).toEqual({
      name: "Event Coverage",
      description: null,
    });
  });

  it("rejects too short service names and oversized descriptions", () => {
    expect(createStudioServiceSchema.safeParse({ name: "x", description: "" }).success).toBe(false);
    expect(createStudioServiceSchema.safeParse({ name: "Studio", description: "x".repeat(501) }).success).toBe(false);
  });

  it("accepts only explicit active state values", () => {
    expect(setStudioServiceActiveSchema.safeParse({ id: "service_123", isActive: true }).success).toBe(true);
    expect(setStudioServiceActiveSchema.safeParse({ id: "service_123", isActive: "true" }).success).toBe(false);
  });

  it("deduplicates service selections on task submission", () => {
    const parsed = createAssignedTaskSchema.parse({
      projectId: "project_123",
      title: "Edit reception photos",
      description: "",
      priority: "",
      startAt: "",
      dueAt: "",
      workerIds: ["worker_123"],
      serviceIds: ["service_123", "service_123"],
    });
    expect(parsed.serviceIds).toEqual(["service_123"]);
  });

  it("parses service filters and ignores invalid IDs", () => {
    expect(parseTaskQuery({ serviceId: "service_123" }).serviceId).toBe("service_123");
    expect(parseTaskQuery({ serviceId: "" }).serviceId).toBeUndefined();
    expect(parseTaskQuery({ serviceId: ["service_123", "service_456"] }).serviceId).toBe("service_123");
  });
});
