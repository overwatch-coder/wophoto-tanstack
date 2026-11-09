import { createServerFn } from "@tanstack/react-start";
import { decodeActionArguments, encodeActionArguments, type EncodedActionArguments } from "@/lib/server-action-args";

import { InvitationStatus, StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudioOwner } from "@/lib/studio-access";
import { z } from "zod";

const grantsSchema = z.array(z.object({
  area: z.nativeEnum(StudioArea),
  accessLevel: z.nativeEnum(StudioAccessLevel),
}).strict()).max(12).refine((grants) => new Set(grants.map(({ area }) => area)).size === grants.length, "Each area can appear only once.");

const memberInputSchema = z.object({ memberId: z.string().min(1).max(128) }).strict();
const updateMemberSchema = z.object({
  memberId: z.string().min(1).max(128),
  role: z.enum([UserRole.SUPERVISOR, UserRole.COLLABORATOR]),
  permissions: grantsSchema.default([]),
}).strict();

export type StudioAccessActionResult = { success?: true; error?: string };

async function updateStudioMemberAccessServerImplementation(input: unknown): Promise<StudioAccessActionResult> {
  const { user: owner, context } = await requireStudioOwner();
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the role and area access." };
  const { memberId, role, permissions } = parsed.data;
  if (role !== UserRole.COLLABORATOR && permissions.length > 0) return { error: "Supervisors use their fixed access preset." };

  const member = await prisma.studioMember.findFirst({
    where: { id: memberId, studioId: context.studioId, revokedAt: null, userId: { not: owner.id } },
    select: { id: true, userId: true, user: { select: { role: true } } },
  });
  if (!member || (member.user.role !== UserRole.SUPERVISOR && member.user.role !== UserRole.COLLABORATOR)) {
    return { error: "That studio member is no longer available." };
  }

  await prisma.$transaction(async (tx) => {
    if (member.user.role !== role) {
      await tx.user.update({ where: { id: member.userId }, data: { role } });
      await tx.studioMemberPermission.deleteMany({ where: { studioMemberId: member.id } });
    }
    await tx.studioMemberPermission.deleteMany({ where: { studioMemberId: member.id } });
    if (role === UserRole.COLLABORATOR && permissions.length) {
      await tx.studioMemberPermission.createMany({ data: permissions.map((grant) => ({ ...grant, studioMemberId: member.id })) });
    }
  });
  return { success: true };
}

async function revokeStudioMemberServerImplementation(input: unknown): Promise<StudioAccessActionResult> {
  const { user: owner, context } = await requireStudioOwner();
  const parsed = memberInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose an active studio member." };

  const member = await prisma.studioMember.findFirst({
    where: { id: parsed.data.memberId, studioId: context.studioId, revokedAt: null, userId: { not: owner.id } },
    select: { id: true, userId: true, invitationId: true },
  });
  if (!member) return { error: "That member is already removed or unavailable." };

  await prisma.$transaction([
    prisma.studioMember.update({
      where: { id: member.id },
      data: { revokedAt: new Date(), revokedById: owner.id },
    }),
    prisma.invitation.updateMany({
      where: { id: member.invitationId, studioId: context.studioId, acceptedUserId: member.userId, status: InvitationStatus.USED },
      data: { status: InvitationStatus.REVOKED, tokenEncrypted: null },
    }),
    prisma.session.deleteMany({ where: { userId: member.userId } }),
  ]);
  return { success: true };
}


const updateStudioMemberAccessServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateStudioMemberAccessServerImplementation>>) => args)
  .handler(async ({ data }) => updateStudioMemberAccessServerImplementation(...decodeActionArguments<Parameters<typeof updateStudioMemberAccessServerImplementation>>(data)));
export const updateStudioMemberAccess = async (...args: Parameters<typeof updateStudioMemberAccessServerImplementation>) => updateStudioMemberAccessServerFunction({ data: await encodeActionArguments(args) });


const revokeStudioMemberServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof revokeStudioMemberServerImplementation>>) => args)
  .handler(async ({ data }) => revokeStudioMemberServerImplementation(...decodeActionArguments<Parameters<typeof revokeStudioMemberServerImplementation>>(data)));
export const revokeStudioMember = async (...args: Parameters<typeof revokeStudioMemberServerImplementation>) => revokeStudioMemberServerFunction({ data: await encodeActionArguments(args) });
