import type { UserRole } from "@/generated/prisma/client";

export const DEMO_STUDIO_ID = "demo-studio-lumiere";
export const DEMO_STUDIO_NAME = "Studio Lumière (Demo)";
export const DEMO_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export const DEMO_ROLES = ["MANAGER", "WORKER", "CLIENT"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export type DemoPersona = {
  id: string;
  role: DemoRole;
  name: string;
  email: string;
  label: string;
  headline: string;
  summary: string;
};

export const DEMO_PERSONAS: Record<DemoRole, DemoPersona> = {
  MANAGER: {
    id: "demo-user-manager",
    role: "MANAGER",
    name: "Elena Vance",
    email: "demo.manager@wophoto.demo",
    label: "Studio Manager",
    headline: "Full studio operations",
    summary: "Team capacity, projects, briefs, gear inventory, reviews & Copilot.",
  },
  WORKER: {
    id: "demo-user-worker",
    role: "WORKER",
    name: "Marcus Chen",
    email: "demo.worker@wophoto.demo",
    label: "Lead Photographer",
    headline: "Production & task execution",
    summary: "Assigned shoots, daily logs, brief sign-offs, gear checkouts & schedule.",
  },
  CLIENT: {
    id: "demo-user-client",
    role: "CLIENT",
    name: "Sophia Laurent",
    email: "demo.client@wophoto.demo",
    label: "Brand Client",
    headline: "Approvals & requests",
    summary: "Project tracking, deliverable reviews, feedback & new work requests.",
  },
};

export const DEMO_SUPPORT_USERS = {
  SUPERVISOR: {
    id: "demo-user-supervisor",
    role: "SUPERVISOR" as UserRole,
    name: "Camille Moreau",
    email: "demo.supervisor@wophoto.demo",
  },
  WORKER_2: {
    id: "demo-user-worker-2",
    role: "WORKER" as UserRole,
    name: "Aria Patel",
    email: "demo.retoucher@wophoto.demo",
  },
  WORKER_3: {
    id: "demo-user-worker-3",
    role: "WORKER" as UserRole,
    name: "Devon Brooks",
    email: "demo.lighting@wophoto.demo",
  },
  CLIENT_2: {
    id: "demo-user-client-2",
    role: "CLIENT" as UserRole,
    name: "Julian Mercer",
    email: "demo.client2@wophoto.demo",
  },
} as const;

export const DEMO_ALL_USER_IDS = [
  DEMO_PERSONAS.MANAGER.id,
  DEMO_PERSONAS.WORKER.id,
  DEMO_PERSONAS.CLIENT.id,
  DEMO_SUPPORT_USERS.SUPERVISOR.id,
  DEMO_SUPPORT_USERS.WORKER_2.id,
  DEMO_SUPPORT_USERS.WORKER_3.id,
  DEMO_SUPPORT_USERS.CLIENT_2.id,
] as const;

export function isDemoAccessEnabled(): boolean {
  return process.env.ENABLE_DEMO_ACCESS?.trim().toLowerCase() !== "false";
}

export function isDemoRole(role: unknown): role is DemoRole {
  return role === "MANAGER" || role === "WORKER" || role === "CLIENT";
}

export function getDemoPersona(role: DemoRole): DemoPersona {
  return DEMO_PERSONAS[role];
}

export function isDemoUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return userId.startsWith("demo-user-");
}

export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith("@wophoto.demo");
}

export function isDemoStudioId(studioId: string | null | undefined): boolean {
  return studioId === DEMO_STUDIO_ID;
}
