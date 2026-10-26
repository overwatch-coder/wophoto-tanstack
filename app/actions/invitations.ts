"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { InvitationStatus, StudioArea, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireStudioManagerArea } from "@/lib/studio-access";
import { decryptInvitationToken, encryptInvitationToken } from "@/lib/invitation-token";
import { createInvitationForManager } from "@/lib/invitations";
import { createInvitationSchema, invitationIdSchema, invitationTokenSchema } from "@/lib/validation/invitations";
import { InputValidationError, parseInput } from "@/lib/validation/common";

export type InvitationFormState = {
  error?: string;
  invitePath?: string;
  invitationId?: string;
  emailDelivery?: { status: "sent" | "preview" | "failed" };
  message?: string;
};

export async function createInvitation(
  _previousState: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const { context } = await requireStudioManagerArea(StudioArea.TEAM);
  let email: string;
  let role: UserRole;
  let permissions: Array<{ area: import("@/generated/prisma/client").StudioArea; accessLevel: import("@/generated/prisma/client").StudioAccessLevel }>;
  try {
    ({ email, role, permissions = [] } = parseInput(createInvitationSchema, {
      email: formData.get("email"),
      role: formData.get("role"),
      permissions: formData.get("permissions") ? JSON.parse(String(formData.get("permissions"))) : [],
    }));
  } catch (error) {
    return { error: error instanceof InputValidationError ? error.message : "Enter an email address and choose a role." };
  }
  if ((role === UserRole.SUPERVISOR || role === UserRole.COLLABORATOR) && !context.isOwner) {
    return { error: "Only the studio owner can invite supervisors or collaborators." };
  }
  if ((role === UserRole.WORKER || role === UserRole.CLIENT) && permissions.length) {
    return { error: "Area grants apply only to collaborator invitations." };
  }
  return createInvitationForManager(context.ownerUserId, { email, role, permissions });
}

export async function getInvitationLink(id: string): Promise<InvitationFormState> {
  const { manager, context } = await requireStudioManagerArea(StudioArea.TEAM);
  const parsedId = invitationIdSchema.safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0]?.message ?? "This invitation is unavailable." };
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: parsedId.data, invitedById: manager.id, usedAt: null,
      studioId: context.studioId,
      ...(!context.isOwner ? { role: { in: [UserRole.WORKER, UserRole.CLIENT] } } : {}),
      status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
      expiresAt: { gt: new Date() },
    },
    select: { tokenEncrypted: true, tokenHash: true },
  });
  if (!invitation) return { error: "This invitation is expired, used, or unavailable." };
  if (!invitation.tokenEncrypted) return { error: "This older invitation needs a replacement link." };
  try {
    const token = decryptInvitationToken(invitation.tokenEncrypted);
    if (createHash("sha256").update(token).digest("hex") !== invitation.tokenHash) {
      return { error: "This link could not be recovered. Create a replacement link." };
    }
    return { invitePath: `/invite/${token}` };
  } catch {
    return { error: "This link could not be recovered. Create a replacement link." };
  }
}

export async function replaceInvitationLink(id: string): Promise<InvitationFormState> {
  const { manager, context } = await requireStudioManagerArea(StudioArea.TEAM);
  const parsedId = invitationIdSchema.safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0]?.message ?? "This invitation is unavailable." };
  const token = randomBytes(32).toString("base64url");
  const updated = await prisma.invitation.updateMany({
    where: {
      id: parsedId.data, invitedById: manager.id, usedAt: null,
      studioId: context.studioId,
      ...(!context.isOwner ? { role: { in: [UserRole.WORKER, UserRole.CLIENT] } } : {}),
      status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
      expiresAt: { gt: new Date() },
    },
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      tokenEncrypted: encryptInvitationToken(token),
    },
  });
  if (updated.count !== 1) return { error: "This invitation is expired, used, or unavailable." };
  revalidatePath("/manager/invitations");
  return { invitePath: `/invite/${token}` };
}

export async function revokeInvitation(id: string): Promise<{ success?: boolean; error?: string }> {
  const { manager, context } = await requireStudioManagerArea(StudioArea.TEAM);
  const parsedId = invitationIdSchema.safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0]?.message ?? "This invitation could not be revoked." };
  const updated = await prisma.invitation.updateMany({
    where: {
      id: parsedId.data,
      invitedById: manager.id,
      studioId: context.studioId,
      ...(!context.isOwner ? { role: { in: [UserRole.WORKER, UserRole.CLIENT] } } : {}),
      usedAt: null,
      status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
    },
    data: {
      status: InvitationStatus.REVOKED,
      tokenEncrypted: null,
    },
  });
  if (updated.count !== 1) {
    return { error: "This invitation could not be revoked." };
  }
  revalidatePath("/manager/invitations");
  return { success: true };
}

/** Revoke an accepted Worker or Client account while retaining its history. */
export async function revokeStudioInvitationAccess(id: string): Promise<{ success?: boolean; error?: string }> {
  const { actor, context } = await requireStudioManagerArea(StudioArea.TEAM);
  const parsedId = invitationIdSchema.safeParse(id);
  if (!parsedId.success) return { error: "Choose an active studio account." };

  const invitation = await prisma.invitation.findFirst({
    where: {
      id: parsedId.data,
      studioId: context.studioId,
      status: InvitationStatus.USED,
      usedAt: { not: null },
      acceptedUserId: { not: null },
      ...(!context.isOwner ? { role: { in: [UserRole.WORKER, UserRole.CLIENT] } } : {}),
    },
    select: { id: true, role: true, acceptedUserId: true, joinedMember: { select: { id: true, revokedAt: true } } },
  });
  if (!invitation?.acceptedUserId) return { error: "That studio account is already removed or unavailable." };
  if ((invitation.role === UserRole.SUPERVISOR || invitation.role === UserRole.COLLABORATOR) && !context.isOwner) {
    return { error: "Only the studio owner can remove a Supervisor or Collaborator." };
  }
  const acceptedUserId = invitation.acceptedUserId;

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.invitation.updateMany({
      where: { id: invitation.id, studioId: context.studioId, status: InvitationStatus.USED, acceptedUserId },
      data: { status: InvitationStatus.REVOKED, tokenEncrypted: null },
    });
    if (revoked.count !== 1) throw new Error("That studio account is already removed or unavailable.");
    if (invitation.joinedMember && !invitation.joinedMember.revokedAt) {
      await tx.studioMember.update({
        where: { id: invitation.joinedMember.id },
        data: { revokedAt: new Date(), revokedById: actor.id },
      });
    } else if (invitation.role === UserRole.WORKER || invitation.role === UserRole.CLIENT) {
      await tx.user.update({ where: { id: acceptedUserId }, data: { status: UserStatus.SUSPENDED } });
    }
    await tx.session.deleteMany({ where: { userId: acceptedUserId } });
  });

  revalidatePath("/manager/invitations");
  revalidatePath("/manager");
  revalidatePath("/worker");
  revalidatePath("/client");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function acceptInvitation(formData: FormData) {
  const token = formData.get("token");
  const parsedToken = invitationTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    redirect("/login?invite=invalid");
  }

  const tokenHash = createHash("sha256").update(parsedToken.data).digest("hex");
  const now = new Date();
  const updated = await prisma.invitation.updateMany({
    where: {
      tokenHash,
      status: InvitationStatus.PENDING,
      expiresAt: { gt: now },
    },
    data: {
      status: InvitationStatus.ACCEPTED,
      acceptedAt: now,
    },
  });

  if (updated.count !== 1) {
    const accepted = await prisma.invitation.findFirst({
      where: { tokenHash, status: InvitationStatus.ACCEPTED, usedAt: null, expiresAt: { gt: now } },
      select: { id: true },
    });
    if (!accepted) redirect("/login?invite=invalid");
  }

  revalidatePath("/manager/invitations");
  redirect("/login?invite=accepted");
}
