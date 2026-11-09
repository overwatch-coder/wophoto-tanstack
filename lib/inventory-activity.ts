
import {
  InventoryActivityAction,
  Prisma,
} from "@/generated/prisma/client"

type InventoryActivityActor = {
  id: string
  name?: string | null
  email?: string | null
}

export async function recordInventoryActivity(
  tx: Prisma.TransactionClient,
  input: {
    itemId: string
    actor: InventoryActivityActor | null
    action: InventoryActivityAction
    details?: Prisma.InputJsonValue
    occurredAt?: Date
  }
) {
  await tx.inventoryActivityLog.create({
    data: {
      itemId: input.itemId,
      actorId: input.actor?.id ?? null,
      actorLabel: input.actor
        ? input.actor.name?.trim() || input.actor.email || "Unknown user"
        : "Actor not recorded",
      action: input.action,
      details: input.details ?? {},
      ...(input.occurredAt ? { createdAt: input.occurredAt } : {}),
    },
  })
}
