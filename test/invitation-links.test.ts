import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), revalidatePath: vi.fn(),
  userUpdate: vi.fn(), sessionDeleteMany: vi.fn(), studioMemberUpdate: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/lib/authz", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/studio-access", () => {
  const actor = async () => mocks.requireRole("MANAGER");
  const context = (user: { id: string; role: string }) => ({
    studioId: `studio-${user.id}`, ownerUserId: user.id, isOwner: user.role === "MANAGER",
    memberId: null, role: user.role, grants: {},
  });
  return {
    requireStudioArea: async () => { const user = await actor(); return { user, context: context(user) }; },
    requireStudioManagerArea: async () => { const user = await actor(); return { manager: { ...user, actorId: user.id }, actor: user, context: context(user) }; },
    requireStudioOwner: async () => { const user = await actor(); return { user, context: context(user) }; },
    getStudioAccessContext: async (userId: string, role: string) => ({ studioId: `studio-${userId}`, ownerUserId: role === "MANAGER" ? userId : "manager-1", isOwner: role === "MANAGER", memberId: role === "MANAGER" ? null : "member-1", role, grants: {} }),
    hasStudioAccess: () => true,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: {
  invitation: { findFirst: mocks.findFirst, updateMany: mocks.updateMany },
  user: { update: mocks.userUpdate },
  session: { deleteMany: mocks.sessionDeleteMany },
  studioMember: { update: mocks.studioMemberUpdate },
  $transaction: mocks.transaction,
} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));

import { decryptInvitationToken, encryptInvitationToken } from "@/lib/invitation-token";
import { acceptInvitation, getInvitationLink, replaceInvitationLink, revokeInvitation, revokeStudioInvitationAccess } from "@/app/actions/invitations";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-invitation-secret");
  mocks.requireRole.mockResolvedValue({ id: "manager-1", role: "MANAGER" });
  mocks.transaction.mockImplementation((operation: unknown) => Array.isArray(operation)
    ? Promise.all(operation)
    : (operation as (tx: unknown) => Promise<unknown>)({
      invitation: { updateMany: mocks.updateMany },
      user: { update: mocks.userUpdate },
      session: { deleteMany: mocks.sessionDeleteMany },
      studioMember: { update: mocks.studioMemberUpdate },
    }));
});
afterEach(() => vi.unstubAllEnvs());

describe("invitation link encryption", () => {
  it("recovers the same link using randomized encrypted storage", () => {
    const first = encryptInvitationToken("private-invitation-token");
    expect(first).not.toContain("private-invitation-token");
    expect(first).not.toBe(encryptInvitationToken("private-invitation-token"));
    expect(decryptInvitationToken(first)).toBe("private-invitation-token");
  });

  it("rejects a modified ciphertext and a different key", () => {
    const value = encryptInvitationToken("private-invitation-token");
    const parts = value.split(".");
    const ciphertext = Buffer.from(parts[3], "base64url");
    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString("base64url");
    expect(() => decryptInvitationToken(parts.join("."))).toThrow();
    vi.stubEnv("AUTH_SECRET", "different-secret");
    expect(() => decryptInvitationToken(value)).toThrow();
  });
});

describe("invitation link actions", () => {
  it.each(["WORKER", "CLIENT"] as const)("revokes an accepted %s, ends sessions, and keeps the account history", async (role) => {
    mocks.findFirst.mockResolvedValue({ id: "invite-1", role, acceptedUserId: "person-1", joinedMember: null });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const result = await revokeStudioInvitationAccess("invite-1");

    expect(result).toEqual({ success: true });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: "invite-1", studioId: "studio-manager-1", status: "USED", usedAt: { not: null }, acceptedUserId: { not: null },
    } }));
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "invite-1", studioId: "studio-manager-1", status: "USED", acceptedUserId: "person-1" },
      data: { status: "REVOKED", tokenEncrypted: null },
    }));
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: "person-1" }, data: { status: "SUSPENDED" } });
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "person-1" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/client");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/worker");
  });

  it("does not mutate data when an accepted account is unavailable", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await revokeStudioInvitationAccess("missing")).toEqual({ error: "That studio account is already removed or unavailable." });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.sessionDeleteMany).not.toHaveBeenCalled();
  });

  it("does not let a nonowner revoke Supervisor or Collaborator access", async () => {
    mocks.requireRole.mockResolvedValue({ id: "collaborator-1", role: "COLLABORATOR" });
    mocks.findFirst.mockResolvedValue({ id: "invite-1", role: "SUPERVISOR", acceptedUserId: "person-1", joinedMember: { id: "member-1", revokedAt: null } });
    expect(await revokeStudioInvitationAccess("invite-1")).toEqual({ error: "Only the studio owner can remove a Supervisor or Collaborator." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(["SUPERVISOR", "COLLABORATOR"] as const)("lets the owner revoke an accepted %s from its invitation row", async (role) => {
    mocks.findFirst.mockResolvedValue({ id: "invite-1", role, acceptedUserId: "person-1", joinedMember: { id: "member-1", revokedAt: null } });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const result = await revokeStudioInvitationAccess("invite-1");

    expect(result).toEqual({ success: true });
    expect(mocks.studioMemberUpdate).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { revokedAt: expect.any(Date), revokedById: "manager-1" },
    });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "person-1" } });
  });

  it("returns the same original token and restricts retrieval to the inviting manager and unused valid invitations", async () => {
    mocks.findFirst.mockResolvedValue({ tokenEncrypted: encryptInvitationToken("original-token"), tokenHash: createHash("sha256").update("original-token").digest("hex") });
    expect(await getInvitationLink("invitation-1")).toEqual({ invitePath: "/invite/original-token" });
    expect(mocks.requireRole).toHaveBeenCalledWith("MANAGER");
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: "invitation-1", invitedById: "manager-1", studioId: "studio-manager-1", usedAt: null,
      status: { in: ["PENDING", "ACCEPTED"] }, expiresAt: { gt: expect.any(Date) },
    } }));
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("does not return a link for an unavailable or legacy invitation", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await getInvitationLink("unavailable")).invitePath).toBeUndefined();
    mocks.findFirst.mockResolvedValue({ tokenEncrypted: null });
    expect((await getInvitationLink("legacy")).error).toContain("replacement");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("does not expose a token if the stored hash does not match", async () => {
    mocks.findFirst.mockResolvedValue({ tokenEncrypted: encryptInvitationToken("token"), tokenHash: "wrong-hash" });
    expect((await getInvitationLink("invitation-1")).invitePath).toBeUndefined();
  });

  it("checks authorization before reading or replacing any link", async () => {
    mocks.requireRole.mockRejectedValue(new Error("forbidden"));
    await expect(getInvitationLink("invitation-1")).rejects.toThrow("forbidden");
    await expect(replaceInvitationLink("invitation-1")).rejects.toThrow("forbidden");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("replaces only a valid owned invitation and preserves its role, acceptance and expiry", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const result = await replaceInvitationLink("invitation-1");
    const { where, data } = mocks.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: "invitation-1", invitedById: "manager-1", studioId: "studio-manager-1", usedAt: null, status: { in: ["PENDING", "ACCEPTED"] }, expiresAt: { gt: expect.any(Date) } });
    const token = result.invitePath!.slice("/invite/".length);
    expect(decryptInvitationToken(data.tokenEncrypted)).toBe(token);
    expect(data.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(Object.keys(data).sort()).toEqual(["tokenEncrypted", "tokenHash"]);
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await replaceInvitationLink("used-while-open")).invitePath).toBeUndefined();
  });

  it("allows an already accepted but unused invitation to continue to sign in", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.findFirst.mockResolvedValue({ id: "accepted-invitation" });
    const data = new FormData();
    data.set("token", "a".repeat(43));
    await expect(acceptInvitation(data)).rejects.toThrow("redirect:/login?invite=accepted");
    mocks.findFirst.mockResolvedValue(null);
    await expect(acceptInvitation(data)).rejects.toThrow("redirect:/login?invite=invalid");
  });

  it("revokes an owned unused invitation and revalidates path", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const result = await revokeInvitation("invitation-1");
    expect(result).toEqual({ success: true });
    expect(mocks.requireRole).toHaveBeenCalledWith("MANAGER");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "invitation-1",
        invitedById: "manager-1",
        studioId: "studio-manager-1",
        usedAt: null,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      data: {
        status: "REVOKED",
        tokenEncrypted: null,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/manager/invitations");
  });
});
