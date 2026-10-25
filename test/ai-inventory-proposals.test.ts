import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  itemFindUnique: vi.fn(),
  loanFindUnique: vi.fn(),
  maintenanceFindUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    inventoryItem: { findUnique: mocks.itemFindUnique },
    inventoryLoan: { findUnique: mocks.loanFindUnique },
    inventoryMaintenanceLog: { findUnique: mocks.maintenanceFindUnique },
  },
}));

import { UserRole } from "@/generated/prisma/client";
import { prepareInventoryAction } from "@/lib/ai/inventory-proposals";

describe("Copilot inventory action proposals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prepares a manager inventory item proposal without writing it", async () => {
    const result = await prepareInventoryAction("manager-1", UserRole.MANAGER, {
      action: "CREATE_ITEM", input: { name: "Sony FX3" },
    });

    expect(result).toMatchObject({
      requiresConfirmation: true,
      proposalType: "INVENTORY_ACTION",
      title: "Add inventory item: Sony FX3",
      payload: { action: "CREATE_ITEM", input: { name: "Sony FX3", category: "General", condition: "GOOD" } },
    });
    expect(mocks.itemFindUnique).not.toHaveBeenCalled();
  });

  it("prepares a worker checkout proposal only for available inventory", async () => {
    mocks.itemFindUnique.mockResolvedValue({ id: "item-1", name: "Sony FX3", assetTag: "INV-0001", category: "Video", status: "AVAILABLE" });

    const result = await prepareInventoryAction("worker-1", UserRole.WORKER, {
      action: "CHECKOUT_ITEM", input: { itemId: "item-1" },
    });

    expect(result).toMatchObject({
      requiresConfirmation: true,
      proposalType: "INVENTORY_ACTION",
      title: "Check out inventory item: Sony FX3",
      inventoryPreview: { values: expect.arrayContaining([{ label: "Asset tag", value: "INV-0001" }]) },
    });
  });

  it("does not prepare manager actions for workers", async () => {
    const result = await prepareInventoryAction("worker-1", UserRole.WORKER, {
      action: "RETIRE_ITEM", input: { id: "item-1" },
    });

    expect(result).toMatchObject({ error: "Only managers can create, edit, retire, or resolve inventory records." });
    expect(mocks.itemFindUnique).not.toHaveBeenCalled();
  });

  it("blocks clients from inventory proposals", async () => {
    const result = await prepareInventoryAction("client-1", UserRole.CLIENT, {
      action: "CREATE_ITEM", input: { name: "Camera" },
    });

    expect(result).toMatchObject({ error: "Client accounts cannot access internal inventory." });
    expect(mocks.itemFindUnique).not.toHaveBeenCalled();
  });

  it("only prepares returns for an active loan belonging to the worker", async () => {
    mocks.loanFindUnique.mockResolvedValue({
      status: "ACTIVE", borrowerId: "other-worker", item: { name: "Sony FX3", assetTag: "INV-0001" },
    });

    const result = await prepareInventoryAction("worker-1", UserRole.WORKER, {
      action: "RETURN_ITEM", input: { loanId: "loan-1" },
    });

    expect(result).toMatchObject({ error: "You can only return inventory checked out to your own account." });
  });
});
