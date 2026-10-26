import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  itemFindFirst: vi.fn(),
  itemFindUnique: vi.fn(),
  itemFindMany: vi.fn(),
  itemCount: vi.fn(),
  itemGroupBy: vi.fn(),
  itemCreate: vi.fn(),
  itemUpdate: vi.fn(),
  itemUpdateMany: vi.fn(),
  loanFindFirst: vi.fn(),
  loanFindUnique: vi.fn(),
  loanFindMany: vi.fn(),
  loanCount: vi.fn(),
  loanCreate: vi.fn(),
  loanUpdate: vi.fn(),
  loanUpdateMany: vi.fn(),
  maintenanceFindUnique: vi.fn(),
  maintenanceFindMany: vi.fn(),
  maintenanceCount: vi.fn(),
  maintenanceCreate: vi.fn(),
  maintenanceUpdate: vi.fn(),
  maintenanceUpdateMany: vi.fn(),
  activityFindMany: vi.fn(),
  activityCount: vi.fn(),
  activityCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authz", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/studio-access", () => {
  const actor = async () => mocks.requireRole("MANAGER");
  const context = (user: { id: string; role: string }) => ({
    studioId: `studio-${user.id}`, ownerUserId: user.id, isOwner: user.role === "MANAGER",
    memberId: null, role: user.role, grants: {},
  });
  return {
    requireStudioArea: async () => { const user = await actor(); return { user, context: context(user) }; },
    requireStudioManagerArea: async () => { const user = await actor(); return { manager: { ...user, actorId: user.id }, actor: user, context: context(user) }; },
    requireStudioOwner: async () => { const user = await actor(); return { user, context: context(user) }; },
    getStudioAccessContext: async (userId: string, role: string) => ({ studioId: `studio-${userId}`, ownerUserId: role === "MANAGER" ? userId : "manager-1", isOwner: role === "MANAGER", memberId: role === "MANAGER" ? null : "member-1", role, grants: {} }),
    hasStudioAccess: () => true,
  };
});


const mockPrismaTx = {
  inventoryItem: {
    findUnique: mocks.itemFindUnique,
    create: mocks.itemCreate,
    update: mocks.itemUpdate,
    updateMany: mocks.itemUpdateMany,
    count: mocks.itemCount,
  },
  inventoryLoan: {
    findUnique: mocks.loanFindUnique,
    create: mocks.loanCreate,
    update: mocks.loanUpdate,
    updateMany: mocks.loanUpdateMany,
    count: mocks.loanCount,
  },
  inventoryMaintenanceLog: {
    findUnique: mocks.maintenanceFindUnique,
    create: mocks.maintenanceCreate,
    update: mocks.maintenanceUpdate,
    updateMany: mocks.maintenanceUpdateMany,
    count: mocks.maintenanceCount,
  },
  inventoryActivityLog: {
    create: mocks.activityCreate,
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inventoryItem: {
      findFirst: mocks.itemFindFirst,
      findUnique: mocks.itemFindUnique,
      findMany: mocks.itemFindMany,
      count: mocks.itemCount,
      groupBy: mocks.itemGroupBy,
      create: mocks.itemCreate,
      update: mocks.itemUpdate,
      updateMany: mocks.itemUpdateMany,
    },
    inventoryLoan: {
      findFirst: mocks.loanFindFirst,
      findUnique: mocks.loanFindUnique,
      findMany: mocks.loanFindMany,
      count: mocks.loanCount,
      create: mocks.loanCreate,
      update: mocks.loanUpdate,
      updateMany: mocks.loanUpdateMany,
    },
    inventoryMaintenanceLog: {
      findUnique: mocks.maintenanceFindUnique,
      findMany: mocks.maintenanceFindMany,
      count: mocks.maintenanceCount,
      create: mocks.maintenanceCreate,
      update: mocks.maintenanceUpdate,
      updateMany: mocks.maintenanceUpdateMany,
    },
    inventoryActivityLog: {
      findMany: mocks.activityFindMany,
      count: mocks.activityCount,
      create: mocks.activityCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  createInventoryItem,
  retireInventoryItem,
  checkoutInventoryItem,
  returnInventoryItem,
  resolveMaintenanceIssue,
} from "@/app/actions/inventory";
import {
  generateNextAssetTag,
  getInventoryCatalog,
} from "@/lib/inventory";
import {
  InventoryCondition,
  InventoryStatus,
  LoanStatus,
  MaintenanceStatus,
  UserRole,
} from "@/generated/prisma/client";
import {
  createInventoryItemSchema,
  returnInventoryItemSchema,
} from "@/lib/validation/inventory";

describe("Inventory Management System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (cb: (tx: typeof mockPrismaTx) => Promise<unknown>) => {
      return cb(mockPrismaTx);
      },
    );
    mocks.loanUpdateMany.mockResolvedValue({ count: 1 });
    mocks.maintenanceUpdateMany.mockResolvedValue({ count: 1 });
    mocks.itemUpdateMany.mockResolvedValue({ count: 1 });
    mocks.maintenanceCreate.mockResolvedValue({ id: "maintenance-1" });
    mocks.activityCreate.mockResolvedValue({ id: "activity-1" });
    mocks.activityFindMany.mockResolvedValue([]);
    mocks.activityCount.mockResolvedValue(0);
  });

  describe("Input validation", () => {
    it("rejects invalid purchase dates and malformed custom metadata", () => {
      expect(
        createInventoryItemSchema.safeParse({
          name: "Camera Body",
          purchaseDate: "not-a-date",
        }).success,
      ).toBe(false);
      expect(
        createInventoryItemSchema.safeParse({
          name: "Camera Body",
          metadata: "{bad json",
        }).success,
      ).toBe(false);
    });

    it("enforces the 10 KB custom metadata limit and damage report details", () => {
      expect(
        createInventoryItemSchema.safeParse({
          name: "Camera Body",
          metadata: { notes: "x".repeat(10_300) },
        }).success,
      ).toBe(false);
      expect(
        returnInventoryItemSchema.safeParse({
          loanId: "loan-1",
          condition: InventoryCondition.NEEDS_ATTENTION,
        }).success,
      ).toBe(false);
    });
  });

  describe("Asset Tag Generator", () => {
    it("generates INV-0001 when no inventory exists", async () => {
      mocks.itemFindFirst.mockResolvedValue(null);
      const tag = await generateNextAssetTag();
      expect(tag).toBe("INV-0001");
    });

    it("increments sequential asset tag from highest existing tag", async () => {
      mocks.itemFindFirst.mockResolvedValue({ assetTag: "INV-0042" });
      const tag = await generateNextAssetTag();
      expect(tag).toBe("INV-0043");
    });
  });

  describe("Item Creation & Management (Manager Role)", () => {
    it("allows a manager to create an asset with only a name (all other fields optional)", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });
      mocks.itemFindFirst.mockResolvedValue({ assetTag: "INV-0005" });
      mocks.itemFindUnique.mockResolvedValue(null);
      mocks.itemCreate.mockResolvedValue({
        id: "item-new",
        name: "Sony FX3 Camera Rig",
        assetTag: "INV-0006",
        category: "General",
        status: InventoryStatus.AVAILABLE,
        condition: InventoryCondition.GOOD,
      });

      const result = await createInventoryItem({
        name: "Sony FX3 Camera Rig",
      });

      expect(result).toMatchObject({
        success: expect.stringContaining("Sony FX3 Camera Rig"),
        itemId: "item-new",
      });
      expect(mocks.itemCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Sony FX3 Camera Rig",
            assetTag: "INV-0006",
            status: InventoryStatus.AVAILABLE,
          }),
        })
      );
    });

    it("supports multi-disciplinary assets with custom tags and rich metadata", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });
      mocks.itemFindUnique.mockResolvedValue(null);
      mocks.itemCreate.mockResolvedValue({
        id: "item-tablet",
        name: "Wacom Cintiq Pro 27",
        assetTag: "CREATIVE-TAB-01",
        category: "Design & Creative",
        metadata: { displayRes: "4K", stylusPressure: 8192 },
      });

      const result = await createInventoryItem({
        name: "Wacom Cintiq Pro 27",
        assetTag: "CREATIVE-TAB-01",
        category: "Design & Creative",
        condition: InventoryCondition.EXCELLENT,
        metadata: { displayRes: "4K", stylusPressure: 8192 },
      });

      expect(result.success).toBeDefined();
      expect(mocks.itemCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetTag: "CREATIVE-TAB-01",
            category: "Design & Creative",
            metadata: { displayRes: "4K", stylusPressure: 8192 },
          }),
        })
      );
    });

    it("rejects non-managers attempting to create items", async () => {
      mocks.requireRole.mockRejectedValue(new Error("Unauthorized: MANAGER required"));
      const result = await createInventoryItem({ name: "Rogue Item" });
      expect(result.error).toContain("Unauthorized");
    });

    it("rejects creation if asset tag is already in use", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });
      mocks.itemFindUnique.mockResolvedValueOnce({ id: "item-existing", assetTag: "INV-0001" });

      const result = await createInventoryItem({
        name: "Duplicate Tag Item",
        assetTag: "INV-0001",
      });

      expect(result.error).toContain('Asset tag "INV-0001" is already in use');
    });
  });

  describe("Checkout Flow & Atomic Concurrency Locking", () => {
    it("successfully checks out available gear and sets expected return timestamp", async () => {
      const workerUser = { id: "worker-1", role: UserRole.WORKER, name: "Jordan Staff" };
      mocks.requireRole.mockResolvedValue(workerUser);

      // Item exists and is currently AVAILABLE
      mocks.itemFindUnique.mockResolvedValue({
        id: "item-1",
        name: "Canon R5 Mirrorless",
        status: InventoryStatus.AVAILABLE,
      });

      // Atomic update succeeds (count: 1)
      mocks.itemUpdateMany.mockResolvedValue({ count: 1 });

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mocks.loanCreate.mockResolvedValue({
        id: "loan-1",
        itemId: "item-1",
        borrowerId: "worker-1",
        status: LoanStatus.ACTIVE,
        expectedReturnAt: new Date(futureDate),
      });

      const result = await checkoutInventoryItem({
        itemId: "item-1",
        expectedReturnAt: futureDate,
        notes: "Studio shoot with Acme Corp",
      });

      expect(result.success).toContain("checked out successfully");
      expect(mocks.itemUpdateMany).toHaveBeenCalledWith({
        where: { id: "item-1", status: InventoryStatus.AVAILABLE },
        data: { status: InventoryStatus.IN_USE },
      });
      expect(mocks.loanCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: "item-1",
            borrowerId: "worker-1",
            status: LoanStatus.ACTIVE,
            checkoutNotes: "Studio shoot with Acme Corp",
          }),
        })
      );
    });

    it("prevents race condition: second concurrent checkout receives clean conflict error", async () => {
      const workerTwo = { id: "worker-2", role: UserRole.WORKER };
      mocks.requireRole.mockResolvedValue(workerTwo);

      mocks.itemFindFirst.mockResolvedValue({
        id: "item-1",
        name: "Canon R5 Mirrorless",
        status: InventoryStatus.AVAILABLE,
      });

      // Atomic update finds 0 rows because another request snatched it first
      mocks.itemUpdateMany.mockResolvedValue({ count: 0 });

      const result = await checkoutInventoryItem({
        itemId: "item-1",
      });

      expect(result.error).toContain("is currently not available for check-out");
      expect(mocks.loanCreate).not.toHaveBeenCalled();
    });

    it("rejects checkout when item is in MAINTENANCE status", async () => {
      mocks.requireRole.mockResolvedValue({ id: "worker-1", role: UserRole.WORKER });
      mocks.itemFindUnique.mockResolvedValue({
        id: "item-1",
        name: "Broken Tripod",
        status: InventoryStatus.MAINTENANCE,
      });
      mocks.itemUpdateMany.mockResolvedValue({ count: 0 });

      const result = await checkoutInventoryItem({ itemId: "item-1" });
      expect(result.error).toContain("is currently not available for check-out");
    });
  });

  describe("Return Workflow & Damage Reporting", () => {
    it("returns gear in good condition, returning item status to AVAILABLE", async () => {
      const borrower = { id: "worker-1", role: UserRole.WORKER };
      mocks.requireRole.mockResolvedValue(borrower);

      mocks.loanFindUnique.mockResolvedValue({
        id: "loan-1",
        itemId: "item-1",
        borrowerId: "worker-1",
        status: LoanStatus.ACTIVE,
        item: { id: "item-1", name: "Canon 50mm f/1.2", status: InventoryStatus.IN_USE },
      });

      const result = await returnInventoryItem({
        loanId: "loan-1",
        condition: InventoryCondition.GOOD,
        notes: "Returned clean and packaged in case",
      });

      expect(result.success).toContain("returned successfully");
      expect(mocks.loanUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "loan-1", status: LoanStatus.ACTIVE, borrowerId: "worker-1" },
          data: expect.objectContaining({
            status: LoanStatus.RETURNED,
            returnCondition: InventoryCondition.GOOD,
          }),
        })
      );
      expect(mocks.itemUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "item-1", status: InventoryStatus.IN_USE },
          data: expect.objectContaining({
            status: InventoryStatus.AVAILABLE,
            condition: InventoryCondition.GOOD,
          }),
        })
      );
      expect(mocks.maintenanceCreate).not.toHaveBeenCalled();
    });

    it("transitions item to MAINTENANCE and creates repair ticket when returned with damage", async () => {
      const borrower = { id: "worker-1", role: UserRole.WORKER };
      mocks.requireRole.mockResolvedValue(borrower);

      mocks.loanFindUnique.mockResolvedValue({
        id: "loan-2",
        itemId: "item-2",
        borrowerId: "worker-1",
        status: LoanStatus.ACTIVE,
        item: { id: "item-2", name: "Wireless Mic Pack", status: InventoryStatus.IN_USE },
      });

      const result = await returnInventoryItem({
        loanId: "loan-2",
        condition: InventoryCondition.NEEDS_ATTENTION,
        hasIssue: true,
        issueDetails: "Transmitter battery door latch snapped off during outdoor shoot",
      });

      expect(result.success).toContain("flagged for maintenance");

      // Item should be updated to MAINTENANCE
      expect(mocks.itemUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "item-2", status: InventoryStatus.IN_USE },
          data: expect.objectContaining({
            status: InventoryStatus.MAINTENANCE,
            condition: InventoryCondition.NEEDS_ATTENTION,
          }),
        })
      );

      // Maintenance ticket must be opened
      expect(mocks.maintenanceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: "item-2",
            status: MaintenanceStatus.OPEN,
            description: "Transmitter battery door latch snapped off during outdoor shoot",
            reportedById: "worker-1",
          }),
        })
      );
    });

    it("blocks worker from returning another user's loan", async () => {
      mocks.requireRole.mockResolvedValue({ id: "worker-imposter", role: UserRole.WORKER });

      mocks.loanFindUnique.mockResolvedValue({
        id: "loan-3",
        itemId: "item-3",
        borrowerId: "worker-original",
        status: LoanStatus.ACTIVE,
        item: { id: "item-3", name: "Lighting Kit" },
      });

      const result = await returnInventoryItem({
        loanId: "loan-3",
        condition: InventoryCondition.GOOD,
      });

      expect(result.error).toContain("Only the person who checked out this item can return it.");
      expect(mocks.loanUpdateMany).not.toHaveBeenCalled();
    });

    it("blocks a manager from returning gear checked out by another user", async () => {
      mocks.requireRole.mockResolvedValue({ id: "manager-admin", role: UserRole.MANAGER });

      mocks.loanFindUnique.mockResolvedValue({
        id: "loan-3",
        itemId: "item-3",
        borrowerId: "worker-original",
        status: LoanStatus.ACTIVE,
        item: { id: "item-3", name: "Lighting Kit" },
      });

      const result = await returnInventoryItem({
        loanId: "loan-3",
        condition: InventoryCondition.GOOD,
      });

      expect(result.error).toContain("Only the person who checked out this item can return it.");
      expect(mocks.loanUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe("Maintenance Resolution Workflow", () => {
    it("allows manager to resolve ticket, record cost, and restore item to AVAILABLE", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });

      mocks.maintenanceFindUnique.mockResolvedValue({
        id: "maint-1",
        itemId: "item-3",
        status: MaintenanceStatus.OPEN,
        item: { id: "item-3", name: "Wireless Mic Pack" },
      });

      // No other open tickets remaining for this item
      mocks.maintenanceCount.mockResolvedValue(0);

      const result = await resolveMaintenanceIssue({
        logId: "maint-1",
        resolutionNotes: "Replaced battery door with genuine OEM spare part and calibrated audio gain",
        restoredCondition: InventoryCondition.EXCELLENT,
        cost: 35.5,
      });

      expect(result.success).toContain('Maintenance issue for "Wireless Mic Pack" resolved');
      expect(mocks.maintenanceUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "maint-1", item: { studioId: "studio-mgr-1" }, status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS] } },
          data: expect.objectContaining({
            status: MaintenanceStatus.RESOLVED,
            resolutionNotes: expect.stringContaining("Replaced battery door"),
            cost: 35.5,
            resolvedById: "mgr-1",
          }),
        })
      );
      expect(mocks.itemUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "item-3", studioId: "studio-mgr-1", status: InventoryStatus.MAINTENANCE },
          data: {
            status: InventoryStatus.AVAILABLE,
            condition: InventoryCondition.EXCELLENT,
          },
        })
      );
    });

    it("keeps item in MAINTENANCE if other unresolved maintenance tickets remain", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });

      mocks.maintenanceFindUnique.mockResolvedValue({
        id: "maint-1",
        itemId: "item-3",
        status: MaintenanceStatus.OPEN,
        item: { id: "item-3", name: "Wireless Mic Pack" },
      });

      // 1 other ticket remains open for this item
      mocks.maintenanceCount.mockResolvedValue(1);

      await resolveMaintenanceIssue({
        logId: "maint-1",
        resolutionNotes: "Part 1 fixed",
      });

      // Ticket is resolved
      expect(mocks.maintenanceUpdateMany).toHaveBeenCalled();
      // Item status is NOT reset to AVAILABLE because ticket 2 is still open
      expect(mocks.itemUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe("Asset Retirement & Decommissioning", () => {
    it("allows manager to retire an available asset", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });
      mocks.itemFindFirst.mockResolvedValue({
        id: "item-old",
        name: "Legacy MacBook Pro 2017",
        assetTag: "INV-0010",
        status: InventoryStatus.AVAILABLE,
        notes: null,
      });

      const result = await retireInventoryItem({
        id: "item-old",
        reason: "End of hardware life cycle",
      });

      expect(result.success).toContain("has been retired");
      expect(mocks.itemUpdateMany).toHaveBeenCalledWith({
        where: {
          id: "item-old",
          status: { in: [InventoryStatus.AVAILABLE, InventoryStatus.MAINTENANCE] },
        },
        data: {
          status: InventoryStatus.RETIRED,
          notes: expect.stringContaining("Retired:"),
        },
      });
    });

    it("prevents retiring an asset while it is currently checked out (IN_USE)", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });
      mocks.itemFindFirst.mockResolvedValue({
        id: "item-active",
        name: "Sony A7 IV",
        assetTag: "INV-0011",
        status: InventoryStatus.IN_USE,
      });

      const result = await retireInventoryItem({ id: "item-active" });
      expect(result.error).toContain("Cannot retire an asset that is currently checked out");
      expect(mocks.itemUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe("Catalog Queries & Dynamic Overdue Calculation", () => {
    it("denies clients access to the inventory catalog", async () => {
      mocks.requireRole.mockRejectedValue(new Error("Unauthorized: MANAGER or WORKER required"));

      await expect(getInventoryCatalog()).rejects.toThrow("Unauthorized");
      expect(mocks.itemFindMany).not.toHaveBeenCalled();
    });

    it("computes overdue flag dynamically at read time when expectedReturnAt is past", async () => {
      mocks.requireRole.mockResolvedValue({ id: "user-1", role: UserRole.WORKER });
      mocks.itemCount.mockResolvedValue(1);
      mocks.itemGroupBy.mockResolvedValue([{ status: InventoryStatus.IN_USE, _count: { id: 1 } }]);

      const pastReturnDate = new Date(Date.now() - 3600000); // 1 hour ago
      mocks.itemFindMany.mockResolvedValue([
        {
          id: "item-overdue",
          name: "Boom Pole Rig",
          status: InventoryStatus.IN_USE,
          loans: [
            {
              id: "loan-overdue",
              status: LoanStatus.ACTIVE,
              expectedReturnAt: pastReturnDate,
              borrower: { id: "borrower-1", name: "Alex Tech", email: "alex@wophoto.local", image: null },
            },
          ],
        },
      ]);

      const catalog = await getInventoryCatalog();
      expect(catalog.items).toHaveLength(1);
      expect(catalog.items[0]?.activeLoan?.isOverdue).toBe(true);
    });

    it("limits worker activity history to events performed by that worker", async () => {
      mocks.requireRole.mockResolvedValue({ id: "worker-1", role: UserRole.WORKER });
      mocks.itemCount.mockResolvedValue(0);
      mocks.itemGroupBy.mockResolvedValue([]);
      mocks.itemFindMany.mockResolvedValue([]);

      await getInventoryCatalog();

      expect(mocks.activityFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { actorId: "worker-1" } }),
      );
      expect(mocks.activityCount).toHaveBeenCalledWith({ where: { actorId: "worker-1" } });
    });

    it("shows all activity history to managers", async () => {
      mocks.requireRole.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
      mocks.itemCount.mockResolvedValue(0);
      mocks.itemGroupBy.mockResolvedValue([]);
      mocks.itemFindMany.mockResolvedValue([]);

      await getInventoryCatalog();

      expect(mocks.activityFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { item: { studioId: "studio-manager-1" } } }),
      );
      expect(mocks.activityCount).toHaveBeenCalledWith({ where: { item: { studioId: "studio-manager-1" } } });
    });

    it("marks loan not overdue when expectedReturnAt is in the future", async () => {
      mocks.requireRole.mockResolvedValue({ id: "user-1", role: UserRole.WORKER });
      mocks.itemCount.mockResolvedValue(1);
      mocks.itemGroupBy.mockResolvedValue([]);

      const futureReturnDate = new Date(Date.now() + 3600000 * 24); // tomorrow
      mocks.itemFindMany.mockResolvedValue([
        {
          id: "item-ok",
          name: "Red Komodo 6K",
          status: InventoryStatus.IN_USE,
          loans: [
            {
              id: "loan-ok",
              status: LoanStatus.ACTIVE,
              expectedReturnAt: futureReturnDate,
              borrower: { id: "borrower-1", name: "Alex Tech", email: "alex@wophoto.local", image: null },
            },
          ],
        },
      ]);

      const catalog = await getInventoryCatalog();
      expect(catalog.items[0]?.activeLoan?.isOverdue).toBe(false);
    });
  });
});
