import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  deleteCookie: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("@tanstack/react-start/server", () => ({ deleteCookie: mocks.deleteCookie }))
vi.mock("@/auth", () => ({ signIn: mocks.signIn, signOut: mocks.signOut }))

import { signInWithGoogle, signOutUser } from "@/src/server/actions/auth"

describe("authentication server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cookies.mockResolvedValue({ delete: mocks.deleteCookie })
    mocks.signIn.mockResolvedValue(undefined)
    mocks.signOut.mockResolvedValue(undefined)
  })

  it("continues to send Google sign-in to the role landing resolver (AC-14)", async () => {
    await signInWithGoogle()

    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false })
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(mocks.signIn.mock.invocationCallOrder[0])
    expect(mocks.signIn).toHaveBeenCalledWith("google", { redirectTo: "/" })
  })

  it("does not begin OAuth if the previous session cannot be cleared", async () => {
    mocks.signOut.mockRejectedValue(new Error("Unable to clear session"))
    await expect(signInWithGoogle()).rejects.toThrow("Unable to clear session")
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  it("clears the sidebar preference and redirects through Auth.js on sign out (AC-5, AC-13)", async () => {
    await signOutUser()

    expect(mocks.deleteCookie).toHaveBeenCalledWith("sidebar_state")
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: "/login" })
  })

  it("surfaces Auth.js sign-out failures (AC-5, AC-13)", async () => {
    mocks.signOut.mockRejectedValue(new Error("Auth.js sign out failed"))

    await expect(signOutUser()).rejects.toThrow("Auth.js sign out failed")
  })
})
