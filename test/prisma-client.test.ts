import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staleDisconnect: vi.fn(),
  clientCreated: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class PrismaPg {},
}));
vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: class PrismaClient {
    notification = { count: vi.fn() };
    userPreference = { findUnique: vi.fn() };
    $disconnect = vi.fn();

    constructor() {
      mocks.clientCreated();
    }
  },
}));

describe("Prisma development singleton refresh", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "prisma");
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("replaces and disconnects a cached client missing the generated notification delegate", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5433/test");
    mocks.staleDisconnect.mockResolvedValue(undefined);
    const staleClient = { $disconnect: () => mocks.staleDisconnect() };
    Reflect.set(globalThis, "prisma", staleClient);

    const { prisma } = await import("@/lib/prisma");

    expect(prisma).not.toBe(staleClient);
    expect(typeof prisma.notification.count).toBe("function");
    expect(mocks.staleDisconnect).toHaveBeenCalledOnce();
    expect(mocks.clientCreated).toHaveBeenCalledOnce();
  });

  it("replaces a cached client that has notifications but not user preferences", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5433/test");
    mocks.staleDisconnect.mockResolvedValue(undefined);
    const staleClient = {
      notification: { count: vi.fn() },
      $disconnect: () => mocks.staleDisconnect(),
    };
    Reflect.set(globalThis, "prisma", staleClient);

    const { prisma } = await import("@/lib/prisma");

    expect(prisma).not.toBe(staleClient);
    expect(typeof prisma.userPreference.findUnique).toBe("function");
    expect(mocks.staleDisconnect).toHaveBeenCalledOnce();
    expect(mocks.clientCreated).toHaveBeenCalledOnce();
  });
});
