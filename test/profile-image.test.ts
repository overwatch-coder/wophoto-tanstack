import { describe, expect, it } from "vitest";
import { getProfileImageSrc } from "@/lib/profile-image";

describe("getProfileImageSrc", () => {
  it("serves private Vercel Blob avatars through the authenticated proxy", () => {
    expect(
      getProfileImageSrc(
        "https://store.private.blob.vercel-storage.com/profile/user-1/avatar.png",
        "user-1",
      ),
    ).toBe("/api/profile/avatar/user-1");
  });

  it("serves Google profile avatars through the same-origin proxy", () => {
    expect(
      getProfileImageSrc("https://lh3.googleusercontent.com/a/avatar", "user 1"),
    ).toBe("/api/profile/avatar/user%201");
  });

  it("leaves local preview URLs and unrelated URLs unchanged", () => {
    expect(getProfileImageSrc("blob:http://localhost/preview", "user-1")).toBe(
      "blob:http://localhost/preview",
    );
    expect(getProfileImageSrc("https://images.example.test/avatar.png", "user-1")).toBe(
      "https://images.example.test/avatar.png",
    );
    expect(getProfileImageSrc(null, "user-1")).toBeNull();
  });
});
