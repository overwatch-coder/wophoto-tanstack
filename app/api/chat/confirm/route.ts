import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { createProjectForManager, createProjectInputSchema, createTaskBatchForManager, createTaskBatchInputSchema } from "@/lib/ai/actions";
import { createInvitationForManager } from "@/lib/invitations";
import { createClientInvitationProposalSchema } from "@/lib/validation/invitations";
import { UserRole } from "@/generated/prisma/client";
import { z } from "zod";
import { inventoryActionPayloadSchema } from "@/lib/ai/inventory-proposals";
import {
  checkoutInventoryItem,
  createInventoryItem,
  resolveMaintenanceIssue,
  retireInventoryItem,
  returnInventoryItem,
  updateInventoryItem,
} from "@/app/actions/inventory";

const confirmationSchema = z.discriminatedUnion("proposalType", [
  z.object({ proposalType: z.literal("CREATE_PROJECT"), payload: createProjectInputSchema }).strict(),
  z.object({ proposalType: z.literal("CREATE_TASK_BATCH"), payload: createTaskBatchInputSchema }).strict(),
  z.object({ proposalType: z.literal("CREATE_INVITATION"), payload: createClientInvitationProposalSchema }).strict(),
  z.object({ proposalType: z.literal("INVENTORY_ACTION"), payload: inventoryActionPayloadSchema }).strict(),
]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (session.user.role !== UserRole.MANAGER && session.user.role !== UserRole.WORKER) {
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

  if (session.user.role === UserRole.WORKER &&
    (!input || typeof input !== "object" || (input as { proposalType?: unknown }).proposalType !== "INVENTORY_ACTION")) {
    return Response.json({ error: "Only managers can apply these studio changes." }, { status: 403 });
  }

  const parsed = confirmationSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "This proposal is invalid or has expired. Ask Copilot to prepare it again." }, { status: 400 });

  if (parsed.data.proposalType !== "INVENTORY_ACTION" && session.user.role !== UserRole.MANAGER) {
    return Response.json({ error: "Only managers can apply these studio changes." }, { status: 403 });
  }
  if (parsed.data.proposalType === "INVENTORY_ACTION") {
    const { action } = parsed.data.payload;
    const managerOnly = ["CREATE_ITEM", "UPDATE_ITEM", "RETIRE_ITEM", "RESOLVE_MAINTENANCE"].includes(action);
    if (managerOnly && session.user.role !== UserRole.MANAGER) {
      return Response.json({ error: "Only managers can perform this inventory action." }, { status: 403 });
    }
  }

  try {
    let result;
    if (parsed.data.proposalType === "CREATE_PROJECT") {
      result = await createProjectForManager(session.user.id, parsed.data.payload);
    } else if (parsed.data.proposalType === "CREATE_TASK_BATCH") {
      result = await createTaskBatchForManager(session.user.id, parsed.data.payload);
    } else if (parsed.data.proposalType === "CREATE_INVITATION") {
      result = await createInvitationForManager(session.user.id, parsed.data.payload);
    } else {
      const { action, input: actionInput } = parsed.data.payload;
      const inventoryResult = action === "CREATE_ITEM"
        ? await createInventoryItem(actionInput)
        : action === "UPDATE_ITEM"
          ? await updateInventoryItem(actionInput)
          : action === "RETIRE_ITEM"
            ? await retireInventoryItem(actionInput)
            : action === "CHECKOUT_ITEM"
              ? await checkoutInventoryItem(actionInput)
              : action === "RETURN_ITEM"
                ? await returnInventoryItem(actionInput)
                : await resolveMaintenanceIssue(actionInput);
      if (inventoryResult.error) return Response.json({ error: inventoryResult.error }, { status: 422 });
      revalidatePath("/manager/inventory");
      revalidatePath("/worker/inventory");
      return Response.json({ ...inventoryResult, message: inventoryResult.success });
    }
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
