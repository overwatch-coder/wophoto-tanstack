"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { InvitationStatus, UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
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
  const manager = await requireRole(UserRole.MANAGER);
  let email: string;
  let role: UserRole;
  try {
    ({ email, role } = parseInput(createInvitationSchema, {
      email: formData.get("email"),
      role: formData.get("role"),
    }));
  } catch (error) {
    return { error: error instanceof InputValidationError ? error.message : "Enter an email address and choose a role." };
  }
  return createInvitationForManager(manager.id, { email, role });
}

export async function getInvitationLink(id: string): Promise<InvitationFormState> {
  const manager = await requireRole(UserRole.MANAGER);
  const parsedId = invitationIdSchema.safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0]?.message ?? "This invitation is unavailable." };
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: parsedId.data, invitedById: manager.id, usedAt: null,
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
  const manager = await requireRole(UserRole.MANAGER);
  const parsedId = invitationIdSchema.safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0]?.message ?? "This invitation is unavailable." };
  const token = randomBytes(32).toString("base64url");
  const updated = await prisma.invitation.updateMany({
    where: {
      id: parsedId.data, invitedById: manager.id, usedAt: null,
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
  const manager = await requireRole(UserRole.MANAGER);
  const parsedId = invitationIdSchema.safeParse(id);
  if (!parsedId.success) return { error: parsedId.error.issues[0]?.message ?? "This invitation could not be revoked." };
  const updated = await prisma.invitation.updateMany({
    where: {
      id: parsedId.data,
      invitedById: manager.id,
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
