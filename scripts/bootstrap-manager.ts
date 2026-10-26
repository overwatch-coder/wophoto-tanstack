import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../generated/prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
const connectionString = process.env.DATABASE_URL;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run bootstrap:manager -- manager@example.com");
  process.exit(2);
}

if (!connectionString) {
  console.error("DATABASE_URL must be set before creating the first manager.");
  process.exit(2);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  await prisma.$transaction(
    async (transaction) => {
      const existingManager = await transaction.user.findFirst({
        where: { role: UserRole.MANAGER },
        select: { email: true },
      });

      if (existingManager) {
        throw new Error(`A manager already exists (${existingManager.email}). Bootstrap is disabled.`);
      }

      const existingUser = await transaction.user.findUnique({ where: { email } });

      if (existingUser) {
        throw new Error("That email already belongs to a WoPhoto user. Choose an unused email address.");
      }

      const manager = await transaction.user.create({
        data: { email, role: UserRole.MANAGER },
        select: { id: true, name: true },
      });

      await transaction.studio.create({
        data: {
          name: `${manager.name?.trim() || "WoPhoto"} Studio`,
          ownerUserId: manager.id,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  console.log(`Created the initial manager account record for ${email}. Sign in with that verified Google account.`);
} finally {
  await prisma.$disconnect();
}
