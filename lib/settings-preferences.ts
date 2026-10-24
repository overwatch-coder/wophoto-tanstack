import {
  NotificationType,
  SettingsDensity,
  UserRole,
  WorkerAvailability,
} from "@/generated/prisma/browser";

export type NotificationChannels = Partial<
  Record<NotificationType, { inApp: boolean; email: boolean }>
>;

export type UserPreferencesView = {
  location: string;
  notificationChannels: NotificationChannels;
  density: SettingsDensity;
  soundAlerts: boolean;
  defaultLanding: string;
  workerAvailability: WorkerAvailability;
};

export type NotificationPreferenceItem = {
  type: NotificationType;
  title: string;
  description: string;
};

export const DEFAULT_EMAIL_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.FEEDBACK_RECEIVED,
  NotificationType.FEEDBACK_RESOLVED,
  NotificationType.REVISION_DELEGATED,
  NotificationType.REVISION_SUBMITTED,
  NotificationType.TASK_ASSIGNED,
  NotificationType.TASK_REVIEW_READY,
  NotificationType.TASK_RETURNED,
  NotificationType.DEADLINE_APPROACHING,
];

export const ROLE_NOTIFICATION_PREFERENCES: Record<
  UserRole,
  NotificationPreferenceItem[]
> = {
  [UserRole.MANAGER]: [
    {
      type: NotificationType.FEEDBACK_RECEIVED,
      title: "New client feedback",
      description: "A client submitted a review, issue, or revision request on a project you manage.",
    },
    {
      type: NotificationType.REVISION_SUBMITTED,
      title: "Worker revision ready",
      description: "A worker submitted delegated revision work for your review.",
    },
    {
      type: NotificationType.TASK_REVIEW_READY,
      title: "Task ready for review",
      description: "A worker submitted an assigned task for approval.",
    },
    {
      type: NotificationType.DEADLINE_APPROACHING,
      title: "Task due soon",
      description: "A managed task is due within 24 hours.",
    },
  ],
  [UserRole.WORKER]: [
    {
      type: NotificationType.TASK_ASSIGNED,
      title: "Task assigned",
      description: "A manager assigned a task to you.",
    },
    {
      type: NotificationType.REVISION_DELEGATED,
      title: "Revision delegated",
      description: "A manager assigned client revision work to you.",
    },
    {
      type: NotificationType.TASK_RETURNED,
      title: "Task returned for changes",
      description: "A manager returned submitted work with instructions.",
    },
    {
      type: NotificationType.TASK_APPROVED,
      title: "Task approved",
      description: "A manager approved your submitted task.",
    },
    {
      type: NotificationType.DEADLINE_APPROACHING,
      title: "Task due soon",
      description: "An assigned task is due within 24 hours.",
    },
  ],
  [UserRole.CLIENT]: [
    {
      type: NotificationType.FEEDBACK_RESOLVED,
      title: "Feedback request resolved",
      description: "The studio recorded a resolution to your feedback request.",
    },
  ],
};

export type LandingOption = { value: string; label: string; description: string };

export const ROLE_LANDING_OPTIONS: Record<UserRole, LandingOption[]> = {
  [UserRole.MANAGER]: [
    { value: "/manager", label: "Dashboard", description: "Studio overview" },
    { value: "/manager/tasks", label: "Tasks", description: "Team workboard" },
    { value: "/manager/reviews", label: "Reviews", description: "Client feedback triage" },
  ],
  [UserRole.WORKER]: [
    { value: "/worker", label: "Dashboard", description: "Work overview" },
    { value: "/worker/tasks", label: "My tasks", description: "Assigned work queue" },
    { value: "/worker/reviews", label: "Revisions", description: "Delegated revisions" },
  ],
  [UserRole.CLIENT]: [
    { value: "/client", label: "Dashboard", description: "Project overview" },
    { value: "/client/project-feedback", label: "Project feedback", description: "Feedback and revisions" },
  ],
};

export function getDefaultLanding(role: UserRole) {
  return ROLE_LANDING_OPTIONS[role][0]?.value ?? "/";
}
export function getDefaultNotificationChannels(role: UserRole): NotificationChannels {
  return Object.fromEntries(
    ROLE_NOTIFICATION_PREFERENCES[role].map(({ type }) => [type, {
      inApp: true,
      email: DEFAULT_EMAIL_NOTIFICATION_TYPES.includes(type),
    }]),
  ) as NotificationChannels;
}
