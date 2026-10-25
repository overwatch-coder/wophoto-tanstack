import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { createProjectForManager, createProjectInputSchema, createTaskBatchForManager, createTaskBatchInputSchema } from "@/lib/ai/actions";
import { createInvitationForManager } from "@/lib/invitations";
import { createClientInvitationProposalSchema } from "@/lib/validation/invitations";
import { UserRole } from "@/generated/prisma/client";
import { z } from "zod";

const confirmationSchema = z.discriminatedUnion("proposalType", [
  z.object({ proposalType: z.literal("CREATE_PROJECT"), payload: createProjectInputSchema }).strict(),
  z.object({ proposalType: z.literal("CREATE_TASK_BATCH"), payload: createTaskBatchInputSchema }).strict(),
  z.object({ proposalType: z.literal("CREATE_INVITATION"), payload: createClientInvitationProposalSchema }).strict(),
]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (session.user.role !== UserRole.MANAGER) {
    return Response.json({ error: "Only managers can apply these studio changes." }, { status: 403 });
  }

  let input: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 10_000) return Response.json({ error: "The confirmation request is too large." }, { status: 413 });
    input = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "The confirmation request is invalid." }, { status: 400 });
  }

  const parsed = confirmationSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "This proposal is invalid or has expired. Ask Copilot to prepare it again." }, { status: 400 });

  try {
    const result = parsed.data.proposalType === "CREATE_PROJECT"
      ? await createProjectForManager(session.user.id, parsed.data.payload)
      : parsed.data.proposalType === "CREATE_TASK_BATCH"
        ? await createTaskBatchForManager(session.user.id, parsed.data.payload)
        : await createInvitationForManager(session.user.id, parsed.data.payload);
    if ("error" in result) return Response.json({ error: result.error }, { status: 422 });
    if (parsed.data.proposalType === "CREATE_PROJECT") {
      revalidatePath("/manager/projects");
    } else if (parsed.data.proposalType === "CREATE_TASK_BATCH") {
      revalidatePath("/manager/tasks");
      revalidatePath("/manager/projects");
    }
    return Response.json(result);
  } catch (error) {
    console.error("AI proposal confirmation failed:", error);
    return Response.json({ error: "The proposed change could not be applied. Refresh the proposal and try again." }, { status: 500 });
  }
}
