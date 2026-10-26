import { BriefStatus, SignOffStatus } from "@/generated/prisma/browser";

export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  [BriefStatus.DRAFT]: "Draft",
  [BriefStatus.IN_REVIEW]: "In Review",
  [BriefStatus.CHANGES_REQUESTED]: "Changes Requested",
  [BriefStatus.APPROVED]: "Approved & Ready",
  [BriefStatus.COMPLETED]: "Completed",
};

export const SIGN_OFF_STATUS_LABELS: Record<SignOffStatus, string> = {
  [SignOffStatus.PENDING]: "Pending Review",
  [SignOffStatus.SIGNED]: "Signed Off",
  [SignOffStatus.WAIVED]: "Waived",
};

export function formatBriefStatus(status: BriefStatus | string): string {
  if (status in BRIEF_STATUS_LABELS) {
    return BRIEF_STATUS_LABELS[status as BriefStatus];
  }
  return String(status);
}

export function formatSignOffStatus(status: SignOffStatus | string): string {
  if (status in SIGN_OFF_STATUS_LABELS) {
    return SIGN_OFF_STATUS_LABELS[status as SignOffStatus];
  }
  return String(status);
}

export function formatBriefOption(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getBriefStatusBadgeClass(status: BriefStatus): string {
  switch (status) {
    case BriefStatus.DRAFT:
      return "bg-muted text-muted-foreground border-border";
    case BriefStatus.IN_REVIEW:
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case BriefStatus.CHANGES_REQUESTED:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case BriefStatus.APPROVED:
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case BriefStatus.COMPLETED:
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function getSignOffStatusBadgeClass(status: SignOffStatus): string {
  switch (status) {
    case SignOffStatus.PENDING:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case SignOffStatus.SIGNED:
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case SignOffStatus.WAIVED:
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
