export * from "../../generated/prisma/browser";

export class PrismaClient {
  constructor() {
    throw new Error("PrismaClient cannot be executed in the browser.");
  }
}

