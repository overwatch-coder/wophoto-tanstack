import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  updateManyInvitation: vi.fn(),
  createInvitation: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/email", () => ({ sendNotificationEmail: mocks.sendEmail }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    studio: { findUnique: vi.fn().mockResolvedValue({ id: "studio-1" }) },
    user: { findUnique: mocks.findUniqueUser },
    invitation: { updateMany: mocks.updateManyInvitation, create: mocks.createInvitation },
    $transaction: mocks.transaction,
  },
}));

import { createInvitationForManager } from "@/lib/invitations";

describe("Invitation creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-invitation-secret");
    mocks.findUniqueUser.mockResolvedValue(null);
    mocks.updateManyInvitation.mockResolvedValue({ count: 0 });
    mocks.createInvitation.mockResolvedValue({ id: "invitation-1" });
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
    mocks.sendEmail.mockResolvedValue({ success: true, status: "sent", messageId: "email-1" });
  });

  it("creates a seven-day invitation link and revokes previous unused links for the same email", async () => {
    const before = Date.now();
    const result = await createInvitationForManager("manager-1", {
      email: "Client@Example.com",
      role: "CLIENT",
    });

    expect(result).toMatchObject({
      success: true,
      email: "client@example.com",
      role: "CLIENT",
      invitationId: "invitation-1",
      emailDelivery: { status: "sent" },
      message: expect.stringContaining("sent to client@example.com"),
    });
    expect(result.invitePath).toMatch(/^\/invite\/[A-Za-z0-9_-]+$/);
    expect(result.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
    expect(result.expiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.updateManyInvitation).toHaveBeenCalledWith({
      where: {
        email: "client@example.com",
        usedAt: null,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      data: { status: "REVOKED", tokenEncrypted: null },
    });

    const token = result.invitePath!.replace("/invite/", "");
    expect(mocks.createInvitation).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "client@example.com",
        role: "CLIENT",
        invitedById: "manager-1",
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: result.expiresAt,
      }),
      select: { id: true },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/manager/invitations");
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "client@example.com",
      subject: "Your WoPhoto Studio invitation",
      message: expect.stringContaining("as a client"),
      link: result.invitePath,
    }));
  });

  it.each([
    ["SUPERVISOR", "supervisor"],
    ["COLLABORATOR", "collaborator"],
  ] as const)("identifies a %s invitation with the correct role in its email", async (role, label) => {
    await createInvitationForManager("manager-1", {
      email: "member@example.com",
      role,
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "member@example.com",
      message: expect.stringContaining(`as a ${label}`),
    }));
  });

  it("does not imply test-mode invitation email was delivered to the invitee", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "test");

    const result = await createInvitationForManager("manager-1", {
      email: "member@example.com",
      role: "SUPERVISOR",
    });

    expect(result.message).toContain("test email was sent to the configured test inbox instead of member@example.com");
  });

  it("keeps the copyable link when email delivery is unavailable", async () => {
    mocks.sendEmail.mockResolvedValue({ success: false, status: "preview" });

    const result = await createInvitationForManager("manager-1", {
      email: "client@example.com",
      role: "CLIENT",
    });

    expect(result).toMatchObject({
      success: true,
      emailDelivery: { status: "preview" },
      message: expect.stringContaining("email delivery is not configured"),
    });
    expect(result.invitePath).toMatch(/^\/invite\//);
  });

  it("keeps the invitation usable when the email provider rejects delivery", async () => {
    mocks.sendEmail.mockResolvedValue({ success: false, status: "failed", error: "provider unavailable" });

    const result = await createInvitationForManager("manager-1", {
      email: "client@example.com",
      role: "CLIENT",
    });

    expect(result).toMatchObject({
      success: true,
      emailDelivery: { status: "failed" },
      message: expect.stringContaining("email could not be sent"),
    });
    expect(result.invitePath).toMatch(/^\/invite\//);
  });

  it("does not create an invitation when the email already has a WoPhoto account", async () => {
    mocks.findUniqueUser.mockResolvedValue({ id: "user-1", status: "ACTIVE" });

    const result = await createInvitationForManager("manager-1", {
      email: "client@example.com",
      role: "CLIENT",
    });

    expect(result.error).toContain("already belongs to a WoPhoto account");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("rejects invalid input before querying or creating invitation records", async () => {
    const result = await createInvitationForManager("manager-1", {
      email: "not-an-email",
      role: "CLIENT",
    });

    expect(result.error).toBe("Enter a valid email address.");
    expect(mocks.findUniqueUser).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
