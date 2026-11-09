
import { z } from "zod";
import { StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getStudioAccessContext, hasStudioAccess } from "@/lib/studio-access";
import {
  checkoutInventoryItemSchema,
  createInventoryItemSchema,
  resolveMaintenanceSchema,
  retireInventoryItemSchema,
  returnInventoryItemSchema,
  updateInventoryItemSchema,
} from "@/lib/validation/inventory";

export const inventoryActionPayloadSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_ITEM"), input: createInventoryItemSchema }).strict(),
  z.object({ action: z.literal("UPDATE_ITEM"), input: updateInventoryItemSchema }).strict(),
  z.object({ action: z.literal("RETIRE_ITEM"), input: retireInventoryItemSchema }).strict(),
  z.object({ action: z.literal("CHECKOUT_ITEM"), input: checkoutInventoryItemSchema }).strict(),
  z.object({ action: z.literal("RETURN_ITEM"), input: returnInventoryItemSchema }).strict(),
  z.object({ action: z.literal("RESOLVE_MAINTENANCE"), input: resolveMaintenanceSchema }).strict(),
]);

export type InventoryActionPayload = z.infer<typeof inventoryActionPayloadSchema>;

export type InventoryPreview = {
  title: string;
  values: Array<{ label: string; value: string }>;
};

function stringValue(value: unknown) {
  if (value instanceof Date) return value.toLocaleDateString();
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function preview(title: string, values: Record<string, unknown>): InventoryPreview {
  return {
    title,
    values: Object.entries(values).map(([label, value]) => ({ label, value: stringValue(value) })),
  };
}

export async function prepareInventoryAction(
  userId: string,
  role: UserRole,
  rawInput: unknown,
) {
  if (role === UserRole.CLIENT) return { error: "Client accounts cannot access internal inventory." };
  const managerSide = role === UserRole.MANAGER || role === UserRole.SUPERVISOR || role === UserRole.COLLABORATOR;
  const context = managerSide ? await getStudioAccessContext(userId, role) : null;
  if (managerSide && (!context || !hasStudioAccess(context, StudioArea.COPILOT) || !hasStudioAccess(context, StudioArea.INVENTORY, StudioAccessLevel.MANAGE))) {
    return { error: "You do not have Copilot and manage access to inventory." };
  }
  const parsed = inventoryActionPayloadSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The inventory action is invalid." };
  const payload = parsed.data;
  const managerOnly = payload.action === "CREATE_ITEM" || payload.action === "UPDATE_ITEM" ||
    payload.action === "RETIRE_ITEM" || payload.action === "RESOLVE_MAINTENANCE";
  if (managerOnly && !managerSide) {
    return { error: "Only managers can create, edit, retire, or resolve inventory records." };
  }

  let title = "Inventory action";
  let details = "Review the inventory change before confirming it.";
  let inventoryPreview: InventoryPreview;

  switch (payload.action) {
    case "CREATE_ITEM": {
      const input = payload.input;
      title = `Add inventory item: ${input.name}`;
      details = "This will add a new available item to the studio inventory.";
      inventoryPreview = preview("New inventory item", {
        Name: input.name, Category: input.category, "Asset tag": input.assetTag,
        Model: input.model, Condition: input.condition, Location: input.location,
        "Purchase date": input.purchaseDate, "Serial number": input.serialNumber,
      });
      break;
    }
    case "UPDATE_ITEM": {
      const input = payload.input;
      const item = context
        ? await prisma.inventoryItem.findFirst({ where: { id: input.id, studioId: context.studioId }, select: { name: true, assetTag: true } })
        : await prisma.inventoryItem.findUnique({ where: { id: input.id }, select: { name: true, assetTag: true } });
      if (!item) return { error: "Inventory item not found. Ask Copilot to find the item and prepare the change again." };
      title = `Update inventory item: ${input.name ?? item.name}`;
      details = `This will update item ${item.name} (${item.assetTag}).`;
      const changes = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "id"));
      inventoryPreview = preview(`${item.name} (${item.assetTag})`, changes);
      break;
    }
    case "RETIRE_ITEM": {
      const item = context
        ? await prisma.inventoryItem.findFirst({ where: { id: payload.input.id, studioId: context.studioId }, select: { name: true, assetTag: true, status: true } })
        : await prisma.inventoryItem.findUnique({ where: { id: payload.input.id }, select: { name: true, assetTag: true, status: true } });
      if (!item) return { error: "Inventory item not found. Ask Copilot to find the item and prepare the change again." };
      if (item.status === "IN_USE") return { error: `${item.name} is checked out and must be returned before it can be retired.` };
      title = `Retire inventory item: ${item.name}`;
      details = "This will mark the item as retired so it can no longer be checked out.";
      inventoryPreview = preview("Item to retire", { Name: item.name, "Asset tag": item.assetTag, Status: item.status, Reason: payload.input.reason });
      break;
    }
    case "CHECKOUT_ITEM": {
      const item = context
        ? await prisma.inventoryItem.findFirst({ where: { id: payload.input.itemId, studioId: context.studioId }, select: { name: true, assetTag: true, status: true, category: true } })
        : await prisma.inventoryItem.findUnique({ where: { id: payload.input.itemId }, select: { name: true, assetTag: true, status: true, category: true } });
      if (!item) return { error: "Inventory item not found. Ask Copilot to list available inventory and try again." };
      if (item.status !== "AVAILABLE") return { error: `${item.name} is not available for checkout (status: ${item.status}).` };
      title = `Check out inventory item: ${item.name}`;
      details = "This will check out the item to your signed in account.";
      inventoryPreview = preview("Checkout details", { Name: item.name, "Asset tag": item.assetTag, Category: item.category, "Expected return": payload.input.expectedReturnAt, Notes: payload.input.notes });
      break;
    }
    case "RETURN_ITEM": {
      const loan = context
        ? await prisma.inventoryLoan.findFirst({ where: { id: payload.input.loanId, item: { studioId: context.studioId } }, select: { status: true, borrowerId: true, item: { select: { name: true, assetTag: true } } } })
        : await prisma.inventoryLoan.findUnique({ where: { id: payload.input.loanId }, select: { status: true, borrowerId: true, item: { select: { name: true, assetTag: true } } } });
      if (!loan || loan.status !== "ACTIVE") return { error: "Active checkout not found. Ask Copilot to list your active inventory loans." };
      if (role === UserRole.WORKER && loan.borrowerId !== userId) return { error: "You can only return inventory checked out to your own account." };
      title = `Return inventory item: ${loan.item.name}`;
      details = payload.input.hasIssue
        ? "This return will report an issue and move the item into maintenance."
        : "This will record the item's condition and return it to available inventory.";
      inventoryPreview = preview("Return details", { Name: loan.item.name, "Asset tag": loan.item.assetTag, Condition: payload.input.condition, "Issue reported": payload.input.hasIssue, "Issue details": payload.input.issueDetails, Notes: payload.input.notes });
      break;
    }
    case "RESOLVE_MAINTENANCE": {
      const log = context
        ? await prisma.inventoryMaintenanceLog.findFirst({ where: { id: payload.input.logId, item: { studioId: context.studioId } }, select: { title: true, status: true, item: { select: { name: true, assetTag: true } } } })
        : await prisma.inventoryMaintenanceLog.findUnique({ where: { id: payload.input.logId }, select: { title: true, status: true, item: { select: { name: true, assetTag: true } } } });
      if (!log || !["OPEN", "IN_PROGRESS"].includes(log.status)) return { error: "Open maintenance record not found. Ask Copilot to list current maintenance records." };
      title = `Resolve maintenance: ${log.item.name}`;
      details = "This will record the repair resolution and update the item condition.";
      inventoryPreview = preview("Maintenance resolution", { Item: log.item.name, "Asset tag": log.item.assetTag, Issue: log.title, "Resolution notes": payload.input.resolutionNotes, "Restored condition": payload.input.restoredCondition, "Repair cost": payload.input.cost });
      break;
    }
  }

  return {
    requiresConfirmation: true,
    proposalType: "INVENTORY_ACTION",
    title,
    description: details,
    inventoryPreview,
    payload,
    message: "Review the inventory details, then confirm to apply the change.",
  };
}
