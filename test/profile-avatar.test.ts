import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  projectFindFirst: vi.fn(),
  invitationFindFirst: vi.fn(),
  blobGet: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    project: { findFirst: mocks.projectFindFirst },
    invitation: { findFirst: mocks.invitationFindFirst },
  },
}));
vi.mock("@vercel/blob", () => ({ get: mocks.blobGet }));

import { GET } from "@/src/server/handlers/profile-avatar";

const userId = "cm123456789012345678901234";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: userId } });
  mocks.userFindUnique.mockResolvedValue({
    id: userId,
    image: "https://lh3.googleusercontent.com/a/avatar",
  });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("profile avatar handler", () => {
  it("proxies allowed Google profile images with safe image headers", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png", "content-length": "3" },
      }),
    );

    const response = await GET(new Request("http://localhost/api/profile/avatar"), {
      params: { userId },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(fetch).toHaveBeenCalledWith(
      "https://lh3.googleusercontent.com/a/avatar",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(mocks.blobGet).not.toHaveBeenCalled();
  });

  it("rejects unapproved external image hosts without fetching them", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: userId,
      image: "https://images.example.test/avatar.png",
    });

    const response = await GET(new Request("http://localhost/api/profile/avatar"), {
      params: { userId },
    });

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("continues to serve private Vercel Blob avatars", async () => {
    const image = `https://store.private.blob.vercel-storage.com/profile/${userId}/avatar.png`;
    mocks.userFindUnique.mockResolvedValue({ id: userId, image });
    mocks.blobGet.mockResolvedValue({
      statusCode: 200,
      blob: { contentType: "image/png", etag: '"avatar"' },
      stream: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.close(); } }),
    });

    const response = await GET(new Request("http://localhost/api/profile/avatar"), {
      params: { userId },
    });

    expect(response.status).toBe(200);
    expect(mocks.blobGet).toHaveBeenCalledWith(image, { access: "private" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
