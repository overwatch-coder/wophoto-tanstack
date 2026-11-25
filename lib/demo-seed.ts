import { createHash } from "node:crypto";
import {
  BrandAssetType,
  BriefStatus,
  BriefTemplateCategory,
  CommentVisibility,
  EditCause,
  FeedbackStatus,
  FeedbackType,
  InventoryActivityAction,
  InventoryCondition,
  InventoryStatus,
  InvitationStatus,
  LoanStatus,
  MaintenanceStatus,
  NotificationCategory,
  NotificationEmailStatus,
  NotificationType,
  Prisma,
  ProjectCollaboratorRole,
  ScheduleEventType,
  SignOffStatus,
  Specialization,
  TaskPriority,
  TaskStatus,
  TaskType,
  UserRole,
  UserStatus,
  WorkerAvailability,
  WorkRequestStatus,
  WorkRequestType,
} from "@/generated/prisma/client";
import {
  DEMO_ALL_USER_IDS,
  DEMO_PERSONAS,
  DEMO_STUDIO_ID,
  DEMO_STUDIO_NAME,
  DEMO_SUPPORT_USERS,
} from "@/lib/demo";
import { prisma } from "@/lib/prisma";

function daysOffset(days: number, hour = 10, minute = 0): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function monthsAgoDay(monthsAgo: number, dayOfMonth: number, hour = 11): Date {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - monthsAgo);
  date.setUTCDate(Math.min(dayOfMonth, 28));
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

function demoTokenHash(seed: string): string {
  return createHash("sha256").update(`wophoto-demo:${seed}`).digest("hex");
}

let inFlightSeed: Promise<void> | null = null;

/**
 * Ensures the isolated Demo Studio exists before issuing a demo session.
 * Short-circuits immediately once seeded unless explicitly reset.
 */
export async function ensureDemoStudioSeeded(): Promise<void> {
  const existing = await prisma.studio.findUnique({
    where: { id: DEMO_STUDIO_ID },
    select: { id: true },
  });
  if (existing) return;

  if (!inFlightSeed) {
    inFlightSeed = seedDemoStudio({ reset: false }).finally(() => {
      inFlightSeed = null;
    });
  }
  await inFlightSeed;
}

/**
 * Clears ONLY records belonging to the isolated Demo Studio (never real studios).
 */
async function cleanupDemoStudioData(tx: Prisma.TransactionClient) {
  const demoUserIds = [...DEMO_ALL_USER_IDS];

  await tx.notification.deleteMany({
    where: {
      OR: [
        { userId: { in: demoUserIds } },
        { actorId: { in: demoUserIds } },
        { project: { studioId: DEMO_STUDIO_ID } },
      ],
    },
  });

  await tx.clientFeedback.deleteMany({
    where: { project: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.workRequest.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.rating.deleteMany({
    where: { project: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.comment.deleteMany({
    where: { project: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.taskRevision.deleteMany({
    where: { task: { project: { studioId: DEMO_STUDIO_ID } } },
  });

  await tx.taskDeliverable.deleteMany({
    where: { task: { project: { studioId: DEMO_STUDIO_ID } } },
  });

  await tx.taskService.deleteMany({
    where: { task: { project: { studioId: DEMO_STUDIO_ID } } },
  });

  await tx.taskSpecialization.deleteMany({
    where: { task: { project: { studioId: DEMO_STUDIO_ID } } },
  });

  await tx.taskAssignee.deleteMany({
    where: { task: { project: { studioId: DEMO_STUDIO_ID } } },
  });

  await tx.task.deleteMany({
    where: { project: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.briefQuestion.deleteMany({
    where: { brief: { project: { studioId: DEMO_STUDIO_ID } } },
  });

  await tx.briefSignOff.deleteMany({
    where: { brief: { project: { studioId: DEMO_STUDIO_ID } } },
  });

  await tx.creativeBrief.deleteMany({
    where: { project: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.briefTemplate.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.brandAsset.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.scheduleEvent.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.inventoryActivityLog.deleteMany({
    where: { item: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.inventoryMaintenanceLog.deleteMany({
    where: { item: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.inventoryLoan.deleteMany({
    where: { item: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.inventoryItem.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.projectCollaborator.deleteMany({
    where: { project: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.project.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.studioService.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.copilotUsageEvent.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.copilotAccessOverride.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.copilotStudioPolicy.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.studioMemberPermission.deleteMany({
    where: { studioMember: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.studioMember.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.invitationPermission.deleteMany({
    where: { invitation: { studioId: DEMO_STUDIO_ID } },
  });

  await tx.invitation.deleteMany({
    where: { studioId: DEMO_STUDIO_ID },
  });

  await tx.studio.deleteMany({
    where: { id: DEMO_STUDIO_ID },
  });

  await tx.userSpecialization.deleteMany({
    where: { userId: { in: demoUserIds } },
  });

  await tx.userPreference.deleteMany({
    where: { userId: { in: demoUserIds } },
  });

  await tx.session.deleteMany({
    where: { userId: { in: demoUserIds } },
  });

  await tx.user.deleteMany({
    where: { id: { in: demoUserIds } },
  });
}

export async function seedDemoStudio(options: { reset?: boolean } = {}): Promise<void> {
  const { reset = false } = options;

  if (!reset) {
    const existing = await prisma.studio.findUnique({
      where: { id: DEMO_STUDIO_ID },
      select: { id: true },
    });
    if (existing) return;
  }

  await prisma.$transaction(
    async (tx) => {
      await cleanupDemoStudioData(tx);

      const manager = DEMO_PERSONAS.MANAGER;
      const worker1 = DEMO_PERSONAS.WORKER;
      const client1 = DEMO_PERSONAS.CLIENT;
      const supervisor = DEMO_SUPPORT_USERS.SUPERVISOR;
      const worker2 = DEMO_SUPPORT_USERS.WORKER_2;
      const worker3 = DEMO_SUPPORT_USERS.WORKER_3;
      const client2 = DEMO_SUPPORT_USERS.CLIENT_2;

      // 1. Users
      await tx.user.createMany({
        data: [
          {
            id: manager.id,
            name: manager.name,
            email: manager.email,
            role: UserRole.MANAGER,
            status: UserStatus.ACTIVE,
            emailVerified: daysOffset(-120),
          },
          {
            id: supervisor.id,
            name: supervisor.name,
            email: supervisor.email,
            role: UserRole.SUPERVISOR,
            status: UserStatus.ACTIVE,
            emailVerified: daysOffset(-110),
          },
          {
            id: worker1.id,
            name: worker1.name,
            email: worker1.email,
            role: UserRole.WORKER,
            status: UserStatus.ACTIVE,
            emailVerified: daysOffset(-115),
          },
          {
            id: worker2.id,
            name: worker2.name,
            email: worker2.email,
            role: UserRole.WORKER,
            status: UserStatus.ACTIVE,
            emailVerified: daysOffset(-105),
          },
          {
            id: worker3.id,
            name: worker3.name,
            email: worker3.email,
            role: UserRole.WORKER,
            status: UserStatus.ACTIVE,
            emailVerified: daysOffset(-95),
          },
          {
            id: client1.id,
            name: client1.name,
            email: client1.email,
            role: UserRole.CLIENT,
            status: UserStatus.ACTIVE,
            emailVerified: daysOffset(-110),
          },
          {
            id: client2.id,
            name: client2.name,
            email: client2.email,
            role: UserRole.CLIENT,
            status: UserStatus.ACTIVE,
            emailVerified: daysOffset(-90),
          },
        ],
      });

      // 2. Studio
      await tx.studio.create({
        data: {
          id: DEMO_STUDIO_ID,
          name: DEMO_STUDIO_NAME,
          ownerUserId: manager.id,
        },
      });

      // 3. Preferences & Specializations
      await tx.userPreference.createMany({
        data: [
          {
            userId: manager.id,
            location: "Paris / Stage A",
            aiCopilotName: "Lumière Studio Copilot",
            aiAutonomousExecution: false,
          },
          {
            userId: supervisor.id,
            location: "Paris / Production Desk",
          },
          {
            userId: worker1.id,
            location: "Stage A · Bay 1",
            workerAvailability: WorkerAvailability.AVAILABLE,
          },
          {
            userId: worker2.id,
            location: "Color & Retouch Suite",
            workerAvailability: WorkerAvailability.IN_SHOOT,
          },
          {
            userId: worker3.id,
            location: "Stage B · Lighting",
            workerAvailability: WorkerAvailability.AVAILABLE,
          },
          {
            userId: client1.id,
            location: "Maison Laurent HQ",
          },
          {
            userId: client2.id,
            location: "Aether Eyewear",
          },
        ],
      });

      await tx.userSpecialization.createMany({
        data: [
          { userId: worker1.id, specialization: Specialization.PHOTOGRAPHY },
          { userId: worker1.id, specialization: Specialization.VIDEOGRAPHY },
          { userId: worker2.id, specialization: Specialization.GRAPHIC_DESIGN },
          { userId: worker2.id, specialization: Specialization.CONTENT_CREATION },
          { userId: worker3.id, specialization: Specialization.PHOTOGRAPHY },
          { userId: worker3.id, specialization: Specialization.CONTENT_CREATION },
        ],
      });

      // 4. Invitations (USED for active members + PENDING/ACCEPTED examples for Invitations view)
      const invSupervisor = await tx.invitation.create({
        data: {
          id: "demo-inv-supervisor",
          email: supervisor.email,
          role: UserRole.SUPERVISOR,
          tokenHash: demoTokenHash("supervisor"),
          status: InvitationStatus.USED,
          expiresAt: daysOffset(-60),
          acceptedAt: daysOffset(-110),
          usedAt: daysOffset(-110),
          invitedById: manager.id,
          acceptedUserId: supervisor.id,
          studioId: DEMO_STUDIO_ID,
        },
      });

      await tx.studioMember.create({
        data: {
          id: "demo-member-supervisor",
          studioId: DEMO_STUDIO_ID,
          userId: supervisor.id,
          invitationId: invSupervisor.id,
          addedById: manager.id,
        },
      });

      await tx.invitation.createMany({
        data: [
          {
            id: "demo-inv-worker-1",
            email: worker1.email,
            role: UserRole.WORKER,
            tokenHash: demoTokenHash("worker-1"),
            status: InvitationStatus.USED,
            expiresAt: daysOffset(-60),
            acceptedAt: daysOffset(-115),
            usedAt: daysOffset(-115),
            invitedById: manager.id,
            acceptedUserId: worker1.id,
            studioId: DEMO_STUDIO_ID,
          },
          {
            id: "demo-inv-worker-2",
            email: worker2.email,
            role: UserRole.WORKER,
            tokenHash: demoTokenHash("worker-2"),
            status: InvitationStatus.USED,
            expiresAt: daysOffset(-60),
            acceptedAt: daysOffset(-105),
            usedAt: daysOffset(-105),
            invitedById: manager.id,
            acceptedUserId: worker2.id,
            studioId: DEMO_STUDIO_ID,
          },
          {
            id: "demo-inv-worker-3",
            email: worker3.email,
            role: UserRole.WORKER,
            tokenHash: demoTokenHash("worker-3"),
            status: InvitationStatus.USED,
            expiresAt: daysOffset(-60),
            acceptedAt: daysOffset(-95),
            usedAt: daysOffset(-95),
            invitedById: manager.id,
            acceptedUserId: worker3.id,
            studioId: DEMO_STUDIO_ID,
          },
          {
            id: "demo-inv-client-1",
            email: client1.email,
            role: UserRole.CLIENT,
            tokenHash: demoTokenHash("client-1"),
            status: InvitationStatus.USED,
            expiresAt: daysOffset(-60),
            acceptedAt: daysOffset(-110),
            usedAt: daysOffset(-110),
            invitedById: manager.id,
            acceptedUserId: client1.id,
            studioId: DEMO_STUDIO_ID,
          },
          {
            id: "demo-inv-client-2",
            email: client2.email,
            role: UserRole.CLIENT,
            tokenHash: demoTokenHash("client-2"),
            status: InvitationStatus.USED,
            expiresAt: daysOffset(-60),
            acceptedAt: daysOffset(-90),
            usedAt: daysOffset(-90),
            invitedById: manager.id,
            acceptedUserId: client2.id,
            studioId: DEMO_STUDIO_ID,
          },
          {
            id: "demo-inv-pending-1",
            email: "freelance.stylist@wophoto.demo",
            role: UserRole.WORKER,
            tokenHash: demoTokenHash("pending-stylist"),
            status: InvitationStatus.PENDING,
            expiresAt: daysOffset(5),
            invitedById: manager.id,
            studioId: DEMO_STUDIO_ID,
          },
          {
            id: "demo-inv-pending-2",
            email: "brand.director@atelier-nord.demo",
            role: UserRole.CLIENT,
            tokenHash: demoTokenHash("pending-client"),
            status: InvitationStatus.ACCEPTED,
            expiresAt: daysOffset(4),
            acceptedAt: daysOffset(-1),
            invitedById: manager.id,
            studioId: DEMO_STUDIO_ID,
          },
        ],
      });

      // 5. Copilot Policy (visible to all roles in Demo Studio)
      await tx.copilotStudioPolicy.create({
        data: {
          managerId: manager.id,
          studioId: DEMO_STUDIO_ID,
          enabled: true,
          workersEnabled: true,
          clientsEnabled: true,
          dailyRequestLimit: 50,
        },
      });

      // 6. Studio Services
      const svcEditorial = await tx.studioService.create({
        data: {
          id: "demo-svc-editorial",
          studioId: DEMO_STUDIO_ID,
          name: "Editorial Photography",
          description: "High-fashion and campaign hero imagery on cyclorama or location.",
          isActive: true,
        },
      });
      const svcEcom = await tx.studioService.create({
        data: {
          id: "demo-svc-ecommerce",
          studioId: DEMO_STUDIO_ID,
          name: "E-Commerce Product",
          description: "High-volume PDP packshots, flat-lays, and ghost-mannequin sets.",
          isActive: true,
        },
      });
      const svcRetouch = await tx.studioService.create({
        data: {
          id: "demo-svc-retouch",
          studioId: DEMO_STUDIO_ID,
          name: "Color & Retouching",
          description: "Skin cleanup, color matching, and print-ready TIFF exports.",
          isActive: true,
        },
      });
      const svcMotion = await tx.studioService.create({
        data: {
          id: "demo-svc-motion",
          studioId: DEMO_STUDIO_ID,
          name: "Motion & BTS Reels",
          description: "Vertical campaign teasers, 360 product spins, and behind-the-scenes.",
          isActive: true,
        },
      });
      await tx.studioService.create({
        data: {
          id: "demo-svc-analog",
          studioId: DEMO_STUDIO_ID,
          name: "35mm Film Processing",
          description: "Legacy darkroom scan workflow (archived studio offering).",
          isActive: false,
        },
      });

      // 7. Projects
      const projCashmere = await tx.project.create({
        data: {
          id: "demo-proj-cashmere",
          name: "Autumn Cashmere Lookbook",
          description:
            "24-look editorial and e-commerce campaign for Maison Laurent's flagship knitwear launch.",
          targetAudience: "Luxury womenswear buyers & press editors (25–48)",
          keyMessage: "Tactile warmth, natural drape, and architectural tailoring.",
          imageryNote: "Warm directional daylight through linen diffusion; matte filmic contrast.",
          startDate: daysOffset(-28),
          deadline: daysOffset(9),
          managerId: manager.id,
          clientId: client1.id,
          studioId: DEMO_STUDIO_ID,
        },
      });

      const projSkincare = await tx.project.create({
        data: {
          id: "demo-proj-skincare",
          name: "Solstice Botanical Serum Launch",
          description:
            "Macro glass bottle hero frames, water-droplet textures, and 15s social loops.",
          targetAudience: "Clean-beauty retail & direct-to-consumer digital launch",
          keyMessage: "Clinical purity meets golden-hour botanical warmth.",
          imageryNote: "Backlit frosted amber glass on travertine stone plinths.",
          startDate: daysOffset(-18),
          deadline: daysOffset(5),
          managerId: manager.id,
          clientId: client1.id,
          studioId: DEMO_STUDIO_ID,
        },
      });

      const projEyewear = await tx.project.create({
        data: {
          id: "demo-proj-eyewear",
          name: "Aether Titanium Collection",
          description:
            "Reflective eyewear studio packshots + on-model architectural portraits.",
          targetAudience: "Design-forward optical boutiques across Europe & North America",
          keyMessage: "Featherweight brushed titanium with zero-glare precision.",
          imageryNote: "Dual strip softboxes for crisp rim highlights without lens flare.",
          startDate: daysOffset(-45),
          deadline: daysOffset(14),
          managerId: manager.id,
          clientId: client2.id,
          studioId: DEMO_STUDIO_ID,
        },
      });

      const projHoliday = await tx.project.create({
        data: {
          id: "demo-proj-holiday",
          name: "Maison Laurent Holiday Capsule",
          description:
            "Completed eveningwear gifting campaign delivered for global retail rollout.",
          targetAudience: "Holiday VIP gifting & flagship window displays",
          keyMessage: "Understated evening glamour in deep espresso and brushed brass.",
          imageryNote: "Hard tungsten key light with subtle atmospheric haze.",
          startDate: daysOffset(-95),
          deadline: daysOffset(-14),
          managerId: manager.id,
          clientId: client1.id,
          studioId: DEMO_STUDIO_ID,
        },
      });

      const projChronograph = await tx.project.create({
        data: {
          id: "demo-proj-chronograph",
          name: "Atelier Chronograph Macro Series",
          description:
            "Focus-stacked macro timepiece series and brushed steel detail plates.",
          targetAudience: "Collector catalog & Geneva showcase",
          keyMessage: "Micro-mechanical precision captured at 1:1 magnification.",
          imageryNote: "60-frame focus stacks with polarizing filters on dial crystal.",
          startDate: daysOffset(-70),
          deadline: daysOffset(-5),
          managerId: manager.id,
          clientId: client2.id,
          studioId: DEMO_STUDIO_ID,
        },
      });

      await tx.projectCollaborator.createMany({
        data: [
          {
            projectId: projCashmere.id,
            userId: supervisor.id,
            role: ProjectCollaboratorRole.COLLABORATOR,
            addedById: manager.id,
          },
          {
            projectId: projSkincare.id,
            userId: supervisor.id,
            role: ProjectCollaboratorRole.COLLABORATOR,
            addedById: manager.id,
          },
        ],
      });

      // 8. Brief Templates
      const tplLookbook = await tx.briefTemplate.create({
        data: {
          id: "demo-tpl-lookbook",
          title: "Seasonal Fashion Lookbook Playbook",
          summary:
            "Standard full-day editorial + PDP lookbook setup for 16–24 garment looks on Stage A.",
          category: BriefTemplateCategory.LOOKBOOK,
          tags: ["lookbook", "fashion", "editorial", "cyclorama"],
          deliverables:
            "3 hero full-length frames per look (4:5 + 16:9 crop) + 2 detail texture frames.",
          guidelines:
            "Maintain consistent 5200K daylight balance; tether to Capture One session with client live-view.",
          externalLinks: [
            { label: "Stage A Lighting Plot", url: "https://example.com/lighting-plot" },
          ],
          shotList: [
            {
              id: "tpl-shot-1",
              title: "Full-body walking hero",
              description: "Capture natural garment movement toward camera.",
              props: ["4x8 V-Flat", "Sandbag"],
              framing: "WIDE",
              status: "PLANNED",
              order: 0,
            },
            {
              id: "tpl-shot-2",
              title: "Three-quarter silhouette",
              description: "Highlight shoulder tailoring and drape.",
              props: ["Stool"],
              framing: "MEDIUM",
              status: "PLANNED",
              order: 1,
            },
            {
              id: "tpl-shot-3",
              title: "Fabric weave macro",
              description: "Tight stitch & texture crop for PDP zoom.",
              props: [],
              framing: "CLOSE_UP",
              status: "PLANNED",
              order: 2,
            },
          ],
          usageCount: 9,
          createdById: manager.id,
          studioId: DEMO_STUDIO_ID,
        },
      });

      const tplEcom = await tx.briefTemplate.create({
        data: {
          id: "demo-tpl-ecom",
          title: "Reflective Product & Glass Packshot",
          summary:
            "Controlled gradient specular lighting spec for bottles, eyewear, and metallic SKUs.",
          category: BriefTemplateCategory.ECOMMERCE,
          tags: ["ecommerce", "packshot", "glass", "macro"],
          deliverables: "Front, 45-degree, top-down, and texture swatch PNGs on pure white & neutral.",
          guidelines:
            "Use scrim diffusion over dual strip boxes; check clipping mask edges at 200% zoom.",
          shotList: [
            {
              id: "tpl-ecom-1",
              title: "Straight-on label hero",
              description: "Zero parallax distortion at 90mm.",
              props: ["Acrylic riser", "Scrim"],
              framing: "MEDIUM",
              status: "PLANNED",
              order: 0,
            },
            {
              id: "tpl-ecom-2",
              title: "45° specular rim angle",
              description: "Clean vertical highlight gradient along bottle edge.",
              props: ["Black card flags"],
              framing: "CLOSE_UP",
              status: "PLANNED",
              order: 1,
            },
          ],
          usageCount: 14,
          createdById: manager.id,
          studioId: DEMO_STUDIO_ID,
        },
      });

      await tx.briefTemplate.createMany({
        data: [
          {
            id: "demo-tpl-motion",
            title: "15s Campaign Motion Loop & BTS",
            summary: "Vertical 9:16 social cutdowns paired with studio lighting breakdown.",
            category: BriefTemplateCategory.SOCIAL_MEDIA,
            tags: ["video", "reels", "social", "bts"],
            deliverables: "3x 9:16 ProRes masters + 16:9 web hero loop.",
            guidelines: "Shoot 4K 60fps 180-degree shutter; leave 15% safe zone for UI overlays.",
            usageCount: 6,
            createdById: manager.id,
            studioId: DEMO_STUDIO_ID,
          },
          {
            id: "demo-tpl-editorial",
            title: "Architectural Portrait & Campaign Key Visual",
            summary: "High-contrast directional strobe setup for flagship billboards and press kits.",
            category: BriefTemplateCategory.COMMERCIAL,
            tags: ["commercial", "portrait", "key-visual"],
            deliverables: "16-bit layered PSDs + CMYK magazine spread proofs.",
            guidelines: "Color checker frame required at start of every lighting change.",
            usageCount: 4,
            createdById: manager.id,
            studioId: DEMO_STUDIO_ID,
          },
        ],
      });

      // 9. Creative Briefs, SignOffs, and Questions
      const briefCashmere = await tx.creativeBrief.create({
        data: {
          id: "demo-brief-cashmere",
          title: "Autumn Cashmere — Stage A Editorial Brief",
          summary:
            "Core creative direction for all 24 cashmere knitwear looks, lighting temperature, and hair/wardrobe continuity.",
          status: BriefStatus.APPROVED,
          isPrimary: true,
          version: 2,
          revisionSummary: "Updated warm key-light diffusion ratio per Sophia Laurent's art-direction note.",
          deliverables: "72 selects color-graded + 24 high-res retouched master TIFFs + 6 social cutdowns.",
          guidelines:
            "Keep background seamless in warm alabaster (#EDEAE4). Avoid crushing shadow detail on charcoal knits.",
          shotList: [
            {
              id: "cashmere-s1",
              title: "Oatmeal wrap coat — Hero stride",
              description: "Full-length motion frame on Stage A cyclorama.",
              props: ["Oak plinth", "8x8 bleached muslin"],
              framing: "WIDE",
              status: "COMPLETED",
              order: 0,
            },
            {
              id: "cashmere-s2",
              title: "Ribbed turtleneck — Seated portrait",
              description: "Medium frame emphasizing collar texture.",
              props: ["Vintage bentwood chair"],
              framing: "MEDIUM",
              status: "COMPLETED",
              order: 1,
            },
            {
              id: "cashmere-s3",
              title: "Brushed alpaca scarf — Fiber macro",
              description: "Tight tactile detail showing natural halo.",
              props: [],
              framing: "DETAIL",
              status: "IN_PROGRESS",
              order: 2,
            },
            {
              id: "cashmere-s4",
              title: "Camel trench — Three-quarter turn",
              description: "Check lapel stitch sharpness at f/5.6.",
              props: ["12x12 negative fill"],
              framing: "MEDIUM",
              status: "PLANNED",
              order: 3,
            },
          ],
          tags: ["lookbook", "autumn-26", "cashmere"],
          templateId: tplLookbook.id,
          projectId: projCashmere.id,
          createdById: manager.id,
        },
      });

      const briefSkincare = await tx.creativeBrief.create({
        data: {
          id: "demo-brief-skincare",
          title: "Solstice Serum — Macro & Droplet Direction",
          summary:
            "Tabletop macro lighting plan for amber glass dropper bottles and botanical oil refraction shots.",
          status: BriefStatus.IN_REVIEW,
          isPrimary: true,
          version: 1,
          deliverables: "12 hero product plates + 4 droplet macro loops.",
          guidelines: "Backlight through 1/4 CTO gel onto travertine surface; clean fingerprints every 3 frames.",
          shotList: [
            {
              id: "skin-s1",
              title: "Amber bottle hero on travertine",
              description: "Low-angle monument framing with warm caustic reflection.",
              props: ["Honed travertine slab", "Optical mirror"],
              framing: "CLOSE_UP",
              status: "IN_PROGRESS",
              order: 0,
            },
            {
              id: "skin-s2",
              title: "Glass pipette serum drop",
              description: "High-speed freeze of golden oil droplet mid-fall.",
              props: ["Syringe rig", "2400Ws pack"],
              framing: "EXTREME_CLOSE_UP",
              status: "PLANNED",
              order: 1,
            },
            {
              id: "skin-s3",
              title: "Flat-lay botanical ingredients",
              description: "Top-down arrangement with chamomile & neroli blossoms.",
              props: ["Overhead C-stand arm"],
              framing: "TOP_DOWN",
              status: "PLANNED",
              order: 2,
            },
          ],
          tags: ["skincare", "macro", "tabletop"],
          templateId: tplEcom.id,
          projectId: projSkincare.id,
          createdById: manager.id,
        },
      });

      const briefEyewear = await tx.creativeBrief.create({
        data: {
          id: "demo-brief-eyewear",
          title: "Aether Titanium — Specular Control Brief",
          summary:
            "Cross-polarized studio lighting workflow for ultra-thin brushed titanium frames.",
          status: BriefStatus.CHANGES_REQUESTED,
          isPrimary: true,
          version: 1,
          deliverables: "18 SKU angles + 6 campaign portrait selects.",
          guidelines: "Keep polarized filter aligned to eliminate green AR coating cast on demo lenses.",
          shotList: [
            {
              id: "eye-s1",
              title: "Bridge hinge macro",
              description: "Focus-stacked 8-shot plate of micro-screw detail.",
              props: ["Focus rail", "Cross-polarizer"],
              framing: "EXTREME_CLOSE_UP",
              status: "PLANNED",
              order: 0,
            },
          ],
          tags: ["eyewear", "titanium", "polarized"],
          templateId: tplEcom.id,
          projectId: projEyewear.id,
          createdById: manager.id,
        },
      });

      await tx.creativeBrief.create({
        data: {
          id: "demo-brief-holiday",
          title: "Holiday Capsule — Final Archive Brief",
          summary: "Approved final production brief for the delivered Maison Laurent Holiday Capsule.",
          status: BriefStatus.COMPLETED,
          isPrimary: true,
          version: 3,
          deliverables: "40 final retouched TIFFs + window display banners.",
          guidelines: "Delivered and archived for client reference.",
          tags: ["holiday", "archive"],
          projectId: projHoliday.id,
          createdById: manager.id,
        },
      });

      await tx.briefSignOff.createMany({
        data: [
          {
            briefId: briefCashmere.id,
            userId: worker1.id,
            version: 2,
            status: SignOffStatus.SIGNED,
            signedAt: daysOffset(-10),
            note: "Stage A lighting ratios tested and locked.",
          },
          {
            briefId: briefCashmere.id,
            userId: worker2.id,
            version: 2,
            status: SignOffStatus.SIGNED,
            signedAt: daysOffset(-9),
            note: "Capture One ICC profile loaded in retouch suite.",
          },
          {
            briefId: briefCashmere.id,
            userId: worker3.id,
            version: 2,
            status: SignOffStatus.WAIVED,
            waivedById: manager.id,
            waivedAt: daysOffset(-9),
            waiveReason: "Covered by lead photographer lighting diagram.",
          },
          {
            briefId: briefSkincare.id,
            userId: worker1.id,
            version: 1,
            status: SignOffStatus.PENDING,
          },
          {
            briefId: briefSkincare.id,
            userId: worker3.id,
            version: 1,
            status: SignOffStatus.SIGNED,
            signedAt: daysOffset(-2),
            note: "Travertine slabs prepped and gel frames cut.",
          },
          {
            briefId: briefEyewear.id,
            userId: worker1.id,
            version: 1,
            status: SignOffStatus.PENDING,
          },
        ],
      });

      const q1 = await tx.briefQuestion.create({
        data: {
          id: "demo-bq-1",
          briefId: briefCashmere.id,
          authorId: worker1.id,
          briefVersion: 2,
          content: "Should the brushed alpaca scarf macro stay on the warm alabaster seamless or switch to raw linen?",
          isResolved: true,
          isBlocker: false,
          createdAt: daysOffset(-7),
        },
      });
      await tx.briefQuestion.create({
        data: {
          id: "demo-bq-1-reply",
          briefId: briefCashmere.id,
          authorId: manager.id,
          briefVersion: 2,
          content: "Stay on the warm alabaster seamless so the PDP grid remains visually uniform.",
          parentId: q1.id,
          isResolved: true,
          createdAt: daysOffset(-7, 14),
        },
      });
      await tx.briefQuestion.create({
        data: {
          id: "demo-bq-2",
          briefId: briefEyewear.id,
          authorId: worker1.id,
          briefVersion: 1,
          content: "Do we have the anti-reflective demo lenses from Aether yet, or are we shooting with stock lenses?",
          isResolved: false,
          isBlocker: true,
          createdAt: daysOffset(-1),
        },
      });

      // 10. Tasks across 4 months + current + upcoming (populates 6-month charts, KPIs, and worker/client views)
      const tasksData = [
        // Historical completed tasks (for rich 6-month trend & turnaround charts)
        {
          id: "demo-task-hist-1",
          title: "Holiday Capsule — Velvet Gown Hero Set",
          description: "Full-length studio set on Stage A with tungsten Fresnel key.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.HIGH,
          projectId: projHoliday.id,
          serviceId: svcEditorial.id,
          spec: Specialization.PHOTOGRAPHY,
          workerId: worker1.id,
          startedAt: monthsAgoDay(3, 5, 9),
          dueAt: monthsAgoDay(3, 12, 18),
          completedAt: monthsAgoDay(3, 10, 16),
          workDate: monthsAgoDay(3, 8, 10),
          rating: 5,
          ratingText: "Crisp lighting and zero skin-tone shift across the entire lookbook.",
        },
        {
          id: "demo-task-hist-2",
          title: "Holiday Capsule — Print Color Separation",
          description: "CMYK Fogra39 proofing and final retouch pass on 18 spreads.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.MEDIUM,
          projectId: projHoliday.id,
          serviceId: svcRetouch.id,
          spec: Specialization.GRAPHIC_DESIGN,
          workerId: worker2.id,
          startedAt: monthsAgoDay(3, 14, 9),
          dueAt: monthsAgoDay(3, 21, 18),
          completedAt: monthsAgoDay(3, 19, 17),
          workDate: monthsAgoDay(3, 17, 10),
          rating: 5,
          ratingText: "Matched our physical silk swatch samples on the first proof.",
        },
        {
          id: "demo-task-hist-3",
          title: "Chronograph Dial — 60-Frame Focus Stack",
          description: "1:1 macro bezel and sapphire reflection control.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.HIGH,
          projectId: projChronograph.id,
          serviceId: svcEcom.id,
          spec: Specialization.PHOTOGRAPHY,
          workerId: worker1.id,
          startedAt: monthsAgoDay(2, 4, 10),
          dueAt: monthsAgoDay(2, 11, 18),
          completedAt: monthsAgoDay(2, 10, 15),
          workDate: monthsAgoDay(2, 7, 10),
          rating: 5,
          ratingText: "Every gear tooth inside the skeleton dial is tack-sharp.",
        },
        {
          id: "demo-task-hist-4",
          title: "Chronograph — Brushed Steel Dust Cleanup",
          description: "Micro-scratch removal and specular balancing on titanium clasp.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.MEDIUM,
          projectId: projChronograph.id,
          serviceId: svcRetouch.id,
          spec: Specialization.GRAPHIC_DESIGN,
          workerId: worker2.id,
          startedAt: monthsAgoDay(2, 12, 9),
          dueAt: monthsAgoDay(2, 18, 18),
          completedAt: monthsAgoDay(2, 20, 16), // intentionally slightly late for realistic on-time %
          workDate: monthsAgoDay(2, 15, 10),
          rating: 4,
          ratingText: "Great polish; minor delay on the rose-gold SKU.",
        },
        {
          id: "demo-task-hist-5",
          title: "Holiday Capsule — 15s Flagship Reels",
          description: "Vertical 9:16 motion teaser cuts for Instagram & flagship LED walls.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.HIGH,
          projectId: projHoliday.id,
          serviceId: svcMotion.id,
          spec: Specialization.VIDEOGRAPHY,
          workerId: worker1.id,
          startedAt: monthsAgoDay(1, 3, 9),
          dueAt: monthsAgoDay(1, 10, 18),
          completedAt: monthsAgoDay(1, 8, 15),
          workDate: monthsAgoDay(1, 6, 10),
          rating: 5,
          ratingText: "Motion pacing elevated our entire holiday launch.",
        },
        {
          id: "demo-task-hist-6",
          title: "Cashmere Lookbook — Lighting Pre-Light Test",
          description: "Dialed in 8x8 bleached muslin diffusion + warm bounce ratios.",
          type: TaskType.DAILY_ENTRY,
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.MEDIUM,
          projectId: projCashmere.id,
          serviceId: svcEditorial.id,
          spec: Specialization.PHOTOGRAPHY,
          workerId: worker1.id,
          startedAt: monthsAgoDay(1, 14, 9),
          dueAt: monthsAgoDay(1, 16, 18),
          completedAt: monthsAgoDay(1, 15, 17),
          workDate: monthsAgoDay(1, 15, 10),
        },
        {
          id: "demo-task-hist-7",
          title: "Aether Titanium — Optical Frame Prep & Rigging",
          description: "3D-printed invisible bridge supports and polarized scrim setup.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.LOW,
          projectId: projEyewear.id,
          serviceId: svcEcom.id,
          spec: Specialization.CONTENT_CREATION,
          workerId: worker3.id,
          startedAt: monthsAgoDay(1, 18, 9),
          dueAt: monthsAgoDay(1, 24, 18),
          completedAt: monthsAgoDay(1, 22, 16),
          workDate: monthsAgoDay(1, 20, 10),
        },
        // Current month active & review tasks
        {
          id: "demo-task-cur-1",
          title: "Cashmere Lookbook — Looks 01–12 Tethered Shoot",
          description: "Shoot morning block on Stage A with live client monitor review.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.HIGH,
          projectId: projCashmere.id,
          serviceId: svcEditorial.id,
          spec: Specialization.PHOTOGRAPHY,
          workerId: worker1.id,
          startedAt: daysOffset(-9, 9),
          dueAt: daysOffset(-6, 18),
          completedAt: daysOffset(-7, 17),
          workDate: daysOffset(-8, 10),
          rating: 5,
          ratingText: "The oatmeal wrap coat frames are extraordinary.",
        },
        {
          id: "demo-task-cur-2",
          title: "Cashmere Lookbook — Looks 13–24 Detail & Draped Sets",
          description: "Finish remaining 12 knitwear looks + macro texture plates.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.IN_REVIEW,
          priority: TaskPriority.HIGH,
          projectId: projCashmere.id,
          serviceId: svcEditorial.id,
          spec: Specialization.PHOTOGRAPHY,
          workerId: worker1.id,
          startedAt: daysOffset(-3, 9),
          dueAt: daysOffset(2, 18),
          workDate: daysOffset(-1, 10),
        },
        {
          id: "demo-task-cur-3",
          title: "Solstice Serum — Amber Glass Droplet Macro",
          description: "High-speed strobe freeze of botanical oil drop on travertine plinth.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          projectId: projSkincare.id,
          serviceId: svcEcom.id,
          spec: Specialization.PHOTOGRAPHY,
          workerId: worker1.id,
          startedAt: daysOffset(-1, 9),
          dueAt: daysOffset(3, 18),
          workDate: daysOffset(0, 10),
        },
        {
          id: "demo-task-cur-4",
          title: "Solstice Serum — Color Grading & Glass Cleanup",
          description: "Remove micro-dust on dropper neck and balance amber refraction.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          projectId: projSkincare.id,
          serviceId: svcRetouch.id,
          spec: Specialization.GRAPHIC_DESIGN,
          workerId: worker2.id,
          dueAt: daysOffset(4, 18),
        },
        {
          id: "demo-task-cur-5",
          title: "Aether Titanium — On-Model Architectural Portraits",
          description: "Capture 6 directional studio portraits with crisp rim lighting.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          projectId: projEyewear.id,
          serviceId: svcEditorial.id,
          spec: Specialization.PHOTOGRAPHY,
          workerId: worker1.id,
          dueAt: daysOffset(6, 18),
        },
        {
          id: "demo-task-cur-6",
          title: "Cashmere Campaign — 15s Vertical Loom Reel",
          description: "Edit slow-motion cashmere movement selects with subtle film grain.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.MEDIUM,
          projectId: projCashmere.id,
          serviceId: svcMotion.id,
          spec: Specialization.VIDEOGRAPHY,
          workerId: worker1.id,
          startedAt: daysOffset(-2, 10),
          dueAt: daysOffset(5, 18),
        },
        {
          id: "demo-task-cur-7",
          title: "Stage B Softbox & Grip Calibration",
          description: "Verify Profoto head color temperature consistency before Solstice shoot.",
          type: TaskType.DAILY_ENTRY,
          status: TaskStatus.IN_REVIEW,
          priority: TaskPriority.LOW,
          projectId: projSkincare.id,
          serviceId: svcEcom.id,
          spec: Specialization.CONTENT_CREATION,
          workerId: worker3.id,
          startedAt: daysOffset(-1, 8),
          dueAt: daysOffset(1, 17),
          workDate: daysOffset(-1, 10),
        },
        {
          id: "demo-task-cur-8",
          title: "Aether Eyewear — Hinge Macro Retouch Pass",
          description: "Clean brushed titanium micro-reflection per client revision request.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.TO_EDIT,
          priority: TaskPriority.HIGH,
          projectId: projEyewear.id,
          serviceId: svcRetouch.id,
          spec: Specialization.GRAPHIC_DESIGN,
          workerId: worker2.id,
          startedAt: daysOffset(-4, 9),
          dueAt: daysOffset(2, 18),
        },
        {
          id: "demo-task-cur-9",
          title: "Daily Shoot Log — Cashmere Lookbook Day 2",
          description: "Shot Looks 13–19 tethered to Capture One; backup verified on NAS.",
          type: TaskType.DAILY_ENTRY,
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.MEDIUM,
          projectId: projCashmere.id,
          serviceId: svcEditorial.id,
          spec: Specialization.PHOTOGRAPHY,
          workerId: worker1.id,
          startedAt: daysOffset(-2, 9),
          dueAt: daysOffset(-2, 18),
          completedAt: daysOffset(-2, 17),
          workDate: daysOffset(-2, 10),
        },
        {
          id: "demo-task-cur-10",
          title: "Solstice Botanicals — Travertine Plinth Prep",
          description: "Steamed botanical props and leveled acrylic riser stage.",
          type: TaskType.DAILY_ENTRY,
          status: TaskStatus.PENDING,
          priority: TaskPriority.LOW,
          projectId: projSkincare.id,
          serviceId: svcEcom.id,
          spec: Specialization.CONTENT_CREATION,
          workerId: worker1.id,
          workDate: daysOffset(0, 9),
          dueAt: daysOffset(1, 17),
        },
        // Soft-deleted tasks (for /manager/deleted-tasks)
        {
          id: "demo-task-del-1",
          title: "Duplicate Packshot Export — Archive Draft",
          description: "Superseded by consolidated TIFF batch.",
          type: TaskType.ASSIGNED,
          status: TaskStatus.TODO,
          priority: TaskPriority.LOW,
          projectId: projEyewear.id,
          serviceId: svcEcom.id,
          spec: Specialization.PHOTOGRAPHY,
          workerId: worker3.id,
          dueAt: daysOffset(8, 18),
          deletedAt: daysOffset(-2),
        },
        {
          id: "demo-task-del-2",
          title: "Test Background Swatch Calibration",
          description: "Internal test ticket removed after calibration.",
          type: TaskType.DAILY_ENTRY,
          status: TaskStatus.TODO,
          priority: TaskPriority.LOW,
          projectId: projCashmere.id,
          serviceId: svcRetouch.id,
          spec: Specialization.GRAPHIC_DESIGN,
          workerId: worker2.id,
          deletedAt: daysOffset(-4),
        },
      ];

      for (const item of tasksData) {
        const assigneeStatus = item.status === TaskStatus.PENDING ? TaskStatus.TODO : item.status;
        await tx.task.create({
          data: {
            id: item.id,
            title: item.title,
            description: item.description,
            type: item.type,
            status: item.status,
            priority: item.priority,
            startAt: item.startedAt ?? null,
            dueAt: item.dueAt ?? null,
            startedAt: item.startedAt ?? null,
            completedAt: item.completedAt ?? null,
            workDate: item.type === TaskType.DAILY_ENTRY ? (item.workDate ?? daysOffset(0)) : null,
            deletedAt: item.deletedAt ?? null,
            createdAt: item.startedAt ?? daysOffset(-3),
            projectId: item.projectId,
            createdById: item.type === TaskType.DAILY_ENTRY ? item.workerId : manager.id,
            assignees: {
              create: {
                userId: item.workerId,
                status: assigneeStatus,
                submittedAt:
                  item.status === TaskStatus.IN_REVIEW || item.status === TaskStatus.COMPLETED
                    ? item.completedAt ?? daysOffset(-1)
                    : null,
              },
            },
            services: {
              create: {
                serviceId: item.serviceId,
              },
            },
            specializations: {
              create: {
                specialization: item.spec,
              },
            },
          },
        });

        if (item.rating) {
          const projectClientId =
            item.projectId === projEyewear.id || item.projectId === projChronograph.id
              ? client2.id
              : client1.id;
          await tx.rating.create({
            data: {
              score: item.rating,
              feedback: item.ratingText,
              clientId: projectClientId,
              projectId: item.projectId,
              taskId: item.id,
              createdAt: item.completedAt ?? daysOffset(-1),
            },
          });
        }
      }

      // 11. Task Revisions & Comments
      await tx.taskRevision.createMany({
        data: [
          {
            taskId: "demo-task-cur-8",
            cause: EditCause.DELIVERY_QUALITY_ISSUE,
            description: "Soften glare along the upper bridge titanium bevel at 200% zoom.",
            requestedById: manager.id,
            createdAt: daysOffset(-1),
          },
          {
            taskId: "demo-task-hist-4",
            cause: EditCause.REQUIREMENT_ADJUSTMENT,
            description: "Client requested slightly warmer brushed-gold highlight curve.",
            requestedById: manager.id,
            resolvedAt: monthsAgoDay(2, 19, 14),
            createdAt: monthsAgoDay(2, 18, 11),
          },
        ],
      });

      await tx.comment.createMany({
        data: [
          {
            body: "Tethered selects uploaded to Capture One Live — ready for Elena's review.",
            visibility: CommentVisibility.INTERNAL,
            authorId: worker1.id,
            projectId: projCashmere.id,
            taskId: "demo-task-cur-2",
            createdAt: daysOffset(-1, 15),
          },
          {
            body: "Warm alabaster backdrop balance looks great across Looks 01–12!",
            visibility: CommentVisibility.CLIENT_VISIBLE,
            authorId: client1.id,
            projectId: projCashmere.id,
            taskId: "demo-task-cur-1",
            createdAt: daysOffset(-6, 12),
          },
        ],
      });

      // 12. Schedule Events around today
      const scheduleDefs = [
        {
          id: "demo-ev-1",
          title: "Autumn Cashmere — Final Looks Shoot",
          description: "Morning cyclorama session for Looks 20–24 + macro fiber plates.",
          eventType: ScheduleEventType.SHOOT,
          startAt: daysOffset(0, 9, 30),
          endAt: daysOffset(0, 14, 0),
          location: "Stage A · Cyclorama",
          projectId: projCashmere.id,
          assigneeIds: [worker1.id, worker3.id],
        },
        {
          id: "demo-ev-2",
          title: "Solstice Serum — Client Art Review",
          description: "Live remote review of droplet macro selects with Sophia Laurent.",
          eventType: ScheduleEventType.CLIENT_MEETING,
          startAt: daysOffset(0, 15, 30),
          endAt: daysOffset(0, 16, 30),
          location: "Client Viewing Lounge",
          projectId: projSkincare.id,
          assigneeIds: [worker1.id],
        },
        {
          id: "demo-ev-3",
          title: "Solstice Botanicals — Macro Tabletop Shoot",
          description: "High-speed flash freeze setup on travertine plinths.",
          eventType: ScheduleEventType.SHOOT,
          startAt: daysOffset(1, 10, 0),
          endAt: daysOffset(1, 16, 0),
          location: "Stage B · Tabletop",
          projectId: projSkincare.id,
          assigneeIds: [worker1.id, worker3.id],
        },
        {
          id: "demo-ev-4",
          title: "Stage A Cyclorama Repaint & Sweep",
          description: "Fresh warm-white floor coat prior to Aether portrait session.",
          eventType: ScheduleEventType.MAINTENANCE,
          startAt: daysOffset(2, 8, 0),
          endAt: daysOffset(2, 11, 0),
          location: "Stage A · Cyclorama",
          projectId: null,
          assigneeIds: [worker3.id],
        },
        {
          id: "demo-ev-5",
          title: "Aether Titanium — On-Model Portrait Block",
          description: "Editorial portraits featuring brushed titanium frames.",
          eventType: ScheduleEventType.SHOOT,
          startAt: daysOffset(3, 9, 0),
          endAt: daysOffset(3, 17, 0),
          location: "Stage A · Cyclorama",
          projectId: projEyewear.id,
          assigneeIds: [worker1.id, worker2.id],
        },
        {
          id: "demo-ev-6",
          title: "Cashmere Lookbook — Master Delivery Cutoff",
          description: "Final 16-bit TIFF export and client portal upload.",
          eventType: ScheduleEventType.DEADLINE,
          startAt: daysOffset(4, 17, 0),
          endAt: daysOffset(4, 18, 0),
          location: "Color & Retouch Suite",
          projectId: projCashmere.id,
          assigneeIds: [worker2.id],
        },
        {
          id: "demo-ev-7",
          title: "Natural Light Loft — Full-Day Hold",
          description: "Reserved daylight studio bay for upcoming Maison Laurent Spring preview.",
          eventType: ScheduleEventType.STUDIO_BOOKING,
          startAt: daysOffset(-2, 9, 0),
          endAt: daysOffset(-2, 18, 0),
          location: "Daylight Loft",
          projectId: projCashmere.id,
          assigneeIds: [worker1.id],
        },
      ];

      for (const ev of scheduleDefs) {
        await tx.scheduleEvent.create({
          data: {
            id: ev.id,
            title: ev.title,
            description: ev.description,
            eventType: ev.eventType,
            startAt: ev.startAt,
            endAt: ev.endAt,
            location: ev.location,
            projectId: ev.projectId,
            studioId: DEMO_STUDIO_ID,
            createdById: manager.id,
            assignees: {
              connect: ev.assigneeIds.map((id) => ({ id })),
            },
          },
        });
      }

      // 13. Inventory Items, Loans, Maintenance & Activity Logs
      const invHasselblad = await tx.inventoryItem.create({
        data: {
          id: "demo-inv-1",
          assetTag: "LUM-0001",
          studioId: DEMO_STUDIO_ID,
          name: "Hasselblad X2D 100C Medium Format",
          category: "Cameras",
          model: "X2D 100C",
          serialNumber: "DEMO-HB-100C-01",
          status: InventoryStatus.IN_USE,
          condition: InventoryCondition.EXCELLENT,
          location: "Stage A · Bay 1",
          purchaseDate: daysOffset(-240),
          notes: "Paired with CFexpress 1TB & TetherPro USB-C.",
        },
      });
      const invProfoto = await tx.inventoryItem.create({
        data: {
          id: "demo-inv-2",
          assetTag: "LUM-0002",
          studioId: DEMO_STUDIO_ID,
          name: "Profoto Pro-11 2400Ws Pack",
          category: "Lighting",
          model: "Pro-11 2400",
          serialNumber: "DEMO-PF-2400-02",
          status: InventoryStatus.IN_USE,
          condition: InventoryCondition.EXCELLENT,
          location: "Stage B · Tabletop",
          purchaseDate: daysOffset(-180),
          notes: "High-speed freeze mode ready for liquid macro.",
        },
      });
      const invMacroLens = await tx.inventoryItem.create({
        data: {
          id: "demo-inv-3",
          assetTag: "LUM-0003",
          studioId: DEMO_STUDIO_ID,
          name: "Hasselblad XCD 90mm f/2.5V",
          category: "Lenses",
          model: "XCD 2,5/90V",
          serialNumber: "DEMO-XCD-90V-03",
          status: InventoryStatus.AVAILABLE,
          condition: InventoryCondition.EXCELLENT,
          location: "Gear Vault · Shelf B2",
          purchaseDate: daysOffset(-200),
        },
      });
      const invSony = await tx.inventoryItem.create({
        data: {
          id: "demo-inv-4",
          assetTag: "LUM-0004",
          studioId: DEMO_STUDIO_ID,
          name: "Sony FX3 Cinema Line Body",
          category: "Cameras",
          model: "ILME-FX3",
          serialNumber: "DEMO-FX3-04",
          status: InventoryStatus.AVAILABLE,
          condition: InventoryCondition.GOOD,
          location: "Gear Vault · Shelf A1",
          purchaseDate: daysOffset(-310),
        },
      });
      const invEizo = await tx.inventoryItem.create({
        data: {
          id: "demo-inv-5",
          assetTag: "LUM-0005",
          studioId: DEMO_STUDIO_ID,
          name: "Eizo ColorEdge CG2700X Reference Monitor",
          category: "Workstations",
          model: "CG2700X 27\" 4K",
          serialNumber: "DEMO-EIZO-05",
          status: InventoryStatus.IN_USE,
          condition: InventoryCondition.EXCELLENT,
          location: "Color & Retouch Suite",
          purchaseDate: daysOffset(-150),
        },
      });
      const invStrobeMaint = await tx.inventoryItem.create({
        data: {
          id: "demo-inv-6",
          assetTag: "LUM-0006",
          studioId: DEMO_STUDIO_ID,
          name: "Broncolor Scoro 3200 S Pack",
          category: "Lighting",
          model: "Scoro 3200 S",
          serialNumber: "DEMO-BC-3200-06",
          status: InventoryStatus.MAINTENANCE,
          condition: InventoryCondition.NEEDS_ATTENTION,
          location: "Service Bench",
          purchaseDate: daysOffset(-600),
          notes: "Flash tube B flickering above 1600Ws; awaiting replacement dome.",
        },
      });
      await tx.inventoryItem.createMany({
        data: [
          {
            id: "demo-inv-7",
            assetTag: "LUM-0007",
            studioId: DEMO_STUDIO_ID,
            name: "Profoto ProHead Plus + Zoom Reflector",
            category: "Lighting",
            model: "ProHead Plus",
            serialNumber: "DEMO-PH-07",
            status: InventoryStatus.AVAILABLE,
            condition: InventoryCondition.GOOD,
            location: "Gear Vault · Bay C",
          },
          {
            id: "demo-inv-8",
            assetTag: "LUM-0008",
            studioId: DEMO_STUDIO_ID,
            name: "Matthews 40\" C-Stand Kit (Set of 4)",
            category: "Grip & Rigging",
            model: "Hollywood C-Stand",
            serialNumber: "DEMO-CS-08",
            status: InventoryStatus.AVAILABLE,
            condition: InventoryCondition.GOOD,
            location: "Stage A Grip Cart",
          },
          {
            id: "demo-inv-9",
            assetTag: "LUM-0009",
            studioId: DEMO_STUDIO_ID,
            name: "Canon EF 100mm f/2.8L Macro IS (Legacy)",
            category: "Lenses",
            model: "EF 100mm f/2.8L",
            serialNumber: "DEMO-EF100-09",
            status: InventoryStatus.RETIRED,
            condition: InventoryCondition.FAIR,
            location: "Archive Cabinet",
          },
        ],
      });

      await tx.inventoryLoan.createMany({
        data: [
          {
            id: "demo-loan-1",
            itemId: invHasselblad.id,
            borrowerId: worker1.id,
            checkedOutAt: daysOffset(-2, 9),
            expectedReturnAt: daysOffset(2, 18),
            checkoutNotes: "Stage A Autumn Cashmere Looks 13–24.",
            status: LoanStatus.ACTIVE,
          },
          {
            id: "demo-loan-2",
            itemId: invProfoto.id,
            borrowerId: worker3.id,
            checkedOutAt: daysOffset(-1, 10),
            expectedReturnAt: daysOffset(1, 18),
            checkoutNotes: "Solstice Serum droplet freeze calibration.",
            status: LoanStatus.ACTIVE,
          },
          {
            id: "demo-loan-3",
            itemId: invEizo.id,
            borrowerId: worker2.id,
            checkedOutAt: daysOffset(-5, 9),
            expectedReturnAt: daysOffset(-1, 18), // intentionally overdue to highlight overdue badge
            checkoutNotes: "Cashmere lookbook soft-proofing.",
            status: LoanStatus.ACTIVE,
          },
          {
            id: "demo-loan-4",
            itemId: invMacroLens.id,
            borrowerId: worker1.id,
            checkedOutAt: daysOffset(-12, 9),
            expectedReturnAt: daysOffset(-9, 18),
            returnedAt: daysOffset(-9, 17),
            returnCondition: InventoryCondition.EXCELLENT,
            returnNotes: "Glass inspected & cleaned.",
            status: LoanStatus.RETURNED,
          },
        ],
      });

      await tx.inventoryMaintenanceLog.create({
        data: {
          id: "demo-maint-1",
          itemId: invStrobeMaint.id,
          reportedById: worker3.id,
          title: "Channel B color temperature drift & dome hairline crack",
          description: "Observed +350K shift at power level 8.5 during test pops.",
          status: MaintenanceStatus.IN_PROGRESS,
          startedAt: daysOffset(-3),
        },
      });

      await tx.inventoryActivityLog.createMany({
        data: [
          {
            itemId: invHasselblad.id,
            actorId: worker1.id,
            actorLabel: worker1.name,
            action: InventoryActivityAction.ITEM_CHECKED_OUT,
            details: { note: "Checked out for Stage A Autumn Cashmere shoot." },
            createdAt: daysOffset(-2, 9),
          },
          {
            itemId: invStrobeMaint.id,
            actorId: worker3.id,
            actorLabel: worker3.name,
            action: InventoryActivityAction.MAINTENANCE_REPORTED,
            details: { title: "Channel B color temperature drift" },
            createdAt: daysOffset(-3, 14),
          },
          {
            itemId: invSony.id,
            actorId: manager.id,
            actorLabel: manager.name,
            action: InventoryActivityAction.ITEM_CREATED,
            details: { assetTag: "LUM-0004" },
            createdAt: daysOffset(-14, 11),
          },
        ],
      });

      // 14. Brand Assets
      await tx.brandAsset.createMany({
        data: [
          {
            id: "demo-ba-1",
            title: "Maison Laurent — Autumn 2026 Palette",
            description: "Approved seasonal color tokens for seamless backdrops, lookbooks, and digital banners.",
            assetType: BrandAssetType.COLOR_PALETTE,
            colorPalette: [
              { name: "Alabaster Seamless", hex: "#EDEAE4" },
              { name: "Oatmeal Cashmere", hex: "#C8B8A6" },
              { name: "Espresso Suede", hex: "#3A2D28" },
              { name: "Warm Charcoal", hex: "#1F1E1C" },
            ],
            tags: ["maison-laurent", "palette", "autumn-26"],
            clientId: client1.id,
            projectId: projCashmere.id,
            studioId: DEMO_STUDIO_ID,
            createdById: manager.id,
          },
          {
            id: "demo-ba-2",
            title: "Solstice Botanicals — Packaging & Glass Palette",
            description: "Refraction & travertine surface tones for Solstice serum campaign.",
            assetType: BrandAssetType.COLOR_PALETTE,
            colorPalette: [
              { name: "Botanical Amber", hex: "#B86B2B" },
              { name: "Honed Travertine", hex: "#E5DDD0" },
              { name: "Sage Leaf", hex: "#7A8B74" },
            ],
            tags: ["solstice", "skincare", "palette"],
            clientId: client1.id,
            projectId: projSkincare.id,
            studioId: DEMO_STUDIO_ID,
            createdById: manager.id,
          },
          {
            id: "demo-ba-3",
            title: "Studio Lumière — Master Watermark & Slate",
            description: "Monochrome slate badge and export metadata template for client proof sheets.",
            assetType: BrandAssetType.LOGO,
            externalUrl: "https://example.com/studio-lumiere-brand-kit",
            tags: ["studio", "logo", "proofs"],
            studioId: DEMO_STUDIO_ID,
            createdById: manager.id,
          },
          {
            id: "demo-ba-4",
            title: "Aether Eyewear — Typography & Spec Sheet",
            description: "Swiss grotesk headline pairings and millimeter grid rules for optical catalog.",
            assetType: BrandAssetType.TYPOGRAPHY,
            externalUrl: "https://example.com/aether-type-spec",
            tags: ["aether", "typography", "eyewear"],
            clientId: client2.id,
            projectId: projEyewear.id,
            studioId: DEMO_STUDIO_ID,
            createdById: manager.id,
          },
          {
            id: "demo-ba-5",
            title: "Maison Laurent — 2026 Print Retouching Guidelines",
            description: "Skin texture preservation, grain tolerances, and Fogra39 export checklist.",
            assetType: BrandAssetType.GUIDELINE,
            externalUrl: "https://example.com/laurent-retouch-guide",
            tags: ["retouching", "guidelines", "print"],
            clientId: client1.id,
            studioId: DEMO_STUDIO_ID,
            createdById: manager.id,
          },
        ],
      });

      // 15. Work Requests
      await tx.workRequest.createMany({
        data: [
          {
            id: "demo-wr-1",
            type: WorkRequestType.WORK,
            title: "Add 4 flat-lay gift box angles for Solstice Serum",
            details:
              "Retail partners asked for overhead gift-box configurations with ribbon detail before Friday's press deck.",
            requestedDueAt: daysOffset(5),
            status: WorkRequestStatus.SUBMITTED,
            clientId: client1.id,
            managerId: manager.id,
            studioId: DEMO_STUDIO_ID,
            projectId: projSkincare.id,
            createdAt: daysOffset(-1),
          },
          {
            id: "demo-wr-2",
            type: WorkRequestType.PROJECT,
            title: "Resort 2027 Linen & Resortwear Preview",
            details:
              "Planning a 2-day daylight loft shoot in late next month for 18 resortwear silhouettes.",
            requestedDueAt: daysOffset(30),
            status: WorkRequestStatus.NEEDS_INFO,
            managerNote: "Please confirm whether we are casting 1 or 2 models so I can hold the loft dates.",
            reviewedAt: daysOffset(-2),
            clientId: client1.id,
            managerId: manager.id,
            studioId: DEMO_STUDIO_ID,
            createdAt: daysOffset(-4),
          },
          {
            id: "demo-wr-3",
            type: WorkRequestType.WORK,
            title: "15s Vertical Cashmere Loom Teaser",
            details: "Need a 9:16 motion loop cropped from Stage A selects for our Paris flagship.",
            requestedDueAt: daysOffset(5),
            status: WorkRequestStatus.IN_PROGRESS,
            managerNote: "Assigned to Marcus — editing selects now.",
            reviewedAt: daysOffset(-3),
            clientId: client1.id,
            managerId: manager.id,
            studioId: DEMO_STUDIO_ID,
            projectId: projCashmere.id,
            createdTaskId: "demo-task-cur-6",
            createdAt: daysOffset(-5),
          },
          {
            id: "demo-wr-4",
            type: WorkRequestType.WORK,
            title: "Brushed Titanium Hinge Macro Pass",
            details: "Need crisp 1:1 crop of the signature screwless hinge for technical brochure.",
            requestedDueAt: daysOffset(4),
            status: WorkRequestStatus.COMPLETED,
            managerNote: "Completed and delivered in the Aether folder.",
            reviewedAt: daysOffset(-6),
            clientId: client2.id,
            managerId: manager.id,
            studioId: DEMO_STUDIO_ID,
            projectId: projEyewear.id,
            createdAt: daysOffset(-10),
          },
        ],
      });

      // 16. Client Feedback
      await tx.clientFeedback.createMany({
        data: [
          {
            id: "demo-fb-1",
            type: FeedbackType.REVISION,
            status: FeedbackStatus.NEW,
            title: "Warm up shadow tones slightly on Look 14",
            details:
              "In the dark espresso cardigan frame, can we lift shadow detail by ~10% so the cable-knit texture reads clearly on mobile?",
            clientId: client1.id,
            projectId: projCashmere.id,
            taskId: "demo-task-cur-2",
            createdAt: daysOffset(-1, 11),
          },
          {
            id: "demo-fb-2",
            type: FeedbackType.REVISION,
            status: FeedbackStatus.ASSIGNED_TO_WORKER,
            title: "Reduce specular highlight on titanium bridge",
            details:
              "There is a small bright hotspot on the left nose-pad arm in Frame 04. Please tone it down before final export.",
            delegationNote: "Marcus — please coordinate with Aria on Frame 04 plate cleanup.",
            delegatedAt: daysOffset(-1, 14),
            clientId: client2.id,
            projectId: projEyewear.id,
            taskId: "demo-task-cur-8",
            assignedWorkerId: worker1.id,
            createdAt: daysOffset(-2, 16),
          },
          {
            id: "demo-fb-3",
            type: FeedbackType.REVIEW,
            status: FeedbackStatus.RESOLVED,
            score: 5,
            title: "Approved Looks 01–12 Hero Selects",
            details:
              "Every single silhouette feels effortless and cohesive. Approved for print and global web rollout.",
            responseNote: "Thank you Sophia! Moving Looks 13–24 into final color pass today.",
            respondedById: manager.id,
            respondedAt: daysOffset(-5, 16),
            clientId: client1.id,
            projectId: projCashmere.id,
            taskId: "demo-task-cur-1",
            createdAt: daysOffset(-6, 10),
          },
          {
            id: "demo-fb-4",
            type: FeedbackType.REVISION,
            status: FeedbackStatus.IN_REVIEW,
            title: "Tighter crop on botanical pipette droplet",
            details:
              "Submitted updated framing note — Marcus uploaded the revised 4:5 crop for manager sign-off.",
            delegationNote: "Please submit a 4:5 macro variation.",
            delegatedAt: daysOffset(-3),
            workerNote: "Uploaded 4:5 macro variation with centered golden droplet.",
            workerSubmittedAt: daysOffset(-1),
            clientId: client1.id,
            projectId: projSkincare.id,
            taskId: "demo-task-cur-3",
            assignedWorkerId: worker1.id,
            createdAt: daysOffset(-4),
          },
        ],
      });

      // 17. Notifications for Manager, Worker, Client
      await tx.notification.createMany({
        data: [
          {
            userId: manager.id,
            actorId: client1.id,
            type: NotificationType.FEEDBACK_RECEIVED,
            category: NotificationCategory.ACTION_REQUIRED,
            title: "New client revision note",
            message: "Sophia Laurent requested a shadow lift on Look 14 in Autumn Cashmere Lookbook.",
            link: "/manager/reviews",
            projectId: projCashmere.id,
            taskId: "demo-task-cur-2",
            emailStatus: NotificationEmailStatus.NOT_REQUESTED,
            read: false,
            createdAt: daysOffset(-1, 11),
          },
          {
            userId: manager.id,
            actorId: worker1.id,
            type: NotificationType.TASK_REVIEW_READY,
            category: NotificationCategory.ACTION_REQUIRED,
            title: "Task ready for review",
            message: "Marcus Chen submitted Looks 13–24 Detail & Draped Sets for approval.",
            link: "/manager/tasks",
            projectId: projCashmere.id,
            taskId: "demo-task-cur-2",
            emailStatus: NotificationEmailStatus.NOT_REQUESTED,
            read: false,
            createdAt: daysOffset(-1, 15),
          },
          {
            userId: worker1.id,
            actorId: manager.id,
            type: NotificationType.REVISION_DELEGATED,
            category: NotificationCategory.ACTION_REQUIRED,
            title: "Revision assigned",
            message: "Elena Vance delegated a specular cleanup note on Aether Titanium Collection.",
            link: "/worker/reviews",
            projectId: projEyewear.id,
            taskId: "demo-task-cur-8",
            emailStatus: NotificationEmailStatus.NOT_REQUESTED,
            read: false,
            createdAt: daysOffset(-1, 14),
          },
          {
            userId: worker1.id,
            actorId: manager.id,
            type: NotificationType.TASK_APPROVED,
            category: NotificationCategory.UPDATE,
            title: "Deliverable approved",
            message: "Looks 01–12 Tethered Shoot was approved with a 5/5 client rating.",
            link: "/worker/tasks",
            projectId: projCashmere.id,
            taskId: "demo-task-cur-1",
            emailStatus: NotificationEmailStatus.NOT_REQUESTED,
            read: true,
            createdAt: daysOffset(-5, 16),
          },
          {
            userId: client1.id,
            actorId: manager.id,
            type: NotificationType.SYSTEM_ALERT,
            category: NotificationCategory.ACTION_REQUIRED,
            title: "Work request needs details",
            message: "Elena Vance asked a follow-up question on Resort 2027 Linen & Resortwear Preview.",
            link: "/client/work-requests",
            emailStatus: NotificationEmailStatus.NOT_REQUESTED,
            read: false,
            createdAt: daysOffset(-2),
          },
          {
            userId: client1.id,
            actorId: manager.id,
            type: NotificationType.FEEDBACK_RESOLVED,
            category: NotificationCategory.UPDATE,
            title: "Feedback marked resolved",
            message: "Elena Vance responded to your approval on Looks 01–12 Hero Selects.",
            link: "/client/project-feedback",
            projectId: projCashmere.id,
            emailStatus: NotificationEmailStatus.NOT_REQUESTED,
            read: true,
            createdAt: daysOffset(-5, 16),
          },
        ],
      });
    },
    { timeout: 30000 },
  );
}
