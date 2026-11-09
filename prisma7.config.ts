import path from "node:path";
import { defineConfig, env } from "prisma/config";

for (const envName of [".env.production", ".env", ".env.local"]) {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(path.resolve(process.cwd(), envName));
    }
  } catch {
    // env file might not exist
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || (process.env.NODE_ENV === "production" ? env("DATABASE_URL") : "postgresql://localhost:5432/wophoto"),
  },
});
