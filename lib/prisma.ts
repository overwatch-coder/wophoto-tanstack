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
const hasCurrentSchemaDelegates = Boolean(
  cachedPrisma &&
    typeof (cachedPrisma as unknown as { notification?: { count?: unknown } })
      .notification?.count === "function" &&
    typeof (cachedPrisma as unknown as { userPreference?: { findUnique?: unknown } })
      .userPreference?.findUnique === "function",
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
