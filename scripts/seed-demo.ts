import fs from "node:fs";

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  if (fs.existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  } else if (fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }
}

const [{ seedDemoStudio }, { prisma }] = await Promise.all([
  import("../lib/demo-seed"),
  import("../lib/prisma"),
]);

const reset = process.argv.includes("--reset");

try {
  await seedDemoStudio({ reset });
  console.log(
    reset
      ? "Demo Studio (Studio Lumière) was reset and re-seeded successfully."
      : "Demo Studio (Studio Lumière) is seeded and ready.",
  );
} finally {
  await prisma.$disconnect();
}
