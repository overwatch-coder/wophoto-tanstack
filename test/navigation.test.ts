import { describe, expect, it } from "vitest"

import {
  getWorkspaceHome,
  getWorkspacePageTitle,
  isWorkspaceRole,
  matchesWorkspacePath,
  workspaceNavigation,
} from "@/lib/navigation"

describe("role aware workspace navigation", () => {
  it("accepts only the three supported roles (AC-1, AC-12)", () => {
    expect(isWorkspaceRole("MANAGER")).toBe(true)
    expect(isWorkspaceRole("WORKER")).toBe(true)
    expect(isWorkspaceRole("CLIENT")).toBe(true)
    expect(isWorkspaceRole("ADMIN")).toBe(false)
    expect(isWorkspaceRole("")).toBe(false)
  })

  it("provides only the specified available routes to each role (AC-1, AC-2, AC-3)", () => {
    const availableRoutes = (role: keyof typeof workspaceNavigation) =>
      workspaceNavigation[role]
        .filter((item) => item.status === "available")
        .map(({ title, href }) => [title, href])

    expect(availableRoutes("MANAGER")).toEqual([
      ["Team Invitations", "/manager/invitations"],
    ])
    expect(availableRoutes("WORKER")).toEqual([["Workspace", "/worker"]])
    expect(availableRoutes("CLIENT")).toEqual([["Dashboard", "/client"]])
  })

  it("keeps every unbuilt destination disabled without a route (AC-6)", () => {
    for (const items of Object.values(workspaceNavigation)) {
      for (const item of items.filter(
        (entry) => entry.status === "coming-soon"
      )) {
        expect(item.href).toBeNull()
      }
    }
  })

  it("routes each supported role to its landing page (AC-2, AC-3)", () => {
    expect(getWorkspaceHome("MANAGER")).toBe("/manager/invitations")
    expect(getWorkspaceHome("WORKER")).toBe("/worker")
    expect(getWorkspaceHome("CLIENT")).toBe("/client")
  })

  it("matches a route and its nested paths without matching a longer sibling (AC-5, AC-13)", () => {
    expect(
      matchesWorkspacePath("/manager/invitations", "/manager/invitations")
    ).toBe(true)
    expect(
      matchesWorkspacePath("/manager/invitations/42", "/manager/invitations")
    ).toBe(true)
    expect(
      matchesWorkspacePath("/manager/invitations-extra", "/manager/invitations")
    ).toBe(false)
  })

  it("uses the shared navigation labels for available route titles (AC-5, AC-13)", () => {
    expect(getWorkspacePageTitle("MANAGER", "/manager/invitations")).toBe(
      "Team Invitations"
    )
    expect(getWorkspacePageTitle("WORKER", "/worker")).toBe("Workspace")
    expect(getWorkspacePageTitle("CLIENT", "/client")).toBe("Dashboard")
  })

  it("uses Workspace when a protected route has no available title mapping (AC-5)", () => {
    expect(getWorkspacePageTitle("MANAGER", "/manager/future-area")).toBe(
      "Workspace"
    )
  })
})
