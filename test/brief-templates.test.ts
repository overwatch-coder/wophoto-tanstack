import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  blobDel: vi.fn(),
  blobPut: vi.fn(),
  templateFindUnique: vi.fn(),
  templateFindMany: vi.fn(),
  templateCount: vi.fn(),
  templateCreate: vi.fn(),
  templateUpdate: vi.fn(),
  briefFindUnique: vi.fn(),
  briefFindMany: vi.fn(),
  briefCount: vi.fn(),
  briefCreate: vi.fn(),
  briefUpdateMany: vi.fn(),
  projectFindUnique: vi.fn(),
  projectFindFirst: vi.fn(),
  projectFindMany: vi.fn(),
  projectCreate: vi.fn(),
  userFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  transaction: vi.fn(),
  rawQuery: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authz", () => ({
  requireRole: mocks.requireRole,
  requireUser: mocks.requireUser,
  getCurrentUser: mocks.getCurrentUser,
}));
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
    briefTemplate: {
      findUnique: mocks.templateFindUnique,
      findFirst: mocks.templateFindUnique,
      findMany: mocks.templateFindMany,
      count: mocks.templateCount,
      create: mocks.templateCreate,
      update: mocks.templateUpdate,
    },
    creativeBrief: {
      findUnique: mocks.briefFindUnique,
      findMany: mocks.briefFindMany,
      count: mocks.briefCount,
      create: mocks.briefCreate,
      updateMany: mocks.briefUpdateMany,
    },
    project: {
      findUnique: mocks.projectFindUnique,
      findFirst: mocks.projectFindFirst,
      findMany: mocks.projectFindMany,
      create: mocks.projectCreate,
    },
    user: {
      findFirst: mocks.userFindFirst,
      findMany: mocks.userFindMany,
    },
    $transaction: mocks.transaction,
    $queryRaw: mocks.rawQuery,
  },
}));

import {
  createBriefTemplate,
  updateBriefTemplate,
  archiveBriefTemplate,
  unarchiveBriefTemplate,
  convertBriefToTemplate,
  instantiateBriefFromTemplate,
} from "@/app/actions/brief-templates";
import {
  getBriefTemplates,
  getStudioBriefArchive,
  getBriefTemplateDetail,
} from "@/lib/brief-templates";
import {
  BriefTemplateCategory,
  BriefStatus,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";

const MANAGER_USER = {
  id: "mgr_123",
  name: "Studio Lead",
  role: UserRole.MANAGER,
  status: UserStatus.ACTIVE,
};

const WORKER_USER = {
  id: "wrk_123",
  name: "Lead Photographer",
  role: UserRole.WORKER,
  status: UserStatus.ACTIVE,
};

const CLIENT_USER = {
  id: "clt_123",
  name: "Fashion Brand",
  role: UserRole.CLIENT,
  status: UserStatus.ACTIVE,
};

describe("Slice 14: Explore Briefs & Template Library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.blobDel.mockResolvedValue(undefined);
    mocks.blobPut.mockResolvedValue({ url: "https://blob.mock/file.pdf" });
    mocks.rawQuery.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        briefTemplate: {
          update: mocks.templateUpdate,
        },
        creativeBrief: {
          create: mocks.briefCreate,
          updateMany: mocks.briefUpdateMany,
        },
        project: {
          findFirst: mocks.projectFindFirst,
          create: mocks.projectCreate,
        },
        user: {
          findFirst: mocks.userFindFirst,
        },
      };
      return callback(txMock);
    });
  });

  describe("Brief Template Authoring (AC-1, AC-8)", () => {
    it("rejects non-managers attempting to create templates", async () => {
      mocks.requireRole.mockRejectedValue(new Error("Unauthorized: MANAGER required"));

      const res = await createBriefTemplate({
        title: "Commercial Lookbook",
        category: BriefTemplateCategory.LOOKBOOK,
        tags: ["apparel", "outdoor"],
      });

      expect(res.error).toBe("Unauthorized: MANAGER required");
      expect(mocks.templateCreate).not.toHaveBeenCalled();
    });

    it("successfully creates a reusable template with shot list and tags", async () => {
      mocks.requireRole.mockResolvedValue(MANAGER_USER);
      mocks.templateCreate.mockResolvedValue({ id: "tmpl_abc", title: "Commercial Lookbook" });

      const res = await createBriefTemplate({
        title: "Commercial Lookbook",
        category: BriefTemplateCategory.LOOKBOOK,
        summary: "Default setup for seasonal apparel lookbooks.",
        tags: ["apparel", "natural-light"],
        deliverables: "High-res JPEG exports at 300dpi sRGB.",
        guidelines: "Soft directional daylight with subtle bounce fill.",
        shotList: [
          {
            id: "shot_1",
            title: "Full length hero crop",
            framing: "WIDE",
            status: "PLANNED",
            order: 0,
            props: ["sun hat", "leather tote"],
          },
        ],
      });

      expect(res.templateId).toBe("tmpl_abc");
      expect(mocks.templateCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Commercial Lookbook",
            category: BriefTemplateCategory.LOOKBOOK,
            createdById: MANAGER_USER.id,
            tags: ["apparel", "natural-light"],
          }),
        })
      );
      expect(mocks.revalidatePath).toHaveBeenCalled();
    });

    it("updates existing template and handles soft archival", async () => {
      mocks.requireRole.mockResolvedValue(MANAGER_USER);
      mocks.templateCount.mockResolvedValue(0);
      mocks.templateFindUnique.mockResolvedValue({
        id: "tmpl_abc",
        title: "Commercial Lookbook",
        coverImageUrl: "https://storage.private.blob.vercel-storage.com/brief-templates/covers/old.jpg",
        attachmentUrl: null,
      });
      mocks.templateUpdate.mockResolvedValue({ id: "tmpl_abc" });

      const updateRes = await updateBriefTemplate({
        id: "tmpl_abc",
        title: "Updated Lookbook Template",
        category: BriefTemplateCategory.EDITORIAL,
        tags: ["editorial"],
        coverImageUrl: "https://storage.private.blob.vercel-storage.com/brief-templates/covers/new.jpg",
      });

      expect(updateRes.templateId).toBe("tmpl_abc");
      expect(mocks.blobDel).toHaveBeenCalledWith(
        "https://storage.private.blob.vercel-storage.com/brief-templates/covers/old.jpg"
      );

      // Archive template
      const archiveRes = await archiveBriefTemplate({ id: "tmpl_abc" });
      expect(archiveRes.templateId).toBe("tmpl_abc");
      expect(mocks.templateUpdate).toHaveBeenCalledWith({
        where: { id: "tmpl_abc" },
        data: { isArchived: true },
      });

      // Restore template
      const unarchiveRes = await unarchiveBriefTemplate({ id: "tmpl_abc" });
      expect(unarchiveRes.templateId).toBe("tmpl_abc");
      expect(mocks.templateUpdate).toHaveBeenCalledWith({
        where: { id: "tmpl_abc" },
        data: { isArchived: false },
      });
    });
  });

  describe("One-Click Conversion from Project Brief (AC-2)", () => {
    it("rejects conversion if brief is still in draft state", async () => {
      mocks.requireRole.mockResolvedValue(MANAGER_USER);
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief_draft",
        title: "Draft Campaign",
        status: BriefStatus.DRAFT,
        project: { id: "proj_1", managerId: MANAGER_USER.id },
      });

      const res = await convertBriefToTemplate({
        briefId: "brief_draft",
        title: "New Master Template",
        category: BriefTemplateCategory.COMMERCIAL,
        tags: [],
      });

      expect(res.error).toContain("Draft briefs cannot be converted");
      expect(mocks.templateCreate).not.toHaveBeenCalled();
    });

    it("rejects conversion if manager does not manage the brief's project", async () => {
      mocks.requireRole.mockResolvedValue(MANAGER_USER);
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief_other",
        title: "Approved Campaign",
        status: BriefStatus.APPROVED,
        project: { id: "proj_other", managerId: "different_mgr" },
      });

      const res = await convertBriefToTemplate({
        briefId: "brief_other",
        title: "Stolen Template",
        category: BriefTemplateCategory.COMMERCIAL,
        tags: [],
      });

      expect(res.error).toContain("only convert briefs from projects you manage");
      expect(mocks.templateCreate).not.toHaveBeenCalled();
    });

    it("converts approved brief into template, resetting shots to PLANNED and preserving source link", async () => {
      mocks.requireRole.mockResolvedValue(MANAGER_USER);
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief_approved",
        title: "Summer E-Comm Shoot",
        summary: "Clean background look.",
        status: BriefStatus.APPROVED,
        deliverables: "40 Web JPEGs",
        guidelines: "White seamless paper roll",
        externalUrl: "https://figma.com/file/123",
        fileUrl: "https://blob.mock/guide.pdf",
        fileName: "StyleGuide.pdf",
        tags: ["summer", "ecomm"],
        shotList: [
          {
            id: "shot_1",
            title: "Front Flat Lay",
            framing: "TOP_DOWN",
            status: "COMPLETED", // Note: completed in past shoot
            props: ["shoes"],
          },
        ],
        project: { id: "proj_1", managerId: MANAGER_USER.id },
      });

      mocks.templateCreate.mockResolvedValue({ id: "tmpl_minted" });

      const res = await convertBriefToTemplate({
        briefId: "brief_approved",
        title: "Master E-Comm Template",
        category: BriefTemplateCategory.ECOMMERCE,
        tags: ["ecommerce", "flatlay"],
      });

      expect(res.templateId).toBe("tmpl_minted");
      expect(mocks.templateCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Master E-Comm Template",
            summary: "Clean background look.",
            category: BriefTemplateCategory.ECOMMERCE,
            sourceBriefId: "brief_approved",
            shotList: [
              expect.objectContaining({
                title: "Front Flat Lay",
                status: "PLANNED", // Reset to planned
              }),
            ],
            externalLinks: [{ label: "Original Reference", url: "https://figma.com/file/123" }],
            attachmentUrl: "https://blob.mock/guide.pdf",
          }),
        })
      );
    });
  });

  describe("Brief Instantiation from Template (AC-3, AC-4)", () => {
    it("blocks instantiation of archived templates", async () => {
      mocks.requireRole.mockResolvedValue(MANAGER_USER);
      mocks.templateFindUnique.mockResolvedValue({
        id: "tmpl_archived",
        title: "Old Template",
        isArchived: true,
      });

      const res = await instantiateBriefFromTemplate({
        templateId: "tmpl_archived",
        target: {
          type: "EXISTING_PROJECT",
          projectId: "proj_1",
        },
      });

      expect(res.error).toContain("Cannot instantiate an archived template");
    });

    it("instantiates into existing project: deep copies shots with new IDs, resets primary brief, and increments usage", async () => {
      mocks.requireRole.mockResolvedValue(MANAGER_USER);
      mocks.templateFindUnique.mockResolvedValue({
        id: "tmpl_valid",
        title: "Studio Lookbook Template",
        summary: "Lookbook default",
        guidelines: "Diffused tungsten",
        deliverables: "High res",
        isArchived: false,
        tags: ["lookbook"],
        shotList: [
          {
            id: "orig_shot_1",
            title: "Outfit 1 Hero",
            framing: "WIDE",
            status: "IN_PROGRESS",
          },
        ],
      });

      mocks.projectFindFirst.mockResolvedValue({
        id: "proj_1",
        name: "Autumn Campaign",
        managerId: MANAGER_USER.id,
      });

      mocks.briefCreate.mockResolvedValue({
        id: "brief_instantiated",
      });

      const res = await instantiateBriefFromTemplate({
        templateId: "tmpl_valid",
        target: {
          type: "EXISTING_PROJECT",
          projectId: "proj_1",
          isPrimary: true,
          title: "Autumn Lookbook Shoot",
        },
      });

      expect(res.briefId).toBe("brief_instantiated");
      expect(res.projectId).toBe("proj_1");

      // Verify other briefs on project were reset from primary
      expect(mocks.briefUpdateMany).toHaveBeenCalledWith({
        where: { projectId: "proj_1", isPrimary: true },
        data: { isPrimary: false },
      });

      // Verify brief creation with new shot IDs and PLANNED status
      expect(mocks.briefCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Autumn Lookbook Shoot",
            projectId: "proj_1",
            isPrimary: true,
            status: BriefStatus.DRAFT,
            templateId: "tmpl_valid",
            shotList: [
              expect.objectContaining({
                title: "Outfit 1 Hero",
                status: "PLANNED",
                id: expect.not.stringMatching("orig_shot_1"), // Fresh ID
              }),
            ],
          }),
        })
      );

      // Verify template usageCount incremented
      expect(mocks.templateUpdate).toHaveBeenCalledWith({
        where: { id: "tmpl_valid" },
        data: { usageCount: { increment: 1 } },
      });
    });

    it("instantiates into new project shell: verifies client invitation, creates project & brief in transaction", async () => {
      mocks.requireRole.mockResolvedValue(MANAGER_USER);
      mocks.templateFindUnique.mockResolvedValue({
        id: "tmpl_valid",
        title: "Portrait Studio Kit",
        summary: "Headshots",
        isArchived: false,
        tags: ["headshot"],
        shotList: [],
      });

      mocks.userFindFirst.mockResolvedValue({
        id: CLIENT_USER.id,
        role: UserRole.CLIENT,
      });

      mocks.projectCreate.mockResolvedValue({
        id: "new_proj_999",
        name: "Executive Portraits",
      });

      mocks.briefCreate.mockResolvedValue({
        id: "new_brief_999",
      });

      const res = await instantiateBriefFromTemplate({
        templateId: "tmpl_valid",
        target: {
          type: "NEW_PROJECT",
          projectName: "Executive Portraits",
          clientId: CLIENT_USER.id,
          description: "Headshots for website",
        },
      });

      expect(res.briefId).toBe("new_brief_999");
      expect(res.projectId).toBe("new_proj_999");

      // Project created with manager
      expect(mocks.projectCreate).toHaveBeenCalledWith({
        data: {
          name: "Executive Portraits",
          description: "Headshots for website",
          managerId: MANAGER_USER.id,
          clientId: CLIENT_USER.id,
          studioId: `studio-${MANAGER_USER.id}`,
        },
      });

      // New brief created as primary
      expect(mocks.briefCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: "new_proj_999",
            isPrimary: true,
            status: BriefStatus.DRAFT,
          }),
        })
      );
    });
  });

  describe("Querying & Role Restrictions (AC-5, AC-6, AC-7)", () => {
    it("blocks clients from querying template library", async () => {
      mocks.requireUser.mockResolvedValue(CLIENT_USER);

      await expect(getBriefTemplates({})).rejects.toThrow(
        "restricted to managers and workers"
      );
    });

    it("workers can query active templates only, and cannot view archived ones", async () => {
      mocks.requireUser.mockResolvedValue(WORKER_USER);
      mocks.templateCount.mockResolvedValue(1);
      mocks.templateFindMany.mockResolvedValue([
        {
          id: "tmpl_1",
          title: "Fashion Editorial",
          category: BriefTemplateCategory.EDITORIAL,
          tags: ["fashion"],
          summary: "Editorial style",
          deliverables: "High res",
          guidelines: "Moody",
          externalLinks: null,
          shotList: [],
          coverImageUrl: null,
          attachmentUrl: null,
          attachmentName: null,
          usageCount: 3,
          isArchived: false,
          createdById: "mgr_123",
          createdBy: { id: "mgr_123", name: "Manager", image: null },
          sourceBriefId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await getBriefTemplates({
        includeArchived: true, // Worker asks for archived
      });

      expect(res.templates).toHaveLength(1);
      // Prisma where query must enforce isArchived: false for workers
      expect(mocks.templateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ isArchived: false }]),
          }),
        })
      );
    });

    it("managers can query all templates including archived ones", async () => {
      mocks.requireUser.mockResolvedValue(MANAGER_USER);
      mocks.templateCount.mockResolvedValue(2);
      mocks.templateFindMany.mockResolvedValue([]);

      await getBriefTemplates({
        includeArchived: true,
        category: BriefTemplateCategory.COMMERCIAL,
      });

      expect(mocks.templateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { category: BriefTemplateCategory.COMMERCIAL },
            ]),
          }),
        })
      );
    });

    it("blocks clients from querying studio brief archive", async () => {
      mocks.requireUser.mockResolvedValue(CLIENT_USER);

      await expect(getStudioBriefArchive({})).rejects.toThrow(
        "restricted to managers and workers"
      );
    });

    it("filters the studio brief archive by readable project and client names", async () => {
      mocks.requireUser.mockResolvedValue(MANAGER_USER);
      mocks.briefCount.mockResolvedValue(0);
      mocks.briefFindMany.mockResolvedValue([]);

      await getStudioBriefArchive({ project: "Jossy Wedding", client: "Winter Co" });

      expect(mocks.briefCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { project: { name: { equals: "Jossy Wedding", mode: "insensitive" } } },
              { project: { client: { name: { equals: "Winter Co", mode: "insensitive" } } } },
            ]),
          }),
        })
      );
    });

    it("studio brief archive scrubs client email for workers", async () => {
      mocks.requireUser.mockResolvedValue(WORKER_USER);
      mocks.briefCount.mockResolvedValue(1);
      mocks.briefFindMany.mockResolvedValue([
        {
          id: "brief_past",
          title: "Winter Lookbook",
          summary: "Warm tones",
          status: BriefStatus.COMPLETED,
          isPrimary: true,
          version: 1,
          deliverables: "JPEGs",
          guidelines: "Soft glow",
          shotList: [],
          externalUrl: null,
          fileUrl: null,
          fileName: null,
          tags: ["winter"],
          projectId: "proj_1",
          project: {
            id: "proj_1",
            name: "Winter Collection",
            client: {
              id: "clt_1",
              name: "Winter Co",
              image: null,
              email: "confidential@winterco.com",
            },
          },
          createdBy: { id: "mgr_1", name: "Manager", image: null },
          templateId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await getStudioBriefArchive({});
      expect(res.briefs).toHaveLength(1);
      // Email must be scrubbed to null for worker
      expect(res.briefs[0].project.client?.email).toBeNull();
    });

    it("getBriefTemplateDetail blocks worker from viewing archived template", async () => {
      mocks.requireUser.mockResolvedValue(WORKER_USER);
      mocks.templateFindUnique.mockResolvedValue({
        id: "tmpl_archived",
        isArchived: true,
        shotList: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const detail = await getBriefTemplateDetail("tmpl_archived");
      expect(detail).toBeNull();
    });
  });
});
