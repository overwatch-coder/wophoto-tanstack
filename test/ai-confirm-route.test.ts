import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findClient: vi.fn(),
  createProject: vi.fn(),
  findProject: vi.fn(),
  findWorkers: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.findClient, findMany: mocks.findWorkers },
    project: { create: mocks.createProject, findFirst: mocks.findProject },
    task: { create: mocks.createTask },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  },
}));

import { POST } from "@/app/api/chat/confirm/route";

function request(body: unknown) {
  return new Request("http://localhost/api/chat/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Copilot proposal confirmation route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(request({ proposalType: "CREATE_PROJECT", payload: {} }));
    expect(response.status).toBe(401);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("blocks non-manager accounts from applying proposals", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "worker-1", role: "WORKER" } });
    const response = await POST(request({ proposalType: "CREATE_PROJECT", payload: {} }));
    expect(response.status).toBe(403);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("applies a valid project proposal for the authenticated manager", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "manager-1", role: "MANAGER" } });
    mocks.findClient.mockResolvedValue({ id: "client-1" });
    mocks.createProject.mockResolvedValue({ id: "project-1", name: "Autumn Campaign" });
    const payload = { name: "Autumn Campaign", clientEmail: "client@example.com" };
    const response = await POST(request({ proposalType: "CREATE_PROJECT", payload }));

    expect(response.status).toBe(200);
    expect(mocks.createProject).toHaveBeenCalledWith({
      data: { name: "Autumn Campaign", managerId: "manager-1", clientId: "client-1" },
      select: { id: true, name: true },
    });
    expect(await response.json()).toMatchObject({ success: true, projectId: "project-1" });
  });
});
