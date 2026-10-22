import { describe, expect, it } from "vitest"

import { shouldDismissMobileSidebar } from "@/lib/sidebar"

describe("mobile sidebar Escape behavior", () => {
  it("closes the drawer for Escape outside a nested menu", () => {
    expect(shouldDismissMobileSidebar("Escape", false)).toBe(true)
  })

  it("lets an open nested menu handle Escape first", () => {
    expect(shouldDismissMobileSidebar("Escape", true)).toBe(false)
  })

  it("keeps the drawer open for other keys", () => {
    expect(shouldDismissMobileSidebar("Tab", false)).toBe(false)
  })
})
