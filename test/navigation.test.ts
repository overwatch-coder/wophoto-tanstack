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

  it("lists each role's routes in a useful order (AC-1, AC-2, AC-3)", () => {
    expect(workspaceNavigation.MANAGER.map(({ title, href }) => [title, href])).toEqual([
      ["Dashboard", "/manager"],
      ["Projects", "/manager/projects"],
      ["Tasks", "/manager/tasks"],
      ["Schedule", "/manager/schedule"],
      ["Brief Review", "/manager/brief-review"],
      ["Explore Briefs", "/manager/explore-briefs"],
      ["Reviews", "/manager/reviews"],
      ["Work Requests", "/manager/work-requests"],
      ["Brand Assets", "/manager/brand-assets"],
      ["Inventory", "/manager/inventory"],
      ["Deleted Tasks", "/manager/deleted-tasks"],
      ["Notifications", "/manager/notifications"],
      ["Team Invitations", "/manager/invitations"],
      ["Settings", "/settings"],
    ])
    expect(workspaceNavigation.WORKER[0]).toMatchObject({ title: "Dashboard", href: "/worker" })
    expect(workspaceNavigation.CLIENT[0]).toMatchObject({ title: "Dashboard", href: "/client" })
    expect(workspaceNavigation.CLIENT.map(({ title, href }) => [title, href])).toContainEqual(["Work Requests", "/client/work-requests"])
  })

  it("gives each navigation destination a route (AC-6)", () => {
    for (const items of Object.values(workspaceNavigation)) {
      for (const item of items) expect(item.href).toMatch(/^\//)
    }
  })

  it("routes each supported role to its landing page (AC-2, AC-3)", () => {
    expect(getWorkspaceHome("MANAGER")).toBe("/manager")
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
    expect(getWorkspacePageTitle("WORKER", "/worker")).toBe("Dashboard")
    expect(getWorkspacePageTitle("CLIENT", "/client")).toBe("Dashboard")
  })

  it("uses Workspace when a protected route has no title mapping (AC-5)", () => {
    expect(getWorkspacePageTitle("MANAGER", "/manager/future-area")).toBe(
      "Workspace"
    )
  })
})
