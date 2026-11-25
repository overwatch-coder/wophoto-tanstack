import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ensureDemoStudioSeeded: vi.fn(),
  seedDemoStudio: vi.fn(),
  sessionCreate: vi.fn(),
  sessionDeleteMany: vi.fn(),
  studioFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  invitationUpdateMany: vi.fn(),
  invitationCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/demo-seed", () => ({
  ensureDemoStudioSeeded: mocks.ensureDemoStudioSeeded,
  seedDemoStudio: mocks.seedDemoStudio,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: {
      create: mocks.sessionCreate,
      deleteMany: mocks.sessionDeleteMany,
    },
    studio: {
      findUnique: mocks.studioFindUnique,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
    invitation: {
      updateMany: mocks.invitationUpdateMany,
      create: mocks.invitationCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  DEMO_PERSONAS,
  isDemoAccessEnabled,
  isDemoEmail,
  isDemoRole,
  isDemoUserId,
} from "@/lib/demo";
import { handleDemoAuthPost } from "@/src/routes/auth.demo";
import { sendNotificationEmail } from "@/lib/email";
import { createInvitationForManager } from "@/lib/invitations";

describe("Demo Studio access & guardrails", () => {
  const originalEnv = process.env.ENABLE_DEMO_ACCESS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_DEMO_ACCESS;
    mocks.ensureDemoStudioSeeded.mockResolvedValue(undefined);
    mocks.seedDemoStudio.mockResolvedValue(undefined);
    mocks.sessionCreate.mockResolvedValue({ sessionToken: "tok" });
    mocks.sessionDeleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ENABLE_DEMO_ACCESS;
    else process.env.ENABLE_DEMO_ACCESS = originalEnv;
  });

  it("identifies demo personas, emails, and feature flag", () => {
    expect(isDemoAccessEnabled()).toBe(true);
    process.env.ENABLE_DEMO_ACCESS = "false";
    expect(isDemoAccessEnabled()).toBe(false);

    expect(isDemoUserId(DEMO_PERSONAS.MANAGER.id)).toBe(true);
    expect(isDemoUserId("real-user-123")).toBe(false);
    expect(isDemoEmail("demo.worker@wophoto.demo")).toBe(true);
    expect(isDemoEmail("real@studio.com")).toBe(false);
    expect(isDemoRole("MANAGER")).toBe(true);
    expect(isDemoRole("ADMIN")).toBe(false);
  });

  it("rejects demo sign-in when ENABLE_DEMO_ACCESS=false", async () => {
    process.env.ENABLE_DEMO_ACCESS = "false";
    const formData = new FormData();
    formData.set("role", "MANAGER");

    const res = await handleDemoAuthPost(
      new Request("http://localhost:3000/auth/demo", { method: "POST", body: formData }),
    );
    expect(res.status).toBe(403);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("seeds demo studio on demand, rotates previous session, and sets HTTP cookie locally", async () => {
    const formData = new FormData();
    formData.set("role", "WORKER");

    const res = await handleDemoAuthPost(
      new Request("http://localhost:3000/auth/demo", {
        method: "POST",
        headers: { cookie: "authjs.session-token=old-token" },
        body: formData,
      }),
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/");
    expect(mocks.ensureDemoStudioSeeded).toHaveBeenCalledTimes(1);
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { sessionToken: "old-token" } });
    expect(mocks.sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: DEMO_PERSONAS.WORKER.id,
        sessionToken: expect.any(String),
        expires: expect.any(Date),
      }),
    });

    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith("authjs.session-token=") && !c.includes("Max-Age=0"))).toBe(true);
  });

  it("sets __Secure- cookie over HTTPS", async () => {
    const formData = new FormData();
    formData.set("role", "CLIENT");

    const res = await handleDemoAuthPost(
      new Request("https://wophotos.vercel.app/auth/demo", {
        method: "POST",
        headers: { "x-forwarded-proto": "https" },
        body: formData,
      }),
    );

    expect(res.status).toBe(303);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith("__Secure-authjs.session-token=") && c.includes("Secure"))).toBe(true);
  });

  it("allows demo reset only for active demo sessions", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "real-user-1", role: "MANAGER" } });
    const deniedForm = new FormData();
    deniedForm.set("action", "reset");

    const denied = await handleDemoAuthPost(
      new Request("http://localhost:3000/auth/demo", { method: "POST", body: deniedForm }),
    );
    expect(denied.status).toBe(403);
    expect(mocks.seedDemoStudio).not.toHaveBeenCalled();

    mocks.auth.mockResolvedValue({ user: { id: DEMO_PERSONAS.MANAGER.id, role: "MANAGER" } });
    const okForm = new FormData();
    okForm.set("action", "reset");
    okForm.set("role", "MANAGER");

    const ok = await handleDemoAuthPost(
      new Request("http://localhost:3000/auth/demo", { method: "POST", body: okForm }),
    );
    expect(ok.status).toBe(303);
    expect(mocks.seedDemoStudio).toHaveBeenCalledWith({ reset: true });
  });

  it("prevents external emails for demo recipients and demo managers", async () => {
    const emailResult = await sendNotificationEmail({
      to: "demo.worker@wophoto.demo",
      subject: "Hello",
      title: "Hello",
      message: "Test",
    });
    expect(emailResult).toEqual({ success: true, status: "preview" });

    mocks.studioFindUnique.mockResolvedValue({ id: "demo-studio-lumiere" });
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.transaction.mockResolvedValue([{}, { id: "inv-demo-new" }]);
    process.env.AUTH_SECRET = "test-secret-for-invitations-encryption-key-0123456789";

    const inviteResult = await createInvitationForManager(DEMO_PERSONAS.MANAGER.id, {
      email: "recruiter@company.com",
      role: "WORKER",
    });

    expect(inviteResult.success).toBe(true);
    expect(inviteResult.emailDelivery?.status).toBe("preview");
  });
});
