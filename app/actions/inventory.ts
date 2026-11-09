
import {
  InventoryCondition,
  InventoryStatus,
  LoanStatus,
  MaintenanceStatus,
  Prisma,
  StudioArea,
  UserRole,
} from "@/generated/prisma/client"
import { requireRole } from "@/lib/authz"
import { requireStudioManagerArea } from "@/lib/studio-access"
import { prisma } from "@/lib/prisma"
import { generateNextAssetTag } from "@/lib/inventory"
import { recordInventoryActivity } from "@/lib/inventory-activity"
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  retireInventoryItemSchema,
  retireInventoryItemsSchema,
  checkoutInventoryItemSchema,
  returnInventoryItemSchema,
  resolveMaintenanceSchema,
} from "@/lib/validation/inventory"

export type InventoryActionState = {
  error?: string
  success?: string
  itemId?: string
  loanId?: string
}

function revalidateInventory() {
  // TanStack Router invalidates route queries on navigation/mutation
}

export async function createInventoryItem(
  data: unknown
): Promise<InventoryActionState> {
  try {
    const { actor, context } = await requireStudioManagerArea(StudioArea.INVENTORY)

    const parsed = createInventoryItemSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." }
    }

    const {
      name,
      category,
      assetTag: customTag,
      model,
      serialNumber,
      condition,
      location,
      purchaseDate,
      metadata,
      notes,
    } = parsed.data

    const assetTag = customTag?.trim() || (await generateNextAssetTag())

    // Check unique constraints
    const existingTag = await prisma.inventoryItem.findUnique({
      where: { studioId_assetTag: { studioId: context.studioId, assetTag } },
    })
    if (existingTag) {
      return {
        error: `Asset tag "${assetTag}" is already in use. Please choose another.`,
      }
    }

    if (serialNumber) {
      const existingSerial = await prisma.inventoryItem.findUnique({
        where: { studioId_serialNumber: { studioId: context.studioId, serialNumber } },
      })
      if (existingSerial) {
        return {
          error: `Serial number "${serialNumber}" is already registered to another item.`,
        }
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          assetTag,
          studioId: context.studioId,
          name,
          category: category || "General",
          model: model || null,
          serialNumber: serialNumber || null,
          status: InventoryStatus.AVAILABLE,
          condition: condition || InventoryCondition.GOOD,
          location: location || null,
          purchaseDate: purchaseDate || null,
          metadata: (metadata || {}) as Prisma.InputJsonValue,
          notes: notes || null,
        },
      })
      await recordInventoryActivity(tx, {
        itemId: created.id,
        actor,
        action: "ITEM_CREATED",
        details: { assetTag: created.assetTag, name: created.name },
      })
      return created
    })

    revalidateInventory()
    return {
      success: `Asset "${item.name}" (${item.assetTag}) created successfully.`,
      itemId: item.id,
    }
  } catch (error) {
    console.error("createInventoryItem error:", error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create inventory item.",
    }
  }
}

export async function updateInventoryItem(
  data: unknown
): Promise<InventoryActionState> {
  try {
    const { actor, context } = await requireStudioManagerArea(StudioArea.INVENTORY)

    const parsed = updateInventoryItemSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." }
    }

    const {
      id,
      name,
      category,
      assetTag,
      model,
      serialNumber,
      condition,
      location,
      purchaseDate,
      metadata,
      notes,
    } = parsed.data

    const existing = await prisma.inventoryItem.findFirst({ where: { id, studioId: context.studioId } })
    if (!existing) {
      return { error: "Inventory item not found." }
    }

    if (assetTag && assetTag !== existing.assetTag) {
      const tagConflict = await prisma.inventoryItem.findUnique({
        where: { studioId_assetTag: { studioId: context.studioId, assetTag } },
      })
      if (tagConflict) {
        return {
          error: `Asset tag "${assetTag}" is already in use by another item.`,
        }
      }
    }

    if (serialNumber && serialNumber !== existing.serialNumber) {
      const serialConflict = await prisma.inventoryItem.findUnique({
        where: { studioId_serialNumber: { studioId: context.studioId, serialNumber } },
      })
      if (serialConflict) {
        return {
          error: `Serial number "${serialNumber}" is already in use by another item.`,
        }
      }
    }

    const updateData: Prisma.InventoryItemUpdateInput = {
        ...(name !== undefined ? { name } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(assetTag !== undefined ? { assetTag } : {}),
        ...(model !== undefined ? { model: model || null } : {}),
        ...(serialNumber !== undefined
          ? { serialNumber: serialNumber || null }
          : {}),
        ...(condition !== undefined ? { condition } : {}),
        ...(location !== undefined ? { location: location || null } : {}),
        ...(purchaseDate !== undefined
          ? { purchaseDate: purchaseDate || null }
          : {}),
        ...(metadata !== undefined
          ? { metadata: (metadata || {}) as Prisma.InputJsonValue }
          : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      }
    const changedFields = Object.keys(updateData)
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.inventoryItem.update({ where: { id }, data: updateData })
      if (changedFields.length > 0) {
        await recordInventoryActivity(tx, {
          itemId: result.id,
          actor,
          action: "ITEM_UPDATED",
          details: { changedFields },
        })
      }
      return result
    })

    revalidateInventory()
    return {
      success: `Asset "${updated.name}" updated successfully.`,
      itemId: updated.id,
    }
  } catch (error) {
    console.error("updateInventoryItem error:", error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update inventory item.",
    }
  }
}

export async function retireInventoryItem(
  data: unknown
): Promise<InventoryActionState> {
  try {
    const { actor, context } = await requireStudioManagerArea(StudioArea.INVENTORY)

    const parsed = retireInventoryItemSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." }
    }

    const { id, reason } = parsed.data

    const item = await prisma.inventoryItem.findFirst({ where: { id, studioId: context.studioId } })
    if (!item) {
      return { error: "Inventory item not found." }
    }

    if (item.status === InventoryStatus.IN_USE) {
      return {
        error:
          "Cannot retire an asset that is currently checked out. Return the asset first.",
      }
    }

    const retirement = await prisma.$transaction(async (tx) => {
      const result = await tx.inventoryItem.updateMany({
        where: {
          id,
          status: {
            in: [InventoryStatus.AVAILABLE, InventoryStatus.MAINTENANCE],
          },
        },
        data: {
          status: InventoryStatus.RETIRED,
          notes: reason
            ? `${item.notes ? item.notes + "\n" : ""}[Retired: ${new Date().toLocaleDateString()}] ${reason}`
            : item.notes,
        },
      })
      if (result.count === 1) {
        await recordInventoryActivity(tx, {
          itemId: item.id,
          actor,
          action: "ITEM_RETIRED",
          details: { reason: reason || null },
        })
      }
      return result
    })
    if (retirement.count === 0) {
      return {
        error:
          "The asset status changed and it cannot be retired. Refresh and try again.",
      }
    }

    revalidateInventory()
    return {
      success: `Asset "${item.name}" (${item.assetTag}) has been retired.`,
      itemId: item.id,
    }
  } catch (error) {
    console.error("retireInventoryItem error:", error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to retire inventory item.",
    }
  }
}

export async function retireInventoryItems(
  data: unknown
): Promise<InventoryActionState> {
  try {
    const { actor, context } = await requireStudioManagerArea(StudioArea.INVENTORY)

    const parsed = retireInventoryItemsSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." }
    }

    const { ids, reason } = parsed.data
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: ids }, studioId: context.studioId },
      select: {
        id: true,
        name: true,
        assetTag: true,
        notes: true,
        status: true,
      },
    })

    if (items.length !== ids.length) {
      return {
        error:
          "One or more selected assets could not be found. Refresh and try again.",
      }
    }

    const checkedOutItem = items.find(
      (item) => item.status === InventoryStatus.IN_USE
    )
    if (checkedOutItem) {
      return {
        error: `${checkedOutItem.name} is checked out. Return it before retiring the selected assets.`,
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const result = await tx.inventoryItem.updateMany({
          where: {
          id: item.id,
          studioId: context.studioId,
            status: {
              in: [InventoryStatus.AVAILABLE, InventoryStatus.MAINTENANCE],
            },
          },
          data: {
            status: InventoryStatus.RETIRED,
            notes: reason
              ? `${item.notes ? `${item.notes}\n` : ""}[Retired: ${new Date().toLocaleDateString()}] ${reason}`
              : item.notes,
          },
        })
        if (result.count !== 1) {
          throw new Error(`${item.name} changed status. Refresh and try again.`)
        }
        await recordInventoryActivity(tx, {
          itemId: item.id,
          actor,
          action: "ITEM_RETIRED",
          details: { reason: reason || null },
        })
      }
    })

    revalidateInventory()
    return {
      success: `${items.length} asset${items.length === 1 ? "" : "s"} retired.`,
      itemId: ids[0],
    }
  } catch (error) {
    console.error("retireInventoryItems error:", error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to retire selected assets.",
    }
  }
}

export async function checkoutInventoryItem(
  data: unknown
): Promise<InventoryActionState> {
  try {
    const user = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER)
    const studioContext = user.role === UserRole.WORKER ? null : (await requireStudioManagerArea(StudioArea.INVENTORY)).context

    const parsed = checkoutInventoryItemSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." }
    }

    const { itemId, expectedReturnAt, notes } = parsed.data

    // Reserve the item and create its active loan in one transaction. If the
    // insert fails, the status change rolls back instead of stranding the item.
    const loan = await prisma.$transaction(async (tx) => {
      const reservation = await tx.inventoryItem.updateMany({
        where: { id: itemId, ...(studioContext ? { studioId: studioContext.studioId } : {}), status: InventoryStatus.AVAILABLE },
        data: { status: InventoryStatus.IN_USE },
      })
      if (reservation.count === 0) return null

      const loan = await tx.inventoryLoan.create({
        data: {
          itemId,
          borrowerId: user.id,
          expectedReturnAt: expectedReturnAt || null,
          checkoutNotes: notes || null,
          status: LoanStatus.ACTIVE,
        },
      })
      await recordInventoryActivity(tx, {
        itemId,
        actor: user,
        action: "ITEM_CHECKED_OUT",
        details: {
          loanId: loan.id,
          expectedReturnAt: expectedReturnAt?.toISOString() ?? null,
        },
      })
      return loan
    })

    if (!loan) {
      const item = await prisma.inventoryItem.findUnique({
        where: { id: itemId, ...(studioContext ? { studioId: studioContext.studioId } : {}) },
      })
      if (!item) return { error: "Inventory item not found." }
      return {
        error: `"${item.name}" is currently not available for check-out (Status: ${item.status}).`,
      }
    }

    revalidateInventory()
    return {
      success: "Asset checked out successfully.",
      loanId: loan.id,
      itemId,
    }
  } catch (error) {
    console.error("checkoutInventoryItem error:", error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to check out inventory item.",
    }
  }
}

export async function returnInventoryItem(
  data: unknown
): Promise<InventoryActionState> {
  try {
    const user = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER)
    const studioContext = user.role === UserRole.WORKER ? null : (await requireStudioManagerArea(StudioArea.INVENTORY)).context

    const parsed = returnInventoryItemSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." }
    }

    const { loanId, condition, notes, hasIssue, issueDetails } = parsed.data

    const returnedAt = new Date()
    const loan = await prisma.inventoryLoan.findUnique({
      where: { id: loanId, ...(studioContext ? { item: { studioId: studioContext.studioId } } : {}) },
      include: { item: true, borrower: true },
    })

    if (!loan) return { error: "Active loan record not found." }
    if (loan.status !== LoanStatus.ACTIVE)
      return { error: "This loan has already been returned." }
    if (loan.borrowerId !== user.id) {
      return {
        error:
          "Only the person who checked out this item can return it.",
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const loanUpdate = await tx.inventoryLoan.updateMany({
        where: {
          id: loanId,
          status: LoanStatus.ACTIVE,
          borrowerId: user.id,
        },
        data: {
          status: LoanStatus.RETURNED,
          returnedAt,
          returnCondition: condition,
          returnNotes: notes || null,
          hasIssueReport: hasIssue,
          issueDetails: hasIssue
            ? issueDetails || "Issue reported during return."
            : null,
        },
      })
      if (loanUpdate.count === 0) return false

      const itemUpdate = await tx.inventoryItem.updateMany({
        where: { id: loan.itemId, ...(studioContext ? { studioId: studioContext.studioId } : {}), status: InventoryStatus.IN_USE },
        data: hasIssue
          ? {
              status: InventoryStatus.MAINTENANCE,
              condition: InventoryCondition.NEEDS_ATTENTION,
            }
          : { status: InventoryStatus.AVAILABLE, condition },
      })
      if (itemUpdate.count === 0) {
        throw new Error(
          "This asset is no longer marked as checked out. Refresh and try again."
        )
      }

      await recordInventoryActivity(tx, {
        itemId: loan.itemId,
        actor: user,
        action: "ITEM_RETURNED",
        details: {
          loanId: loan.id,
          condition,
          issueReported: hasIssue,
        },
        occurredAt: returnedAt,
      })

      // 2. If issue flagged, create maintenance ticket and set item to MAINTENANCE
      if (hasIssue) {
        const maintenance = await tx.inventoryMaintenanceLog.create({
          data: {
            itemId: loan.itemId,
            reportedById: user.id,
            title: `Issue reported on return by ${user.name || user.email}`,
            description: issueDetails || "Item returned with condition issue.",
            status: MaintenanceStatus.OPEN,
          },
        })
        await recordInventoryActivity(tx, {
          itemId: loan.itemId,
          actor: user,
          action: "MAINTENANCE_REPORTED",
          details: { maintenanceLogId: maintenance.id, title: maintenance.title },
          occurredAt: returnedAt,
        })
      }
      return true
    })

    if (!result) return { error: "This loan has already been returned." }

    revalidateInventory()
    return {
      success: hasIssue
        ? `Asset returned and flagged for maintenance (${loan.item.name}).`
        : `Asset "${loan.item.name}" returned successfully.`,
      loanId: loan.id,
      itemId: loan.itemId,
    }
  } catch (error) {
    console.error("returnInventoryItem error:", error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to return inventory item.",
    }
  }
}

export async function resolveMaintenanceIssue(
  data: unknown
): Promise<InventoryActionState> {
  try {
    const { actor: user, context } = await requireStudioManagerArea(StudioArea.INVENTORY)

    const parsed = resolveMaintenanceSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input data." }
    }

    const { logId, resolutionNotes, restoredCondition, cost } = parsed.data

    const log = await prisma.inventoryMaintenanceLog.findUnique({
      where: { id: logId, item: { studioId: context.studioId } },
      include: { item: true },
    })

    if (!log) {
      return { error: "Maintenance log not found." }
    }

    if (
      log.status === MaintenanceStatus.RESOLVED ||
      log.status === MaintenanceStatus.CLOSED
    ) {
      return { error: "This maintenance ticket is already resolved." }
    }

    const resolved = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.inventoryMaintenanceLog.updateMany({
        where: {
          id: logId,
          item: { studioId: context.studioId },
          status: {
            in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS],
          },
        },
        data: {
          status: MaintenanceStatus.RESOLVED,
          resolutionNotes,
          cost: cost !== null && cost !== undefined ? cost : null,
          resolvedAt: new Date(),
          resolvedById: user.id,
        },
      })
      if (updateResult.count === 0) return false

      // 2. Check if any other open/in-progress maintenance tickets exist for this item
      const remainingOpenCount = await tx.inventoryMaintenanceLog.count({
        where: {
          itemId: log.itemId,
          id: { not: logId },
          status: {
            in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS],
          },
        },
      })

      // 3. Only transition item back to AVAILABLE if all issues are resolved
      if (remainingOpenCount === 0) {
        await tx.inventoryItem.updateMany({
          where: { id: log.itemId, studioId: context.studioId, status: InventoryStatus.MAINTENANCE },
          data: {
            status: InventoryStatus.AVAILABLE,
            condition: restoredCondition || InventoryCondition.GOOD,
          },
        })
      }
      await recordInventoryActivity(tx, {
        itemId: log.itemId,
        actor: user,
        action: "MAINTENANCE_RESOLVED",
        details: {
          maintenanceLogId: log.id,
          restoredCondition: restoredCondition || InventoryCondition.GOOD,
          cost: cost ?? null,
        },
      })
      return true
    })

    if (!resolved)
      return {
        error:
          "This maintenance ticket was already updated. Refresh and try again.",
      }

    revalidateInventory()
    return {
      success: `Maintenance issue for "${log.item.name}" resolved successfully.`,
      itemId: log.itemId,
    }
  } catch (error) {
    console.error("resolveMaintenanceIssue error:", error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to resolve maintenance issue.",
    }
  }
}
