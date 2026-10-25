import "server-only";

import {
  Prisma,
  InventoryStatus,
  LoanStatus,
  MaintenanceStatus,
  UserRole,
} from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function generateNextAssetTag(): Promise<string> {
  const lastItem = await prisma.inventoryItem.findFirst({
    where: { assetTag: { startsWith: "INV-" } },
    orderBy: { createdAt: "desc" },
    select: { assetTag: true },
  });

  if (!lastItem?.assetTag) return "INV-0001";

  const match = lastItem.assetTag.match(/^INV-(\d+)$/);
  if (!match || !match[1]) {
    const totalCount = await prisma.inventoryItem.count();
    return `INV-${String(totalCount + 1).padStart(4, "0")}`;
  }

  const nextNum = parseInt(match[1], 10) + 1;
  return `INV-${String(nextNum).padStart(4, "0")}`;
}

export interface InventoryCatalogFilters {
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function getInventoryCatalog(filters: InventoryCatalogFilters = {}) {
  const user = await requireRole(UserRole.MANAGER, UserRole.WORKER);

  const search = filters.search?.trim().slice(0, 100);
  const category = filters.category?.trim() || undefined;
  const statusFilter = Object.values(InventoryStatus).includes(filters.status as InventoryStatus)
    ? (filters.status as InventoryStatus)
    : undefined;

  const pageSize = Math.min(Math.max(1, filters.pageSize ?? 20), 100);
  const requestedPage = Math.max(1, filters.page ?? 1);

  const searchWhere = search
    ? {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { assetTag: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { model: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { serialNumber: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { category: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { location: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  const where: Prisma.InventoryItemWhereInput = {
    ...searchWhere,
    ...(category && category !== "ALL" ? { category } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [total, items, stats] = await Promise.all([
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
      include: {
        loans: {
          where: { status: LoanStatus.ACTIVE },
          take: 1,
          include: {
            borrower: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    }),
    prisma.inventoryItem.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const statsMap = {
    total: 0,
    available: 0,
    inUse: 0,
    maintenance: 0,
    retired: 0,
  };

  for (const s of stats) {
    statsMap.total += s._count.id;
    if (s.status === InventoryStatus.AVAILABLE) statsMap.available = s._count.id;
    if (s.status === InventoryStatus.IN_USE) statsMap.inUse = s._count.id;
    if (s.status === InventoryStatus.MAINTENANCE) statsMap.maintenance = s._count.id;
    if (s.status === InventoryStatus.RETIRED) statsMap.retired = s._count.id;
  }

  // Format active loans with computed overdue flag
  const now = new Date();
  const formattedItems = items.map((item) => {
    const activeLoan = item.loans[0] || null;
    const isOverdue =
      activeLoan &&
      activeLoan.expectedReturnAt &&
      new Date(activeLoan.expectedReturnAt) < now;

    return {
      ...item,
      activeLoan: activeLoan
        ? {
            ...activeLoan,
            isOverdue: Boolean(isOverdue),
          }
        : null,
    };
  });

  return {
    items: formattedItems,
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
    },
    stats: statsMap,
    currentUser: {
      id: user.id,
      role: user.role,
      name: user.name,
    },
  };
}

export async function getInventoryItem(id: string) {
  await requireRole(UserRole.MANAGER, UserRole.WORKER);

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      loans: {
        orderBy: { checkedOutAt: "desc" },
        take: 15,
        include: {
          borrower: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      maintenanceLogs: {
        orderBy: { startedAt: "desc" },
        take: 10,
        include: {
          reportedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          resolvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!item) return null;

  const activeLoan = item.loans.find((l) => l.status === LoanStatus.ACTIVE) || null;
  const isOverdue =
    activeLoan &&
    activeLoan.expectedReturnAt &&
    new Date(activeLoan.expectedReturnAt) < new Date();

  return {
    ...item,
    activeLoan: activeLoan
      ? {
          ...activeLoan,
          isOverdue: Boolean(isOverdue),
        }
      : null,
  };
}

export async function getUserActiveLoans(userId: string) {
  await requireRole(UserRole.MANAGER, UserRole.WORKER);

  const now = new Date();
  const loans = await prisma.inventoryLoan.findMany({
    where: {
      borrowerId: userId,
      status: LoanStatus.ACTIVE,
    },
    orderBy: { checkedOutAt: "desc" },
    include: {
      item: true,
    },
  });

  return loans.map((loan) => ({
    ...loan,
    isOverdue: Boolean(
      loan.expectedReturnAt && new Date(loan.expectedReturnAt) < now
    ),
  }));
}

export async function getMaintenanceQueue(status?: MaintenanceStatus) {
  await requireRole(UserRole.MANAGER);

  const where: Prisma.InventoryMaintenanceLogWhereInput = status
    ? { status }
    : { status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS] } };

  return prisma.inventoryMaintenanceLog.findMany({
    where,
    orderBy: { startedAt: "desc" },
    include: {
      item: true,
      reportedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      resolvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}
