import { describe, expect, it } from "vitest";
import { StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/client";
import { hasStudioAccess, SUPERVISOR_ACCESS, type StudioAccessContext } from "@/lib/studio-access";

vi.mock("@/lib/authz", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const context = (overrides: Partial<StudioAccessContext> = {}): StudioAccessContext => ({
  studioId: "studio",
  ownerUserId: "owner",
  isOwner: false,
  memberId: "member",
  role: UserRole.COLLABORATOR,
  grants: {},
  ...overrides,
});

describe("studio area authorization", () => {
  it("treats Manage as both read and mutation access", () => {
    const member = context({ grants: { [StudioArea.PROJECTS]: StudioAccessLevel.MANAGE } });
    expect(hasStudioAccess(member, StudioArea.PROJECTS, StudioAccessLevel.VIEW)).toBe(true);
    expect(hasStudioAccess(member, StudioArea.PROJECTS, StudioAccessLevel.MANAGE)).toBe(true);
  });

  it("allows View reads and denies mutations", () => {
    const member = context({ grants: { [StudioArea.BRIEFS]: StudioAccessLevel.VIEW } });
    expect(hasStudioAccess(member, StudioArea.BRIEFS, StudioAccessLevel.VIEW)).toBe(true);
    expect(hasStudioAccess(member, StudioArea.BRIEFS, StudioAccessLevel.MANAGE)).toBe(false);
  });

  it("denies missing scopes and keeps owner access unrestricted", () => {
    expect(hasStudioAccess(context(), StudioArea.INVENTORY)).toBe(false);
    expect(hasStudioAccess(context({ isOwner: true }), StudioArea.COPILOT, StudioAccessLevel.MANAGE)).toBe(true);
  });

  it("keeps the Supervisor preset fixed and excludes owner areas", () => {
    expect(SUPERVISOR_ACCESS[StudioArea.DASHBOARD]).toBe(StudioAccessLevel.VIEW);
    expect(SUPERVISOR_ACCESS[StudioArea.PROJECTS]).toBe(StudioAccessLevel.MANAGE);
    expect(SUPERVISOR_ACCESS[StudioArea.TEAM]).toBeUndefined();
    expect(SUPERVISOR_ACCESS[StudioArea.COPILOT]).toBeUndefined();
    expect(SUPERVISOR_ACCESS[StudioArea.DELETED_TASKS]).toBeUndefined();
  });
});
import { vi } from "vitest";
