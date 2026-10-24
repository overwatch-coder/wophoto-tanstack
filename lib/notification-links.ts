export type NotificationTargetRole = "MANAGER" | "WORKER" | "CLIENT";

type FeedbackTarget = {
  kind: "feedback";
  role: NotificationTargetRole;
  id: string;
};

type TaskTarget = {
  kind: "task";
  role: "MANAGER" | "WORKER";
  id: string;
  action?: "view" | "review";
};

/** Build a role-scoped link that opens the exact item in its existing workspace dialog. */
export function notificationActionLink(target: FeedbackTarget | TaskTarget) {
  const params = new URLSearchParams();

  if (target.kind === "feedback") {
    const path = {
      MANAGER: "/manager/reviews",
      WORKER: "/worker/reviews",
      CLIENT: "/client/project-feedback",
    }[target.role];

    params.set("feedbackId", target.id);
    return `${path}?${params.toString()}`;
  }

  const path = target.role === "MANAGER" ? "/manager/tasks" : "/worker/tasks";
  params.set("taskId", target.id);
  params.set("taskAction", target.action ?? "view");
  return `${path}?${params.toString()}`;
}
