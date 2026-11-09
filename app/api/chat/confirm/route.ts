import { auth } from "@/auth";
import { createProjectForManager, createProjectInputSchema, createTaskBatchForManager, createTaskBatchInputSchema } from "@/lib/ai/actions";
import { createInvitationForManager } from "@/lib/invitations";
import { createClientInvitationProposalSchema } from "@/lib/validation/invitations";
import { StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/client";
import { isCopilotEnabledForUser } from "@/lib/ai/copilot-access";
import { getStudioAccessContext, hasStudioAccess } from "@/lib/studio-access";
import { z } from "zod";
import { inventoryActionPayloadSchema } from "@/lib/ai/inventory-proposals";
import { createDailyEntryForWorker, dailyEntryProposalSchema } from "@/lib/ai/daily-entry-proposals";
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
  z.object({ proposalType: z.literal("CREATE_DAILY_ENTRY"), payload: dailyEntryProposalSchema }).strict(),
]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!(await isCopilotEnabledForUser(session.user.id, session.user.role))) {
    return Response.json({ error: "Copilot is currently disabled for your account by your studio manager." }, { status: 403 });
  }
  const copilotActionRoles: UserRole[] = [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER];
  if (!copilotActionRoles.includes(session.user.role)) {
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
    (!input || typeof input !== "object" || !["INVENTORY_ACTION", "CREATE_DAILY_ENTRY"].includes(String((input as { proposalType?: unknown }).proposalType)))) {
    return Response.json({ error: "Workers can only confirm their own daily work entries and permitted inventory actions." }, { status: 403 });
  }

  const parsed = confirmationSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "This proposal is invalid or has expired. Ask Copilot to prepare it again." }, { status: 400 });

  if (parsed.data.proposalType === "CREATE_DAILY_ENTRY" && session.user.role !== UserRole.WORKER) {
    return Response.json({ error: "Only workers can log daily work entries." }, { status: 403 });
  }
  const managerSide = session.user.role === UserRole.MANAGER || session.user.role === UserRole.SUPERVISOR || session.user.role === UserRole.COLLABORATOR;
  let managerOwnerId = session.user.id;
  const requiredArea = parsed.data.proposalType === "CREATE_PROJECT"
    ? StudioArea.PROJECTS
    : parsed.data.proposalType === "CREATE_TASK_BATCH"
      ? StudioArea.TASKS
      : parsed.data.proposalType === "CREATE_INVITATION"
        ? StudioArea.TEAM
        : parsed.data.proposalType === "INVENTORY_ACTION"
          ? StudioArea.INVENTORY
          : null;
  if (managerSide && requiredArea) {
    const context = await getStudioAccessContext(session.user.id, session.user.role);
    if (context) managerOwnerId = context.ownerUserId;
    const writeAllowed = context && hasStudioAccess(context, StudioArea.COPILOT, StudioAccessLevel.VIEW) && hasStudioAccess(context, requiredArea, StudioAccessLevel.MANAGE);
    if (!writeAllowed) return Response.json({ error: "You do not have Copilot and manage access for this area." }, { status: 403 });
  }
  if (parsed.data.proposalType !== "INVENTORY_ACTION" && parsed.data.proposalType !== "CREATE_DAILY_ENTRY" && !managerSide) {
    return Response.json({ error: "Only managers can apply these studio changes." }, { status: 403 });
  }
  if (parsed.data.proposalType === "INVENTORY_ACTION") {
    const { action } = parsed.data.payload;
    const managerOnly = ["CREATE_ITEM", "UPDATE_ITEM", "RETIRE_ITEM", "RESOLVE_MAINTENANCE"].includes(action);
    if (managerOnly && !managerSide) {
      return Response.json({ error: "Only managers can perform this inventory action." }, { status: 403 });
    }
  }

  try {
    let result;
    if (parsed.data.proposalType === "CREATE_PROJECT") {
      result = await createProjectForManager(managerOwnerId, parsed.data.payload);
    } else if (parsed.data.proposalType === "CREATE_TASK_BATCH") {
      result = await createTaskBatchForManager(managerOwnerId, parsed.data.payload, session.user.id);
    } else if (parsed.data.proposalType === "CREATE_DAILY_ENTRY") {
      result = await createDailyEntryForWorker(session.user.id, parsed.data.payload);
    } else if (parsed.data.proposalType === "CREATE_INVITATION") {
      result = await createInvitationForManager(managerOwnerId, parsed.data.payload);
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
      return Response.json({ ...inventoryResult, message: inventoryResult.success });
    }
    if ("error" in result) return Response.json({ error: result.error }, { status: 422 });
    return Response.json(result);
  } catch (error) {
    console.error("AI proposal confirmation failed:", error);
    return Response.json({ error: "The proposed change could not be applied. Refresh the proposal and try again." }, { status: 500 });
  }
}
