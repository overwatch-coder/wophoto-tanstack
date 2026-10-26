import { z } from "zod";
import { StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/client";
import { idSchema } from "./common";

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, "Email address must be 254 characters or fewer.").email("Enter a valid email address."),
  role: z.enum([UserRole.WORKER, UserRole.CLIENT, UserRole.SUPERVISOR, UserRole.COLLABORATOR], { message: "Choose Worker, Client, Supervisor, or Collaborator." }),
  permissions: z.array(z.object({ area: z.nativeEnum(StudioArea), accessLevel: z.nativeEnum(StudioAccessLevel) }).strict()).max(12).optional(),
});

export const createClientInvitationProposalSchema = z.object({
  email: createInvitationSchema.shape.email,
  role: z.literal(UserRole.CLIENT),
}).strict();

export const invitationIdSchema = idSchema;
export const invitationTokenSchema = z.string().min(32, "This invitation link is invalid.").max(256, "This invitation link is invalid.");
