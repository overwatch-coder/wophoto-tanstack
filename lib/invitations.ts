import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { InvitationStatus, type UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptInvitationToken } from "@/lib/invitation-token";
import { sendNotificationEmail } from "@/lib/email";
import { createInvitationSchema } from "@/lib/validation/invitations";

export async function createInvitationForManager(managerId: string, input: unknown) {
  const studio = await prisma.studio.findUnique({ where: { ownerUserId: managerId }, select: { id: true } });
  if (!studio) return { error: "Your studio is not ready to send invitations." };
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address and choose a role." };
  }

  const { email, role, permissions = [] } = parsed.data;
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  });

  if (existingUser) {
    return { error: "That email already belongs to a WoPhoto account. Restoring or re-inviting existing accounts is not available yet." };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenEncrypted = encryptInvitationToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

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
        role: role as UserRole,
        tokenHash,
        tokenEncrypted,
        expiresAt,
        invitedById: managerId,
        studioId: studio.id,
        permissions: {
          create: role === "COLLABORATOR"
            ? permissions.map(({ area, accessLevel }) => ({ area, accessLevel }))
            : [],
        },
      },
      select: { id: true },
    }),
  ]);

  revalidatePath("/manager/invitations");
  const invitePath = `/invite/${token}`;
  const roleLabel: Record<UserRole, string> = {
    MANAGER: "manager",
    SUPERVISOR: "supervisor",
    COLLABORATOR: "collaborator",
    WORKER: "worker",
    CLIENT: "client",
  };
  const delivery = await sendNotificationEmail({
    to: email,
    subject: "Your WoPhoto Studio invitation",
    title: "You're invited to WoPhoto Studio",
    message: `A studio manager invited you to join WoPhoto Studio as a ${roleLabel[role]}. Use the button below to accept your invitation. This link can be used once and expires in seven days.`,
    link: invitePath,
    linkLabel: "Accept invitation",
    footerText: "This invitation was sent by your WoPhoto Studio manager. If you were not expecting it, you can ignore this email.",
  });
  const emailMessage = delivery.status === "sent"
    ? process.env.EMAIL_DELIVERY_MODE?.trim().toLowerCase() === "test"
      ? `Invitation created; a test email was sent to the configured test inbox instead of ${email}. Copy the link and share it with the intended recipient.`
      : `Invitation created and sent to ${email}.`
    : delivery.status === "preview"
      ? `Invitation created, but email delivery is not configured. Copy the link and share it with ${email}.`
      : `Invitation created, but the email could not be sent. Copy the link and share it with ${email}.`;
  return {
    success: true,
    email,
    role,
    invitationId: invitation.id,
    invitePath,
    expiresAt,
    emailDelivery: { status: delivery.status },
    message: `${emailMessage} It expires in seven days.`,
  };
}
