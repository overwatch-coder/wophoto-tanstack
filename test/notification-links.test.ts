import { describe, expect, it } from "vitest";
import { notificationActionLink } from "@/lib/notification-links";

describe("notification action links", () => {
  it("opens feedback in the matching role workspace with the exact feedback id", () => {
    expect(notificationActionLink({ kind: "feedback", role: "MANAGER", id: "feedback 1" }))
      .toBe("/manager/reviews?feedbackId=feedback+1");
    expect(notificationActionLink({ kind: "feedback", role: "WORKER", id: "fb_2" }))
      .toBe("/worker/reviews?feedbackId=fb_2");
    expect(notificationActionLink({ kind: "feedback", role: "CLIENT", id: "fb_3" }))
      .toBe("/client/project-feedback?feedbackId=fb_3");
  });

  it("opens the task view or manager review dialog for the exact task", () => {
    expect(notificationActionLink({ kind: "task", role: "WORKER", id: "task 1" }))
      .toBe("/worker/tasks?taskId=task+1&taskAction=view");
    expect(notificationActionLink({ kind: "task", role: "MANAGER", id: "task_2", action: "review" }))
      .toBe("/manager/tasks?taskId=task_2&taskAction=review");
  });
});
