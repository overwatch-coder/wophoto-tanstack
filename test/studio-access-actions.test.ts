import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationStatus, StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => ({
  requireStudioOwner: vi.fn(),
  findFirstMember: vi.fn(),
  userUpdate: vi.fn(),
  permissionDeleteMany: vi.fn(),
  permissionCreateMany: vi.fn(),
  memberUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
  invitationUpdateMany: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));
type TransactionMock = {
  user: { update: typeof mocks.userUpdate };
  studioMemberPermission: {
    deleteMany: typeof mocks.permissionDeleteMany;
    createMany: typeof mocks.permissionCreateMany;
  };
};

vi.mock("@/lib/studio-access", () => ({ requireStudioOwner: mocks.requireStudioOwner }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    studioMember: { findFirst: mocks.findFirstMember, update: mocks.memberUpdate },
    user: { update: mocks.userUpdate },
    studioMemberPermission: { deleteMany: mocks.permissionDeleteMany, createMany: mocks.permissionCreateMany },
    session: { deleteMany: mocks.sessionDeleteMany },
    invitation: { updateMany: mocks.invitationUpdateMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { revokeStudioMember, updateStudioMemberAccess } from "@/src/server/actions/studio-access";

describe("Studio access management actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStudioOwner.mockResolvedValue({
      user: { id: "owner", role: UserRole.MANAGER },
      context: { studioId: "studio" },
    });
    mocks.findFirstMember.mockResolvedValue({
      id: "member",
      userId: "collaborator",
      invitationId: "invite-1",
      user: { role: UserRole.COLLABORATOR },
    });
    mocks.userUpdate.mockResolvedValue({});
    mocks.permissionDeleteMany.mockResolvedValue({ count: 1 });
    mocks.permissionCreateMany.mockResolvedValue({ count: 1 });
    mocks.memberUpdate.mockResolvedValue({});
    mocks.sessionDeleteMany.mockResolvedValue({ count: 1 });
    mocks.invitationUpdateMany.mockResolvedValue({ count: 1 });
    const tx = {
      user: { update: mocks.userUpdate },
      studioMemberPermission: {
        deleteMany: mocks.permissionDeleteMany,
        createMany: mocks.permissionCreateMany,
      },
    };
    mocks.transaction.mockImplementation((operation: unknown) => Array.isArray(operation)
      ? Promise.all(operation)
      : (operation as (tx: TransactionMock) => Promise<unknown>)(tx));
  });

  it("clears Collaborator grants when changing to the fixed Supervisor preset", async () => {
    const result = await updateStudioMemberAccess({ memberId: "member", role: UserRole.SUPERVISOR, permissions: [] });

    expect(result).toEqual({ success: true });
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: "collaborator" }, data: { role: UserRole.SUPERVISOR } });
    expect(mocks.permissionDeleteMany).toHaveBeenCalledWith({ where: { studioMemberId: "member" } });
    expect(mocks.permissionCreateMany).not.toHaveBeenCalled();
  });

  it("replaces grants on the next Collaborator update", async () => {
    const result = await updateStudioMemberAccess({
      memberId: "member",
      role: UserRole.COLLABORATOR,
      permissions: [{ area: StudioArea.PROJECTS, accessLevel: StudioAccessLevel.VIEW }],
    });

    expect(result).toEqual({ success: true });
    expect(mocks.permissionDeleteMany).toHaveBeenCalledWith({ where: { studioMemberId: "member" } });
    expect(mocks.permissionCreateMany).toHaveBeenCalledWith({
      data: [{ area: StudioArea.PROJECTS, accessLevel: StudioAccessLevel.VIEW, studioMemberId: "member" }],
    });
  });

  it("rejects custom grants for Supervisors", async () => {
    const result = await updateStudioMemberAccess({
      memberId: "member",
      role: UserRole.SUPERVISOR,
      permissions: [{ area: StudioArea.TASKS, accessLevel: StudioAccessLevel.MANAGE }],
    });

    expect(result).toEqual({ error: "Supervisors use their fixed access preset." });
    expect(mocks.findFirstMember).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("revokes membership and active sessions while retaining the member row", async () => {
    const result = await revokeStudioMember({ memberId: "member" });

    expect(result).toEqual({ success: true });
    expect(mocks.findFirstMember).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ studioId: "studio", revokedAt: null, userId: { not: "owner" } }),
    }));
    expect(mocks.memberUpdate).toHaveBeenCalledWith({
      where: { id: "member" },
      data: expect.objectContaining({ revokedById: "owner", revokedAt: expect.any(Date) }),
    });
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "collaborator" } });
    expect(mocks.invitationUpdateMany).toHaveBeenCalledWith({
      where: { id: "invite-1", studioId: "studio", acceptedUserId: "collaborator", status: InvitationStatus.USED },
      data: { status: InvitationStatus.REVOKED, tokenEncrypted: null },
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("does not revoke the owner", async () => {
    mocks.findFirstMember.mockResolvedValue(null);

    const result = await revokeStudioMember({ memberId: "owner-member" });

    expect(result).toEqual({ error: "That member is already removed or unavailable." });
    expect(mocks.findFirstMember).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: { not: "owner" } }),
    }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not demote the owner through member access updates", async () => {
    mocks.findFirstMember.mockResolvedValue(null);

    const result = await updateStudioMemberAccess({
      memberId: "owner-member",
      role: UserRole.COLLABORATOR,
      permissions: [],
    });

    expect(result).toEqual({ error: "That studio member is no longer available." });
    expect(mocks.findFirstMember).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: { not: "owner" } }),
    }));
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
