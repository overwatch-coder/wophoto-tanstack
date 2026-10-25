import { ScheduleEventType, TaskStatus } from "@/generated/prisma/browser";

export const SCHEDULE_EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  [ScheduleEventType.SHOOT]: "Photo/Video Shoot",
  [ScheduleEventType.STUDIO_BOOKING]: "Studio Booking / Bay Hold",
  [ScheduleEventType.CLIENT_MEETING]: "Client Review / Meeting",
  [ScheduleEventType.MAINTENANCE]: "Maintenance & Prep",
  [ScheduleEventType.DEADLINE]: "Studio Milestone",
  [ScheduleEventType.OTHER]: "Other",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "To do",
  [TaskStatus.IN_PROGRESS]: "In progress",
  [TaskStatus.IN_REVIEW]: "In review",
  [TaskStatus.COMPLETED]: "Completed",
};

export const LOCATION_PRESET_LABELS: Record<string, string> = {
  custom: "Custom Location / Address...",
};

export function formatScheduleEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
