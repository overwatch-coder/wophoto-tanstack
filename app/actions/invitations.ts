"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { InvitationStatus, UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { decryptInvitationToken, encryptInvitationToken } from "@/lib/invitation-token";

export type InvitationFormState = {
  error?: string;
  invitePath?: string;
  invitationId?: string;
};

export async function createInvitation(
  _previousState: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const manager = await requireRole(UserRole.MANAGER);
  const rawEmail = formData.get("email");
  const rawRole = formData.get("role");

  if (typeof rawEmail !== "string" || typeof rawRole !== "string") {
    return { error: "Enter an email address and choose a role." };
  }

  const email = rawEmail.trim().toLowerCase();
  const role = rawRole as UserRole;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (role !== UserRole.WORKER && role !== UserRole.CLIENT) {
    return { error: "Choose Worker or Client. Manager access is provisioned separately." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  });

  if (existingUser) {
    return { error: "That email already belongs to a WoPhoto account. Ask a manager to restore access if the account is suspended." };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenEncrypted = encryptInvitationToken(token);
  const now = new Date();

  const [, invitation] = await prisma.$transaction([
    prisma.invitation.updateMany({
      where: {
        email,
        usedAt: null,
        status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
      },
      data: { status: InvitationStatus.REVOKED, tokenEncrypted: null },
    }),
    prisma.invitation.create({
      data: {
        email,
        role,
        tokenHash,
        tokenEncrypted,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        invitedById: manager.id,
      },
    }),
  ]);

  revalidatePath("/manager/invitations");
  return { invitePath: `/invite/${token}`, invitationId: invitation.id };
}

export async function getInvitationLink(id: string): Promise<InvitationFormState> {
  const manager = await requireRole(UserRole.MANAGER);
  const invitation = await prisma.invitation.findFirst({
    where: {
      id, invitedById: manager.id, usedAt: null,
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
  const token = randomBytes(32).toString("base64url");
  const updated = await prisma.invitation.updateMany({
    where: {
      id, invitedById: manager.id, usedAt: null,
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

export async function acceptInvitation(formData: FormData) {
  const token = formData.get("token");

  if (typeof token !== "string" || token.length < 32 || token.length > 256) {
    redirect("/login?invite=invalid");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
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
