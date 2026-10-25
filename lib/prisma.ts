import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to use the database.");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const cachedPrisma = globalForPrisma.prisma;
type RuntimeModelShape = { fields?: Array<{ name: string }> };
type PrismaRuntimeShape = {
  _runtimeDataModel?: { models?: Record<string, RuntimeModelShape> };
};
const cachedPreferenceFields = (
  cachedPrisma as unknown as PrismaRuntimeShape | undefined
)?._runtimeDataModel?.models?.UserPreference?.fields?.map(({ name }) => name);
const hasCurrentSchemaDelegates = Boolean(
  cachedPrisma &&
    typeof (cachedPrisma as unknown as { notification?: { count?: unknown } })
      .notification?.count === "function" &&
    typeof (cachedPrisma as unknown as { userPreference?: { findUnique?: unknown } })
      .userPreference?.findUnique === "function" &&
    cachedPreferenceFields?.includes("aiProvider") &&
    cachedPreferenceFields.includes("aiCopilotName") &&
    cachedPreferenceFields.includes("aiModel") &&
    cachedPreferenceFields.includes("aiApiKeyEncrypted") &&
    cachedPreferenceFields.includes("aiApiKeyProvider") &&
    cachedPreferenceFields.includes("aiCustomEndpoint") &&
    cachedPreferenceFields.includes("aiAutonomousExecution") &&
    typeof (cachedPrisma as unknown as { inventoryItem?: { count?: unknown } })
      .inventoryItem?.count === "function" &&
    typeof (cachedPrisma as unknown as { inventoryLoan?: { findMany?: unknown } })
      .inventoryLoan?.findMany === "function" &&
    typeof (cachedPrisma as unknown as { inventoryMaintenanceLog?: { findMany?: unknown } })
      .inventoryMaintenanceLog?.findMany === "function",
);

// `prisma generate` can add models while `next dev` is already running. The
// global singleton survives hot reloads, so check all models added by the
// current schema change before reusing it.
if (cachedPrisma && !hasCurrentSchemaDelegates) {
  void cachedPrisma.$disconnect().catch((error) => {
    console.warn("[prisma] Could not disconnect a stale development client:", error);
  });
}

export const prisma = hasCurrentSchemaDelegates ? cachedPrisma! : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
