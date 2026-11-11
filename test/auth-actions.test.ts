import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  deleteCookie: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("@tanstack/react-start/server", () => ({ deleteCookie: mocks.deleteCookie }))
vi.mock("@/auth", () => ({ signOut: mocks.signOut }))

import { signOutUser } from "@/src/server/actions/auth"

describe("authentication server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signOut.mockResolvedValue(undefined)
  })

  it("clears the sidebar preference and returns a client navigation target on sign out (AC-5, AC-13)", async () => {
    await expect(signOutUser()).resolves.toEqual({ success: true })

    expect(mocks.deleteCookie).toHaveBeenCalledWith("sidebar_state")
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: "/login", redirect: false })
  })

  it("surfaces Auth.js sign-out failures (AC-5, AC-13)", async () => {
    mocks.signOut.mockRejectedValue(new Error("Auth.js sign out failed"))

    await expect(signOutUser()).rejects.toThrow("Auth.js sign out failed")
  })
})
