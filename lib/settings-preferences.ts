import {
  NotificationType,
  SettingsDensity,
  UserRole,
  WorkerAvailability,
} from "@/generated/prisma/browser";

export type NotificationChannels = Partial<
  Record<NotificationType, { inApp: boolean; email: boolean }>
>;

export type AIProvider = "OPENAI" | "ANTHROPIC" | "GEMINI" | "GROK" | "GROQ" | "CUSTOM";

export const DEFAULT_AI_COPILOT_NAME = "WoPhoto Studio Copilot";

export type AIModelOption = {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
};

export const AI_PROVIDER_MODELS: Record<AIProvider, AIModelOption[]> = {
  OPENAI: [
    { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", description: "Recommended balance of capability and speed.", recommended: true },
    { id: "gpt-6-astra", label: "GPT-6 Astra", description: "For the most demanding, complex tasks." },
    { id: "gpt-6-luna", label: "GPT-6 Luna", description: "A lightweight option for fast, routine tasks." },
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", description: "Balances capability and cost for general-purpose work." },
    { id: "gpt-4o", label: "GPT-4o", description: "Multimodal general-purpose model." },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", description: "Compact, cost-efficient model." },
  ],
  ANTHROPIC: [
    { id: "claude-fable-5-1", label: "Claude Fable 5.1", description: "Recommended for strong everyday reasoning and tool use." },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5", description: "For the most demanding, complex tasks." },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", description: "Balanced capability and speed.", recommended: true },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", description: "Fast responses for lighter tasks." },
  ],
  GEMINI: [
    { id: "gemini-4-argon", label: "Gemini 4 Argon", description: "Recommended flagship reasoning model.", recommended: true },
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", description: "Fast, capable model for agentic workflows." },
    { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", description: "Previous-generation multimodal general-purpose model." },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", description: "Fast, cost-efficient option for lighter tasks." },
  ],
  GROK: [
    { id: "grok-4.7", label: "Grok 4.7", description: "Flagship model for chat, coding, and tool use." },
    { id: "grok-4.3", label: "Grok 4.3", description: "Earlier general-purpose model." },
    { id: "grok-4.20", label: "Grok 4.20", description: "Recommended high-performance model with agentic tool calling.", recommended: true },
  ],
  GROQ: [
    { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", description: "Strong general-purpose model with tool calling.", recommended: true },
    { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", description: "Faster and more cost-efficient." },
    { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B", description: "Tool-capable model with parallel tool use; replaces retired Llama 4 Scout." },
  ],
  CUSTOM: [],
};

export const DEFAULT_AI_MODELS: Record<AIProvider, string> = {
  OPENAI: "gpt-6.1-sol",
  ANTHROPIC: "claude-sonnet-5-5",
  GEMINI: "gemini-4-argon",
  GROK: "grok-4.20",
  GROQ: "openai/gpt-oss-120b",
  CUSTOM: "llama3.3",
};

export function isAIModelAvailable(provider: AIProvider, model: string) {
  return provider === "CUSTOM" || AI_PROVIDER_MODELS[provider].some(({ id }) => id === model);
}

export type AIPreferencesView = {
  aiCopilotName: string;
  aiProvider: AIProvider;
  aiModel: string;
  aiApiKeyMasked: string;
  aiApiKeyProvider: AIProvider | null;
  hasCustomKey: boolean;
  hasStoredKey: boolean;
  aiApiKeyNeedsReset: boolean;
  aiCustomEndpoint: string;
  aiAutonomousExecution: boolean;
};

export type UserPreferencesView = {
  location: string;
  notificationChannels: NotificationChannels;
  density: SettingsDensity;
  soundAlerts: boolean;
  defaultLanding: string;
  workerAvailability: WorkerAvailability;
  aiPreferences: AIPreferencesView;
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
  [UserRole.SUPERVISOR]: [],
  [UserRole.COLLABORATOR]: [],
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
  [UserRole.SUPERVISOR]: [
    { value: "/manager", label: "Dashboard", description: "Studio overview" },
    { value: "/manager/tasks", label: "Tasks", description: "Team workboard" },
    { value: "/manager/reviews", label: "Reviews", description: "Client feedback triage" },
  ],
  [UserRole.COLLABORATOR]: [
    { value: "/manager", label: "Dashboard", description: "Studio overview" },
    { value: "/manager/tasks", label: "Tasks", description: "Team workboard" },
    { value: "/manager/reviews", label: "Reviews", description: "Client feedback triage" },
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
