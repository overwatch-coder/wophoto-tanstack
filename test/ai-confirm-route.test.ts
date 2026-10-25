import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findClient: vi.fn(),
  createProject: vi.fn(),
  findProject: vi.fn(),
  findWorkers: vi.fn(),
  createTask: vi.fn(),
  revalidatePath: vi.fn(),
  createInvitationForManager: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/invitations", () => ({ createInvitationForManager: mocks.createInvitationForManager }));
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

  it("blocks client accounts from applying manager proposals", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "client-1", role: "CLIENT" } });
    const response = await POST(request({ proposalType: "CREATE_PROJECT", payload: {} }));
    expect(response.status).toBe(403);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("applies a valid project proposal for the authenticated manager", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "manager-1", role: "MANAGER" } });
    mocks.findClient.mockResolvedValue({ id: "client-1" });
    mocks.createProject.mockResolvedValue({ id: "project-1", name: "Autumn Campaign" });
    const payload = {
      name: "Autumn Campaign",
      description: "Editorial photography production for the autumn collection.",
      clientEmail: "client@example.com",
    };
    const response = await POST(request({ proposalType: "CREATE_PROJECT", payload }));

    expect(response.status).toBe(200);
    expect(mocks.findClient).toHaveBeenCalledWith({
      where: {
        email: { equals: "client@example.com", mode: "insensitive" },
        role: "CLIENT",
        status: "ACTIVE",
        acceptedInvitation: { is: { invitedById: "manager-1", status: "USED" } },
      },
      select: { id: true },
    });
    expect(mocks.createProject).toHaveBeenCalledWith({
      data: {
        name: "Autumn Campaign",
        description: "Editorial photography production for the autumn collection.",
        managerId: "manager-1",
        clientId: "client-1",
      },
      select: { id: true, name: true },
    });
    expect(await response.json()).toMatchObject({ success: true, projectId: "project-1" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/manager/projects");
  });

  it("creates an invitation only after a manager confirms the client proposal", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "manager-1", role: "MANAGER" } });
    mocks.createInvitationForManager.mockResolvedValue({
      success: true,
      email: "client@example.com",
      role: "CLIENT",
      invitationId: "invite-1",
      invitePath: "/invite/one-time-token",
      message: "Invitation link created for client@example.com as a client.",
    });

    const response = await POST(request({
      proposalType: "CREATE_INVITATION",
      payload: { email: "client@example.com", role: "CLIENT" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.createInvitationForManager).toHaveBeenCalledWith("manager-1", {
      email: "client@example.com",
      role: "CLIENT",
    });
    expect(await response.json()).toMatchObject({
      success: true,
      invitationId: "invite-1",
      invitePath: "/invite/one-time-token",
    });
  });

  it("rejects invitation proposals for a non-client role", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "manager-1", role: "MANAGER" } });
    const response = await POST(request({
      proposalType: "CREATE_INVITATION",
      payload: { email: "client@example.com", role: "WORKER" },
    }));

    expect(response.status).toBe(400);
    expect(mocks.createInvitationForManager).not.toHaveBeenCalled();
  });
});
