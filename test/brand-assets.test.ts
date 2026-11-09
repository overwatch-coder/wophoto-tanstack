import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  blobDel: vi.fn(),
  blobPut: vi.fn(),
  brandAssetFindUnique: vi.fn(),
  brandAssetFindMany: vi.fn(),
  brandAssetCount: vi.fn(),
  brandAssetGroupBy: vi.fn(),
  brandAssetCreate: vi.fn(),
  brandAssetUpdate: vi.fn(),
  brandAssetDelete: vi.fn(),
  projectFindUnique: vi.fn(),
  projectFindMany: vi.fn(),
  userFindFirst: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authz", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/studio-access", () => {
  const actor = async () => mocks.requireRole("MANAGER");
  const context = (user: { id: string; role: string }) => ({
    studioId: `studio-${user.id}`, ownerUserId: user.id, isOwner: user.role === "MANAGER",
    memberId: null, role: user.role, grants: {},
  });
  return {
    requireStudioArea: async () => { const user = await actor(); return { user, context: context(user) }; },
    requireStudioManagerArea: async () => { const user = await actor(); return { manager: { ...user, actorId: user.id }, actor: user, context: context(user) }; },
    requireStudioOwner: async () => { const user = await actor(); return { user, context: context(user) }; },
    getStudioAccessContext: async (userId: string, role: string) => ({ studioId: `studio-${userId}`, ownerUserId: role === "MANAGER" ? userId : "manager-1", isOwner: role === "MANAGER", memberId: role === "MANAGER" ? null : "member-1", role, grants: {} }),
    hasStudioAccess: () => true,
  };
});

vi.mock("@vercel/blob", () => ({
  put: mocks.blobPut,
  del: mocks.blobDel,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brandAsset: {
      findUnique: mocks.brandAssetFindUnique,
      findFirst: mocks.brandAssetFindUnique,
      findMany: mocks.brandAssetFindMany,
      count: mocks.brandAssetCount,
      groupBy: mocks.brandAssetGroupBy,
      create: mocks.brandAssetCreate,
      update: mocks.brandAssetUpdate,
      delete: mocks.brandAssetDelete,
    },
    project: {
      findUnique: mocks.projectFindUnique,
      findMany: mocks.projectFindMany,
    },
    user: {
      findFirst: mocks.userFindFirst,
      findMany: mocks.userFindMany,
    },
  },
}));

import {
  createBrandAsset,
  updateBrandAsset,
  deleteBrandAsset,
} from "@/src/server/actions/brand-assets";
import {
  getBrandAssets,
  getBrandAssetById,
} from "@/lib/brand-assets";
import {
  createBrandAssetSchema,
  colorSwatchSchema,
} from "@/lib/validation/brand-assets";
import { BrandAssetType, UserRole } from "@/generated/prisma/client";

describe("Slice 11: Brand Asset Library", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.blobDel.mockResolvedValue(undefined);
    mocks.blobPut.mockResolvedValue({
      url: "https://blob.vercel-storage.com/uploaded.png",
      pathname: "brand-assets/uploaded.png",
    });
    mocks.requireRole.mockResolvedValue({
      id: "manager-1",
      role: UserRole.MANAGER,
    });
  });

  describe("Validation Schemas", () => {
    it("validates hex color format and transforms to uppercase", () => {
      const validSwatch = {
        name: "Electric Blue",
        hex: "#2563eb",
      };

      const result = colorSwatchSchema.safeParse(validSwatch);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hex).toBe("#2563EB");
      }

      const invalidSwatch = {
        name: "Bad Color",
        hex: "not-a-hex",
      };
      expect(colorSwatchSchema.safeParse(invalidSwatch).success).toBe(false);
    });

    it("requires at least one asset source (fileUrl, externalUrl, or colorPalette)", () => {
      const emptySource = {
        title: "Acme Logo",
        assetType: BrandAssetType.LOGO,
      };
      const result = createBrandAssetSchema.safeParse(emptySource);
      expect(result.success).toBe(false);

      const withFile = {
        title: "Acme Logo",
        assetType: BrandAssetType.LOGO,
        fileUrl: "https://blob.vercel-storage.com/logo.svg",
      };
      expect(createBrandAssetSchema.safeParse(withFile).success).toBe(true);

      const withExternalUrl = {
        title: "Acme Figma Kit",
        assetType: BrandAssetType.TEMPLATE,
        externalUrl: "https://figma.com/file/123",
      };
      expect(createBrandAssetSchema.safeParse(withExternalUrl).success).toBe(true);
      expect(createBrandAssetSchema.safeParse({
        title: "Broken URL",
        externalUrl: "https://[",
      }).success).toBe(false);

      const withPalette = {
        title: "Acme Palette",
        assetType: BrandAssetType.COLOR_PALETTE,
        colorPalette: [{ name: "Primary", hex: "#000000" }],
      };
      expect(createBrandAssetSchema.safeParse(withPalette).success).toBe(true);
    });

    it("normalizes tags to lowercase", () => {
      const data = {
        title: "Icon Set",
        fileUrl: "https://example.com/icons.svg",
        tags: ["Vector", "DARK-MODE", "  iOS  "],
      };

      const result = createBrandAssetSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(["vector", "dark-mode", "ios"]);
      }
    });
  });

  describe("createBrandAsset Action", () => {
    it("creates a brand asset successfully for a manager", async () => {
      mocks.brandAssetCreate.mockResolvedValue({ id: "asset-1" });

      const result = await createBrandAsset({
        title: "Master Vector Logo",
        assetType: BrandAssetType.LOGO,
        fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/master-logo.svg",
        fileKey: "brand-assets/master-logo.svg",
        tags: ["vector", "master"],
      });

      expect(result.success).toBe("Brand asset created successfully.");
      expect(result.assetId).toBe("asset-1");
      expect(mocks.brandAssetCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Master Vector Logo",
            assetType: BrandAssetType.LOGO,
            fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/master-logo.svg",
            createdById: "manager-1",
          }),
        })
      );
    });

    it("enforces client-inheritance protection when projectId is specified", async () => {
      mocks.projectFindUnique.mockResolvedValue({
        id: "proj-100",
        clientId: "client-corp",
      });
      mocks.brandAssetCreate.mockResolvedValue({ id: "asset-project" });

      const result = await createBrandAsset({
        title: "Spring Campaign Lookbook",
        assetType: BrandAssetType.GUIDELINE,
        fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/lookbook.pdf",
        fileKey: "brand-assets/lookbook.pdf",
        projectId: "proj-100",
      });

      expect(result.success).toBe("Brand asset created successfully.");
      expect(mocks.projectFindUnique).toHaveBeenCalledWith({
        where: { id: "proj-100" },
        select: { id: true, clientId: true },
      });
      // Invariant: clientId must inherit project.clientId ("client-corp")
      expect(mocks.brandAssetCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: "proj-100",
            clientId: "client-corp",
          }),
        })
      );
    });

    it("returns error if specified project is not found", async () => {
      mocks.projectFindUnique.mockResolvedValue(null);

      const result = await createBrandAsset({
        title: "Missing Project Asset",
        assetType: BrandAssetType.GUIDELINE,
        fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/lookbook.pdf",
        fileKey: "brand-assets/lookbook.pdf",
        projectId: "proj-nonexistent",
      });

      expect(result.error).toBe("The associated project was not found.");
      expect(mocks.brandAssetCreate).not.toHaveBeenCalled();
    });

    it("rejects blob URLs outside the private brand asset namespace", async () => {
      const result = await createBrandAsset({
        title: "Foreign file",
        fileUrl: "https://store.private.blob.vercel-storage.com/profile/avatar.png",
        fileKey: "profile/avatar.png",
      });
      expect(result.error).toMatch(/authorized brand asset upload flow/i);
      expect(mocks.brandAssetCreate).not.toHaveBeenCalled();
    });

    it("refuses to attach a blob already referenced by another asset", async () => {
      mocks.brandAssetCount.mockResolvedValue(1);
      const result = await createBrandAsset({
        title: "Shared file",
        fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/shared.svg",
        fileKey: "brand-assets/shared.svg",
      });
      expect(result.error).toMatch(/already attached/i);
      expect(mocks.brandAssetCreate).not.toHaveBeenCalled();
    });
  });

  describe("updateBrandAsset Action", () => {
    it("updates existing asset and deletes previous blob if replaced", async () => {
      mocks.brandAssetFindUnique.mockResolvedValue({
        id: "asset-1",
        fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/old-logo.svg",
        fileKey: "brand-assets/old-logo.svg",
        projectId: null,
        clientId: null,
        externalUrl: null,
        colorPalette: null,
        fileName: "old-logo.svg",
        fileSize: null,
        fileMime: "image/svg+xml",
      });
      mocks.brandAssetUpdate.mockResolvedValue({ id: "asset-1" });

      const result = await updateBrandAsset({
        id: "asset-1",
        title: "Updated Brand Logo",
        fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/new-logo.svg",
        fileKey: "brand-assets/new-logo.svg",
      });

      expect(result.success).toBe("Brand asset updated successfully.");
      expect(mocks.blobDel).toHaveBeenCalledWith(
        "https://store.private.blob.vercel-storage.com/brand-assets/old-logo.svg"
      );
      expect(mocks.brandAssetUpdate.mock.invocationCallOrder[0]).toBeLessThan(mocks.blobDel.mock.invocationCallOrder[0]);
      expect(mocks.brandAssetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "asset-1", studioId: "studio-manager-1" },
          data: expect.objectContaining({
            title: "Updated Brand Logo",
            fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/new-logo.svg",
          }),
        })
      );
    });

    it("preserves client-inheritance on project update", async () => {
      mocks.brandAssetFindUnique.mockResolvedValue({
        id: "asset-2",
        fileUrl: null,
        fileKey: null,
        projectId: null,
        clientId: null,
        externalUrl: "https://figma.com/old",
        colorPalette: null,
        fileName: null,
        fileSize: null,
        fileMime: null,
      });
      mocks.projectFindUnique.mockResolvedValue({
        id: "proj-200",
        clientId: "client-enterprise",
      });
      mocks.brandAssetUpdate.mockResolvedValue({ id: "asset-2" });

      const result = await updateBrandAsset({
        id: "asset-2",
        projectId: "proj-200",
      });

      expect(result.success).toBe("Brand asset updated successfully.");
      expect(mocks.brandAssetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "asset-2", studioId: "studio-manager-1" },
          data: expect.objectContaining({
            projectId: "proj-200",
            clientId: "client-enterprise",
          }),
        })
      );
    });

    it("keeps the old blob if the database update fails", async () => {
      mocks.brandAssetFindUnique.mockResolvedValue({
        id: "asset-3",
        fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/old.svg",
        fileKey: "brand-assets/old.svg",
        fileName: "old.svg",
        fileSize: 1,
        fileMime: "image/svg+xml",
        externalUrl: null,
        colorPalette: null,
        projectId: null,
        clientId: null,
      });
      mocks.brandAssetUpdate.mockRejectedValue(new Error("database unavailable"));

      const result = await updateBrandAsset({
        id: "asset-3",
        fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/new.svg",
        fileKey: "brand-assets/new.svg",
      });
      expect(result.error).toBe("database unavailable");
      expect(mocks.blobDel).not.toHaveBeenCalled();
    });
  });

  describe("deleteBrandAsset Action", () => {
    it("deletes asset and removes blob storage asset", async () => {
      mocks.brandAssetFindUnique.mockResolvedValue({
        id: "asset-del",
        fileUrl: "https://store.private.blob.vercel-storage.com/brand-assets/asset-del.png",
        fileKey: "brand-assets/asset-del.png",
      });
      mocks.brandAssetDelete.mockResolvedValue({ id: "asset-del" });

      const result = await deleteBrandAsset({ id: "asset-del" });

      expect(result.success).toBe("Brand asset deleted successfully.");
      expect(mocks.blobDel).toHaveBeenCalledWith(
        "https://store.private.blob.vercel-storage.com/brand-assets/asset-del.png"
      );
      expect(mocks.brandAssetDelete).toHaveBeenCalledWith({
        where: { id: "asset-del", studioId: "studio-manager-1" },
      });
    });
  });

  describe("getBrandAssets Queries", () => {
    it("allows workers read access and queries with search & tags", async () => {
      mocks.requireRole.mockResolvedValue({
        id: "worker-1",
        role: UserRole.WORKER,
      });

      mocks.brandAssetFindMany.mockResolvedValue([
        {
          id: "asset-1",
          title: "Primary Logo",
          assetType: BrandAssetType.LOGO,
          colorPalette: null,
          tags: ["vector", "svg"],
          client: null,
          project: null,
          createdBy: { id: "mgr-1", name: "Manager" },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mocks.brandAssetCount.mockResolvedValue(1);
      mocks.brandAssetGroupBy.mockResolvedValue([
        { assetType: BrandAssetType.LOGO, _count: { _all: 1 } },
      ]);

      const result = await getBrandAssets({
        search: "Vector",
        assetType: BrandAssetType.LOGO,
        scope: "STUDIO",
      });

      expect(mocks.requireRole).toHaveBeenCalledWith(
        UserRole.MANAGER,
        UserRole.SUPERVISOR,
        UserRole.COLLABORATOR,
        UserRole.WORKER
      );
      expect(result.assets).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.stats.logos).toBe(1);
      expect(mocks.brandAssetFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              { clientId: null, projectId: null },
              { OR: [
                { title: { contains: "Vector", mode: "insensitive" } },
                { description: { contains: "Vector", mode: "insensitive" } },
                { tags: { has: "vector" } },
              ] },
            ],
            assetType: BrandAssetType.LOGO,
          }),
        })
      );
    });

    it("filters properly for client kits scope", async () => {
      mocks.brandAssetFindMany.mockResolvedValue([]);
      mocks.brandAssetCount.mockResolvedValue(0);
      mocks.brandAssetGroupBy.mockResolvedValue([]);

      await getBrandAssets({ scope: "CLIENT" });

      expect(mocks.brandAssetFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [{ studioId: "studio-manager-1" }, { clientId: { not: null } }],
          }),
        })
      );
    });

    it("filters properly for project scope", async () => {
      mocks.brandAssetFindMany.mockResolvedValue([]);
      mocks.brandAssetCount.mockResolvedValue(0);
      mocks.brandAssetGroupBy.mockResolvedValue([]);

      await getBrandAssets({ scope: "PROJECT" });

      expect(mocks.brandAssetFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [{ studioId: "studio-manager-1" }, { projectId: { not: null } }],
          }),
        })
      );
    });

    it("uses the same intersecting scope and ID filters for rows and counts", async () => {
      mocks.brandAssetFindMany.mockResolvedValue([]);
      mocks.brandAssetCount.mockResolvedValue(0);
      mocks.brandAssetGroupBy.mockResolvedValue([]);

      await getBrandAssets({ scope: "CLIENT", clientId: "client-a", projectId: "project-a" });

      expect(mocks.brandAssetFindMany.mock.calls[0][0].where.AND).toEqual([
        { studioId: "studio-manager-1" },
        { projectId: "project-a" },
        { clientId: "client-a" },
        { clientId: { not: null } },
      ]);
      expect(mocks.brandAssetGroupBy.mock.calls[0][0].where).toEqual({
        AND: [
          { studioId: "studio-manager-1" },
          { projectId: "project-a" },
          { clientId: "client-a" },
          { clientId: { not: null } },
        ],
      });
    });
  });

  describe("getBrandAssetById", () => {
    it("returns single asset with relations", async () => {
      mocks.brandAssetFindUnique.mockResolvedValue({
        id: "asset-10",
        title: "Editorial Guidelines",
        client: { id: "c-1", name: "Client A" },
        project: null,
      });

      const asset = await getBrandAssetById("asset-10");
      expect(asset?.title).toBe("Editorial Guidelines");
      expect(mocks.brandAssetFindUnique).toHaveBeenCalledWith({
        where: { id: "asset-10", studioId: "studio-manager-1" },
        include: expect.objectContaining({
          client: expect.anything(),
          project: expect.anything(),
          createdBy: expect.anything(),
        }),
      });
    });

    it("clamps an out of range page and only queries that page of assets", async () => {
      mocks.brandAssetFindMany.mockResolvedValue([]);
      mocks.brandAssetCount.mockResolvedValue(25);
      mocks.brandAssetGroupBy.mockResolvedValue([]);

      const result = await getBrandAssets({ page: 9, pageSize: 24 });

      expect(result.pagination).toEqual({
        total: 25,
        page: 2,
        pageSize: 24,
        totalPages: 2,
      });
      expect(mocks.brandAssetFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 24, take: 24 }),
      );
    });
  });
});
