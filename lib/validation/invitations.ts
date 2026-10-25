import { z } from "zod";
import { UserRole } from "@/generated/prisma/client";
import { idSchema } from "./common";

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, "Email address must be 254 characters or fewer.").email("Enter a valid email address."),
  role: z.enum([UserRole.WORKER, UserRole.CLIENT], { error: "Choose Worker or Client. Manager access is provisioned separately." }),
});

export const createClientInvitationProposalSchema = z.object({
  email: createInvitationSchema.shape.email,
  role: z.literal(UserRole.CLIENT),
}).strict();

export const invitationIdSchema = idSchema;
export const invitationTokenSchema = z.string().min(32, "This invitation link is invalid.").max(256, "This invitation link is invalid.");
