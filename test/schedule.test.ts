import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  eventFindUnique: vi.fn(),
  eventFindMany: vi.fn(),
  eventCreate: vi.fn(),
  eventUpdate: vi.fn(),
  eventDelete: vi.fn(),
  projectFindUnique: vi.fn(),
  projectFindMany: vi.fn(),
  taskFindMany: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authz", () => ({ requireRole: mocks.requireRole }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scheduleEvent: {
      findUnique: mocks.eventFindUnique,
      findMany: mocks.eventFindMany,
      create: mocks.eventCreate,
      update: mocks.eventUpdate,
      delete: mocks.eventDelete,
    },
    project: {
      findUnique: mocks.projectFindUnique,
      findMany: mocks.projectFindMany,
    },
    task: {
      findMany: mocks.taskFindMany,
    },
    user: {
      findMany: mocks.userFindMany,
    },
  },
}));

import {
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  checkScheduleConflicts,
} from "@/app/actions/schedule";
import {
  getScheduleEvents,
  getScheduleEventById,
  detectScheduleConflicts,
} from "@/lib/schedule";
import {
  ScheduleEventType,
  TaskPriority,
  TaskStatus,
  UserRole,
} from "@/generated/prisma/client";

describe("Schedule and Calendar System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Validation & Date Bounds", () => {
    it("fails validation when endAt is earlier than startAt", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });

      const result = await createScheduleEvent({
        title: "Backwards Event",
        startAt: "2026-11-01T15:00:00Z",
        endAt: "2026-11-01T12:00:00Z",
      });

      expect(result.error).toContain("End time must be equal to or later than start time");
      expect(mocks.eventCreate).not.toHaveBeenCalled();
    });

    it("normalizes all-day event to UTC start and end of day", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });
      mocks.eventFindMany.mockResolvedValue([]); // no conflicts
      mocks.eventCreate.mockImplementation(({ data }) => ({
        id: "ev-allday",
        ...data,
      }));

      const result = await createScheduleEvent({
        title: "All Day Studio Hold",
        eventType: ScheduleEventType.STUDIO_BOOKING,
        startAt: "2026-11-05T00:00:00Z",
        endAt: "2026-11-05T23:59:59Z",
        allDay: true,
      });

      expect(result.success).toContain("scheduled successfully");
      expect(mocks.eventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            allDay: true,
            startAt: new Date(Date.UTC(2026, 10, 5, 0, 0, 0, 0)),
            endAt: new Date(Date.UTC(2026, 10, 5, 23, 59, 59, 999)),
          }),
        })
      );
    });

    it("rejects date queries spanning greater than 62 days", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });

      await expect(
        getScheduleEvents({
          startDate: "2026-01-01T00:00:00Z",
          endDate: "2026-04-01T00:00:00Z", // ~90 days
        })
      ).rejects.toThrow("Date range cannot exceed 62 days");
    });
  });

  describe("Conflict Detection & Warning Rules", () => {
    it("detects location overlap when same studio bay is booked during overlapping times", async () => {
      const existingShoot = {
        id: "ev-1",
        title: "Lookbook Shoot A",
        location: "Main Studio Bay",
        startAt: new Date("2026-11-10T10:00:00Z"),
        endAt: new Date("2026-11-10T14:00:00Z"),
      };

      // Mock finding overlapping event at location
      const mockDb = {
        scheduleEvent: {
          findMany: vi.fn().mockResolvedValue([existingShoot]),
        },
      } as unknown as Parameters<typeof detectScheduleConflicts>[0];

      const warnings = await detectScheduleConflicts(mockDb, {
        startAt: new Date("2026-11-10T12:00:00Z"),
        endAt: new Date("2026-11-10T16:00:00Z"),
        location: "Main Studio Bay",
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        type: "LOCATION",
        conflictingEventId: "ev-1",
        conflictingEventTitle: "Lookbook Shoot A",
        message: expect.stringContaining('Location "Main Studio Bay" is already booked'),
      });
    });

    it("exempts On Location and Remote venues from triggering location conflicts", async () => {
      const mockDb = {
        scheduleEvent: {
          findMany: vi.fn(),
        },
      } as unknown as Parameters<typeof detectScheduleConflicts>[0];

      const warnings = await detectScheduleConflicts(mockDb, {
        startAt: new Date("2026-11-10T12:00:00Z"),
        endAt: new Date("2026-11-10T16:00:00Z"),
        location: "On Location",
      });

      expect(warnings).toHaveLength(0);
      expect(mockDb.scheduleEvent.findMany).not.toHaveBeenCalled();
    });

    it("detects worker overlap when team member is scheduled in concurrent shoots", async () => {
      const existingBooking = {
        id: "ev-2",
        title: "Commercial Video B",
        assignees: [{ id: "worker-1", name: "Sarah Lens", email: "sarah@wophoto.local" }],
      };

      const mockDb = {
        scheduleEvent: {
          findMany: vi.fn().mockResolvedValue([existingBooking]),
        },
      } as unknown as Parameters<typeof detectScheduleConflicts>[0];

      const warnings = await detectScheduleConflicts(mockDb, {
        startAt: new Date("2026-11-12T09:00:00Z"),
        endAt: new Date("2026-11-12T13:00:00Z"),
        assigneeIds: ["worker-1"],
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        type: "WORKER",
        entityName: "Sarah Lens",
        message: expect.stringContaining("Sarah Lens is already scheduled"),
      });
    });

    it("does not report conflict for touching boundary times", async () => {
      // Event ending at 12:00 and new event starting at 12:00
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });
      mocks.eventFindMany.mockResolvedValue([]); // prisma lt and gt will find 0 rows

      const result = await checkScheduleConflicts({
        startAt: "2026-11-10T12:00:00Z",
        endAt: "2026-11-10T15:00:00Z",
        location: "Main Studio Bay",
      });

      expect(result.conflicts).toHaveLength(0);
    });

    it("excludes updating event from self-conflict matching", async () => {
      const mockDb = {
        scheduleEvent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as Parameters<typeof detectScheduleConflicts>[0];

      const warnings = await detectScheduleConflicts(mockDb, {
        startAt: new Date("2026-11-10T10:00:00Z"),
        endAt: new Date("2026-11-10T14:00:00Z"),
        location: "Main Studio Bay",
        excludeEventId: "ev-self",
      });

      expect(warnings).toHaveLength(0);
      expect(mockDb.scheduleEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: "ev-self" },
          }),
        })
      );
    });
  });

  describe("Event Rescheduling & Deletion", () => {
    it("allows manager to update event time and location", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });
      mocks.eventFindUnique.mockResolvedValue({
        id: "ev-edit",
        title: "Product Shoot",
        startAt: new Date("2026-11-20T10:00:00Z"),
        endAt: new Date("2026-11-20T14:00:00Z"),
        allDay: false,
        location: "Main Studio Bay",
        assignees: [],
      });
      mocks.eventFindMany.mockResolvedValue([]); // no conflicts
      mocks.eventUpdate.mockResolvedValue({
        id: "ev-edit",
        title: "Product Shoot (Rescheduled)",
        startAt: new Date("2026-11-21T10:00:00Z"),
        endAt: new Date("2026-11-21T14:00:00Z"),
      });

      const result = await updateScheduleEvent({
        id: "ev-edit",
        title: "Product Shoot (Rescheduled)",
        startAt: "2026-11-21T10:00:00Z",
        endAt: "2026-11-21T14:00:00Z",
        location: "Cyc Wall / Studio B",
      });

      expect(result.success).toContain("updated successfully");
      expect(mocks.eventUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ev-edit" },
          data: expect.objectContaining({
            title: "Product Shoot (Rescheduled)",
            location: "Cyc Wall / Studio B",
          }),
        })
      );
    });

    it("allows manager to delete a schedule event", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });
      mocks.eventFindUnique.mockResolvedValue({
        id: "ev-del",
        title: "Cancelled Shoot",
      });
      mocks.eventDelete.mockResolvedValue({ id: "ev-del" });

      const result = await deleteScheduleEvent({ id: "ev-del" });

      expect(result.success).toContain('Event "Cancelled Shoot" deleted successfully');
      expect(mocks.eventDelete).toHaveBeenCalledWith({ where: { id: "ev-del" } });
    });
  });

  describe("Unified Query & Task Deadline Merging", () => {
    it("merges active task deadlines with schedule events in date window", async () => {
      mocks.requireRole.mockResolvedValue({ id: "mgr-1", role: UserRole.MANAGER });

      mocks.eventFindMany.mockResolvedValue([
        {
          id: "ev-shoot",
          title: "Nike Campaign Shoot",
          eventType: ScheduleEventType.SHOOT,
          startAt: new Date("2026-11-15T09:00:00Z"),
          endAt: new Date("2026-11-15T17:00:00Z"),
          allDay: false,
          location: "Main Studio Bay",
          project: { id: "p-1", name: "Nike Campaign" },
          createdBy: { id: "mgr-1", name: "Boss", email: "boss@wophoto.local" },
          assignees: [],
        },
      ]);

      mocks.taskFindMany.mockResolvedValue([
        {
          id: "task-1",
          title: "Deliver Color Graded Finals",
          dueAt: new Date("2026-11-15T18:00:00Z"),
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          projectId: "p-1",
          project: { id: "p-1", name: "Nike Campaign" },
          assignees: [{ user: { id: "worker-1", name: "Editor", email: "editor@wophoto.local", image: null } }],
        },
      ]);

      const data = await getScheduleEvents({
        startDate: "2026-11-01T00:00:00Z",
        endDate: "2026-11-30T23:59:59Z",
      });

      expect(data.events).toHaveLength(1);
      expect(data.events[0]?.title).toBe("Nike Campaign Shoot");
      expect(data.taskDeadlines).toHaveLength(1);
      expect(data.taskDeadlines[0]?.title).toBe("Deliver Color Graded Finals");
      expect(data.taskDeadlines[0]?.projectName).toBe("Nike Campaign");
    });
  });

  describe("Worker Read-Only Visibility & Data Isolation", () => {
    it("filters worker view to assigned shoots and studio-wide bay holds", async () => {
      mocks.requireRole.mockResolvedValue({ id: "worker-1", role: UserRole.WORKER });
      mocks.eventFindMany.mockResolvedValue([]);
      mocks.taskFindMany.mockResolvedValue([]);

      await getScheduleEvents({
        startDate: "2026-11-01T00:00:00Z",
        endDate: "2026-11-30T23:59:59Z",
      });

      // Verify Prisma query includes role-scoped OR condition
      expect(mocks.eventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { assignees: { some: { id: "worker-1" } } },
              {
                eventType: {
                  in: [
                    ScheduleEventType.STUDIO_BOOKING,
                    ScheduleEventType.MAINTENANCE,
                  ],
                },
              },
              { assignees: { none: {} } },
            ],
          }),
        })
      );
    });

    it("prevents worker from creating schedule events", async () => {
      mocks.requireRole.mockRejectedValue(new Error("Unauthorized: MANAGER required"));

      const result = await createScheduleEvent({
        title: "Worker Booking",
        startAt: "2026-11-15T09:00:00Z",
        endAt: "2026-11-15T17:00:00Z",
      });

      expect(result.error).toContain("Unauthorized");
      expect(mocks.eventCreate).not.toHaveBeenCalled();
    });

    it("restricts worker single-event inspection if not assigned and not a general booking", async () => {
      mocks.requireRole.mockResolvedValue({ id: "worker-1", role: UserRole.WORKER });

      // Event is a SHOOT assigned to worker-2 exclusively
      mocks.eventFindUnique.mockResolvedValue({
        id: "ev-private",
        title: "Private Client Shoot",
        eventType: ScheduleEventType.SHOOT,
        assignees: [{ id: "worker-2", name: "Worker Two", email: "worker2@wophoto.local", image: null }],
      });

      const event = await getScheduleEventById("ev-private");
      expect(event).toBeNull();
    });
  });

  describe("Client Boundary", () => {
    it("rejects client role from accessing schedule events with unauthorized error", async () => {
      mocks.requireRole.mockRejectedValue(new Error("Unauthorized: MANAGER or WORKER required"));

      await expect(
        getScheduleEvents({
          startDate: "2026-11-01T00:00:00Z",
          endDate: "2026-11-30T23:59:59Z",
        })
      ).rejects.toThrow("Unauthorized");
    });
  });
});
