import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  blobDel: vi.fn(),
  blobPut: vi.fn(),
  briefFindUnique: vi.fn(),
  briefFindMany: vi.fn(),
  briefFindFirst: vi.fn(),
  briefCount: vi.fn(),
  briefCreate: vi.fn(),
  briefUpdate: vi.fn(),
  briefUpdateMany: vi.fn(),
  briefDelete: vi.fn(),
  signOffCreate: vi.fn(),
  signOffUpsert: vi.fn(),
  signOffFindUnique: vi.fn(),
  signOffUpdate: vi.fn(),
  signOffUpdateMany: vi.fn(),
  signOffDeleteMany: vi.fn(),
  questionCreate: vi.fn(),
  questionFindUnique: vi.fn(),
  questionUpdate: vi.fn(),
  projectFindUnique: vi.fn(),
  projectFindMany: vi.fn(),
  userFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authz", () => ({
  requireRole: mocks.requireRole,
  requireUser: mocks.requireUser,
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
    creativeBrief: {
      findUnique: mocks.briefFindUnique,
      findMany: mocks.briefFindMany,
      findFirst: mocks.briefFindFirst,
      count: mocks.briefCount,
      create: mocks.briefCreate,
      update: mocks.briefUpdate,
      updateMany: mocks.briefUpdateMany,
      delete: mocks.briefDelete,
    },
    briefSignOff: {
      create: mocks.signOffCreate,
      upsert: mocks.signOffUpsert,
      findUnique: mocks.signOffFindUnique,
      update: mocks.signOffUpdate,
      updateMany: mocks.signOffUpdateMany,
      deleteMany: mocks.signOffDeleteMany,
    },
    briefQuestion: {
      create: mocks.questionCreate,
      findUnique: mocks.questionFindUnique,
      update: mocks.questionUpdate,
    },
    project: {
      findUnique: mocks.projectFindUnique,
      findMany: mocks.projectFindMany,
    },
    user: {
      findMany: mocks.userFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  createCreativeBrief,
  updateCreativeBrief,
  deleteCreativeBrief,
  publishCreativeBrief,
  submitBriefSignOff,
  waiveBriefSignOff,
  addBriefReviewer,
  removeBriefReviewer,
  updateShotItemStatus,
  postBriefQuestion,
  resolveBriefQuestion,
} from "@/app/actions/briefs";
import {
  getProjectBriefs,
  managerCanAccessBrief,
  workerCanAccessBrief,
  computeShotStats,
} from "@/lib/briefs";
import {
  createCreativeBriefSchema,
  shotItemSchema,
} from "@/lib/validation/briefs";
import { BriefStatus, SignOffStatus, UserRole } from "@/generated/prisma/client";

describe("Slice 13: Creative Brief Review & Worker Sign-off", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.blobDel.mockResolvedValue(undefined);
    mocks.blobPut.mockResolvedValue({
      url: "https://blob.vercel-storage.com/brief-spec.pdf",
      pathname: "briefs/spec.pdf",
    });
    mocks.requireRole.mockResolvedValue({
      id: "manager-1",
      role: UserRole.MANAGER,
    });
    mocks.requireUser.mockResolvedValue({
      id: "manager-1",
      role: UserRole.MANAGER,
    });
    mocks.briefFindFirst.mockResolvedValue({ id: "brief-1" });
    mocks.briefCount.mockResolvedValue(0);
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        if (typeof callback === "function") {
          return callback({
            creativeBrief: {
              findUnique: mocks.briefFindUnique,
              create: mocks.briefCreate,
              update: mocks.briefUpdate,
              updateMany: mocks.briefUpdateMany,
              delete: mocks.briefDelete,
            },
            briefSignOff: {
              create: mocks.signOffCreate,
              upsert: mocks.signOffUpsert,
            },
            briefQuestion: {
              create: mocks.questionCreate,
            },
          });
        }
        return callback;
      }
    );
  });

  describe("Validation & ShotItem Schema", () => {
    it("validates shotItemSchema structure and framing options", () => {
      const validShot = {
        id: "shot-1",
        title: "Hero Bottle Lockup",
        description: "Backlit with softbox, wide framing",
        props: ["Amber bottle", "wood base"],
        framing: "WIDE",
        status: "PLANNED",
        order: 0,
      };

      const result = shotItemSchema.safeParse(validShot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.framing).toBe("WIDE");
        expect(result.data.props).toEqual(["Amber bottle", "wood base"]);
      }
    });

    it("rejects brief creation missing project or title", () => {
      const invalid = {
        title: "",
        projectId: "",
      };
      const res = createCreativeBriefSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it("computes shotStats correctly across planned, progress, completed, and skipped", () => {
      const shots = [
        { id: "1", title: "Shot 1", status: "COMPLETED" },
        { id: "2", title: "Shot 2", status: "COMPLETED" },
        { id: "3", title: "Shot 3", status: "IN_PROGRESS" },
        { id: "4", title: "Shot 4", status: "SKIPPED" },
        { id: "5", title: "Shot 5", status: "PLANNED" },
      ];

      const stats = computeShotStats(shots);
      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.skipped).toBe(1);
      expect(stats.planned).toBe(1);
      expect(stats.percentage).toBe(40);
    });
  });

  describe("Brief Creation & Updates", () => {
    it("creates creative brief and enforces single primary brief invariant", async () => {
      mocks.projectFindUnique.mockResolvedValue({ id: "proj-1", managerId: "manager-1" });
      mocks.briefCreate.mockResolvedValue({ id: "brief-100" });

      const result = await createCreativeBrief({
        projectId: "proj-1",
        title: "Summer Campaign Master Brief",
        summary: "Key visual direction for product shoot",
        isPrimary: true,
        deliverables: "10 retouched JPEGs",
        guidelines: "Warm tones",
      });

      expect(result.success).toBe("Creative brief created successfully.");
      expect(result.briefId).toBe("brief-100");
      expect(mocks.briefUpdateMany).toHaveBeenCalledWith({
        where: { projectId: "proj-1", isPrimary: true },
        data: { isPrimary: false },
      });
    });

    it("does not allow a manager to create a brief under another manager's project", async () => {
      mocks.projectFindUnique.mockResolvedValue({ id: "proj-elsewhere", managerId: "manager-2" });
      const result = await createCreativeBrief({ projectId: "proj-elsewhere", title: "Unauthorized brief" });
      expect(result.error).toBe("The associated project was not found.");
      expect(mocks.briefCreate).not.toHaveBeenCalled();
    });

    it("increments version and requests re-acknowledgment on major revision", async () => {
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-1",
        projectId: "proj-1",
        version: 1,
        status: BriefStatus.IN_REVIEW,
        fileUrl: null,
        signOffs: [
          { userId: "worker-1", version: 1 },
          { userId: "worker-2", version: 1 },
        ],
      });

      const result = await updateCreativeBrief({
        id: "brief-1",
        title: "Updated Guidelines with New Deliverables",
        majorRevision: true,
        revisionSummary: "Added 5 macro shots",
      });

      expect(result.success).toContain("Brief updated to version 2");
      expect(mocks.briefUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "brief-1" },
          data: expect.objectContaining({
            version: 2,
            status: BriefStatus.IN_REVIEW,
            revisionSummary: "Added 5 macro shots",
          }),
        })
      );
      // New sign-off records created for past enrolled reviewers
      expect(mocks.signOffCreate).toHaveBeenCalledTimes(2);
    });

    it("deletes an eligible draft and removes its managed file", async () => {
      mocks.briefFindFirst.mockResolvedValue({ id: "brief-del" });
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-del",
        status: BriefStatus.DRAFT,
        fileUrl:
          "https://store.private.blob.vercel-storage.com/briefs/brief-del.pdf",
        fileKey: "briefs/brief-del.pdf",
          project: { studioId: "studio-manager-1" },
        signOffs: [{ status: SignOffStatus.PENDING }],
        _count: { questions: 0 },
      });
      mocks.briefDelete.mockResolvedValue({ id: "brief-del" });

      const result = await deleteCreativeBrief({ id: "brief-del" });
      expect(result.success).toBe("Creative brief deleted successfully.");
      expect(mocks.blobDel).toHaveBeenCalledWith(
        "https://store.private.blob.vercel-storage.com/briefs/brief-del.pdf"
      );
      expect(mocks.briefDelete).toHaveBeenCalledWith({
        where: { id: "brief-del" },
      });
    });

    it("preserves published briefs and their review history", async () => {
      mocks.briefFindFirst.mockResolvedValue({ id: "brief-reviewed" });
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-reviewed",
        status: BriefStatus.IN_REVIEW,
        fileUrl: null,
        fileKey: null,
        project: { studioId: "studio-manager-1" },
        signOffs: [],
        _count: { questions: 0 },
      });

      const result = await deleteCreativeBrief({ id: "brief-reviewed" });
      expect(result.error).toBe("Only unpublished draft briefs can be deleted.");
      expect(mocks.briefDelete).not.toHaveBeenCalled();
      expect(mocks.blobDel).not.toHaveBeenCalled();
    });

    it("preserves drafts that already have completed reviews or discussion", async () => {
      mocks.briefFindFirst.mockResolvedValue({ id: "brief-history" });
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-history",
        status: BriefStatus.DRAFT,
        fileUrl: null,
        fileKey: null,
        project: { studioId: "studio-manager-1" },
        signOffs: [{ status: SignOffStatus.SIGNED }],
        _count: { questions: 0 },
      });

      const result = await deleteCreativeBrief({ id: "brief-history" });
      expect(result.error).toContain("completed review or discussion history");
      expect(mocks.briefDelete).not.toHaveBeenCalled();
    });
  });

  describe("Publishing & Snapshot Reviewer Enrollment", () => {
    it("snapshots distinct workers assigned to project tasks on publish", async () => {
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-pub",
        version: 1,
        status: BriefStatus.DRAFT,
        project: {
          id: "proj-1",
          tasks: [
            { assignees: [{ userId: "worker-1" }, { userId: "worker-2" }] },
            { assignees: [{ userId: "worker-2" }, { userId: "worker-3" }] },
          ],
        },
      });

      const result = await publishCreativeBrief("brief-pub");
      expect(result.success).toContain("Enrolled 3 crew reviewers");
      expect(result.enrolledCount).toBe(3);
      expect(mocks.briefUpdate).toHaveBeenCalledWith({
        where: { id: "brief-pub" },
        data: { status: BriefStatus.IN_REVIEW },
      });
      expect(mocks.signOffUpsert).toHaveBeenCalledTimes(3);
    });

    it("allows manager to manually add and remove reviewers", async () => {
      mocks.briefFindUnique.mockResolvedValue({ id: "brief-1", version: 1 });
      mocks.signOffUpsert.mockResolvedValue({ id: "sign-1" });

      const addRes = await addBriefReviewer({
        briefId: "brief-1",
        userId: "worker-specialist",
      });
      expect(addRes.success).toBe("Reviewer added to creative brief.");
      expect(mocks.signOffUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            briefId_userId_version: {
              briefId: "brief-1",
              userId: "worker-specialist",
              version: 1,
            },
          },
        })
      );

      const removeRes = await removeBriefReviewer({
        briefId: "brief-1",
        userId: "worker-specialist",
      });
      expect(removeRes.success).toBe("Reviewer removed from creative brief.");
      expect(mocks.signOffDeleteMany).toHaveBeenCalledWith({
        where: {
          briefId: "brief-1",
          userId: "worker-specialist",
          version: 1,
        },
      });
    });
  });

  describe("Worker Sign-off & Concurrency Protection", () => {
    it("submits worker sign-off and records timestamp and note", async () => {
      mocks.requireRole.mockResolvedValue({
        id: "worker-1",
        role: UserRole.WORKER,
      });
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-1",
        version: 1,
        status: BriefStatus.IN_REVIEW,
      });
      mocks.signOffFindUnique.mockResolvedValue({
        id: "so-1",
        status: SignOffStatus.PENDING,
      });

      const res = await submitBriefSignOff({
        briefId: "brief-1",
        version: 1,
        note: "Lighting pack confirmed",
      });

      expect(res.success).toContain("Sign-off recorded successfully");
      expect(mocks.signOffUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "so-1" },
          data: expect.objectContaining({
            status: SignOffStatus.SIGNED,
            note: "Lighting pack confirmed",
          }),
        })
      );
    });

    it("rejects sign-off with 409 error if brief version bumped concurrently", async () => {
      mocks.requireRole.mockResolvedValue({
        id: "worker-1",
        role: UserRole.WORKER,
      });
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-1",
        version: 2, // Brief was updated to version 2
        status: BriefStatus.IN_REVIEW,
      });

      const res = await submitBriefSignOff({
        briefId: "brief-1",
        version: 1, // Worker attempts to sign version 1
      });

      expect(res.error).toContain("brief has been updated to version 2");
      expect(mocks.signOffUpdate).not.toHaveBeenCalled();
    });

    it("allows manager to waive absent worker with audit reason", async () => {
      mocks.briefFindUnique.mockResolvedValue({ id: "brief-1", version: 1 });

      const res = await waiveBriefSignOff({
        briefId: "brief-1",
        userId: "worker-absent",
        reason: "Worker on sick leave, covered by lead photographer",
      });

      expect(res.success).toBe("Worker sign-off waived successfully.");
      expect(mocks.signOffUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            briefId: "brief-1",
            userId: "worker-absent",
            version: 1,
          },
          data: expect.objectContaining({
            status: SignOffStatus.WAIVED,
            waivedById: "manager-1",
            waiveReason: "Worker on sick leave, covered by lead photographer",
          }),
        })
      );
    });
  });

  describe("Shot List Execution & Discussion Q&A", () => {
    it("updates individual shot item status during production", async () => {
      mocks.requireRole.mockResolvedValue({
        id: "worker-1",
        role: UserRole.WORKER,
      });
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-1",
        shotList: [
          { id: "shot-1", title: "Setup 1", status: "PLANNED" },
          { id: "shot-2", title: "Setup 2", status: "PLANNED" },
        ],
      });

      const res = await updateShotItemStatus({
        briefId: "brief-1",
        shotId: "shot-1",
        status: "COMPLETED",
      });

      expect(res.success).toBe("Shot status updated to COMPLETED.");
      expect(mocks.briefUpdate).toHaveBeenCalledWith({
        where: { id: "brief-1" },
        data: {
          shotList: [
            { id: "shot-1", title: "Setup 1", status: "COMPLETED" },
            { id: "shot-2", title: "Setup 2", status: "PLANNED" },
          ],
        },
      });
    });

    it("posts question and flags blocker transitioning brief status to CHANGES_REQUESTED", async () => {
      mocks.requireRole.mockResolvedValue({
        id: "worker-1",
        role: UserRole.WORKER,
      });
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-1",
        version: 1,
        status: BriefStatus.IN_REVIEW,
      });
      mocks.questionCreate.mockResolvedValue({ id: "q-1" });

      const res = await postBriefQuestion({
        briefId: "brief-1",
        content: "We are missing the amber glass bottles needed for Shot 3.",
        isBlocker: true,
      });

      expect(res.success).toContain("flagged as blocker");
      expect(mocks.briefUpdate).toHaveBeenCalledWith({
        where: { id: "brief-1" },
        data: { status: BriefStatus.CHANGES_REQUESTED },
      });
      expect(mocks.questionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: "We are missing the amber glass bottles needed for Shot 3.",
            isBlocker: true,
          }),
        })
      );
    });

    it("resolves question when answered by manager or author", async () => {
      mocks.requireRole.mockResolvedValue({
        id: "manager-1",
        role: UserRole.MANAGER,
      });
      mocks.questionFindUnique.mockResolvedValue({
        id: "q-1",
        authorId: "worker-1",
      });

      const res = await resolveBriefQuestion({
        questionId: "q-1",
        isResolved: true,
      });

      expect(res.success).toBe("Question marked resolved.");
      expect(mocks.questionUpdate).toHaveBeenCalledWith({
        where: { id: "q-1" },
        data: { isResolved: true },
      });
    });
  });

  describe("Client Boundary & Detail Queries", () => {
    it("hides draft briefs and internal crew discussions from clients", async () => {
      mocks.requireUser.mockResolvedValue({
        id: "client-1",
        role: UserRole.CLIENT,
      });

      mocks.briefFindMany.mockResolvedValue([
        {
          id: "brief-pub",
          title: "Public Approved Brief",
          version: 1,
          status: BriefStatus.APPROVED,
          shotList: [],
          signOffs: [{ version: 1, status: SignOffStatus.SIGNED }],
          questions: [{ content: "Internal worker secret note" }],
        },
      ]);

      mocks.briefCount.mockResolvedValue(1);
      const result = await getProjectBriefs({});
      expect(result.briefs).toHaveLength(1);
      // Client safety: questions and sign-off arrays are scrubbed
      expect(result.briefs[0].questions).toEqual([]);
      expect(result.briefs[0].signOffs).toEqual([]);
      expect(mocks.briefFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project: { clientId: "client-1" },
            AND: expect.arrayContaining([
              { status: { not: BriefStatus.DRAFT } },
            ]),
          }),
        })
      );
    });

    it("paginates brief queries and filters projects by a readable name", async () => {
      mocks.requireUser.mockResolvedValue({ id: "manager-1", role: UserRole.MANAGER });
      mocks.briefCount.mockResolvedValue(31);
      mocks.briefFindMany.mockResolvedValue([]);

      const result = await getProjectBriefs({ projectName: "Summer Campaign", page: 2 });

      expect(result).toMatchObject({ total: 31, page: 2, pageSize: 12 });
      expect(mocks.briefFindMany).toHaveBeenCalledWith(expect.objectContaining({
        skip: 12,
        take: 12,
        where: expect.objectContaining({ project: { studioId: "studio-manager-1" } }),
      }));
      expect(mocks.briefFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ project: { is: { name: "Summer Campaign" } } }],
        }),
      }));
    });

    it("keeps client draft exclusion even when a draft status is requested", async () => {
      mocks.requireUser.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT });
      mocks.briefCount.mockResolvedValue(0);
      mocks.briefFindMany.mockResolvedValue([]);

      await getProjectBriefs({ status: BriefStatus.DRAFT });
      expect(mocks.briefFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { status: { not: BriefStatus.DRAFT } },
            { status: BriefStatus.DRAFT },
          ]),
        }),
      }));
    });

    it("preserves role and project scopes when a search term is present", async () => {
      mocks.requireUser.mockResolvedValue({ id: "client-1", role: UserRole.CLIENT });
      mocks.briefCount.mockResolvedValue(0);
      mocks.briefFindMany.mockResolvedValue([]);

      await getProjectBriefs({ projectName: "Owned Project", search: "catalog" });
      expect(mocks.briefFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          project: { clientId: "client-1" },
          AND: expect.arrayContaining([
            { status: { not: BriefStatus.DRAFT } },
            { project: { is: { name: "Owned Project" } } },
            expect.objectContaining({ OR: expect.any(Array) }),
          ]),
        }),
      }));
    });

    it("scopes worker brief access to assigned project work or a sign-off record", async () => {
      mocks.briefFindFirst.mockResolvedValue(null);
      expect(await workerCanAccessBrief("brief-private", "worker-1")).toBe(false);
      expect(mocks.briefFindFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: "brief-private",
          status: { not: BriefStatus.DRAFT },
          OR: expect.arrayContaining([
            { signOffs: { some: { userId: "worker-1" } } },
          ]),
        }),
      }));
    });

    it("scopes manager brief access to projects they manage", async () => {
      mocks.briefFindFirst.mockResolvedValue(null);
      expect(await managerCanAccessBrief("brief-private", "manager-1")).toBe(false);
      expect(mocks.briefFindFirst).toHaveBeenCalledWith({
        where: { id: "brief-private", project: { managerId: "manager-1" } },
        select: { id: true },
      });
    });

    it("blocks managers from updating shot items in another manager's brief", async () => {
      mocks.briefFindUnique.mockResolvedValue({
        id: "brief-private",
        shotList: [],
        status: BriefStatus.IN_REVIEW,
      });
      mocks.briefFindFirst.mockResolvedValue(null);

      const result = await updateShotItemStatus({
        briefId: "brief-private",
        shotId: "shot-1",
        status: "COMPLETED",
      });

      expect(result.error).toBe("You do not have access to this brief.");
      expect(mocks.briefUpdate).not.toHaveBeenCalled();
    });
  });
});
