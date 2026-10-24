import { describe, expect, it } from "vitest";

import { NotificationType, UserRole } from "@/generated/prisma/browser";
import {
  DEFAULT_EMAIL_NOTIFICATION_TYPES,
  getDefaultNotificationChannels,
  ROLE_LANDING_OPTIONS,
  ROLE_NOTIFICATION_PREFERENCES,
} from "@/lib/settings-preferences";
import { userPreferencePatchSchema } from "@/lib/validation/settings";

describe("role based settings preferences", () => {
  it("only offers notification events that exist in the matching role workflow", () => {
    expect(ROLE_NOTIFICATION_PREFERENCES[UserRole.MANAGER].map((item) => item.type)).toEqual([
      NotificationType.FEEDBACK_RECEIVED,
      NotificationType.REVISION_SUBMITTED,
      NotificationType.TASK_REVIEW_READY,
      NotificationType.DEADLINE_APPROACHING,
    ]);
    expect(ROLE_NOTIFICATION_PREFERENCES[UserRole.WORKER].map((item) => item.type)).toContain(
      NotificationType.REVISION_DELEGATED,
    );
    expect(ROLE_NOTIFICATION_PREFERENCES[UserRole.CLIENT].map((item) => item.type)).toEqual([
      NotificationType.FEEDBACK_RESOLVED,
    ]);
  });

  it("keeps existing email defaults while enabling app alerts by default", () => {
    for (const role of Object.values(UserRole)) {
      const defaults = getDefaultNotificationChannels(role);
      for (const item of ROLE_NOTIFICATION_PREFERENCES[role]) {
        expect(defaults[item.type]).toEqual({
          inApp: true,
          email: DEFAULT_EMAIL_NOTIFICATION_TYPES.includes(item.type),
        });
      }
    }
  });

  it("only offers role safe landing pages", () => {
    expect(ROLE_LANDING_OPTIONS[UserRole.MANAGER].every((option) => option.value.startsWith("/manager"))).toBe(true);
    expect(ROLE_LANDING_OPTIONS[UserRole.WORKER].every((option) => option.value.startsWith("/worker"))).toBe(true);
    expect(ROLE_LANDING_OPTIONS[UserRole.CLIENT].every((option) => option.value.startsWith("/client"))).toBe(true);
  });

  it("validates only supported preference updates", () => {
    expect(userPreferencePatchSchema.safeParse({
      notificationChannel: { type: "FEEDBACK_RECEIVED", channel: "email", enabled: false },
    }).success).toBe(true);
    expect(userPreferencePatchSchema.safeParse({ location: "  Soho Branch  " }).data).toEqual({
      location: "Soho Branch",
    });
    expect(userPreferencePatchSchema.safeParse({ location: "x".repeat(121) }).success).toBe(false);
    expect(userPreferencePatchSchema.safeParse({ aiCopilotName: "  Studio Helper  " }).data).toEqual({
      aiCopilotName: "Studio Helper",
    });
    expect(userPreferencePatchSchema.safeParse({ aiCopilotName: " " }).success).toBe(false);
    expect(userPreferencePatchSchema.safeParse({ aiCopilotName: "x".repeat(49) }).success).toBe(false);
    expect(userPreferencePatchSchema.safeParse({ preferredFormat: "TIFF_16BIT" }).success).toBe(false);
    expect(userPreferencePatchSchema.safeParse({}).success).toBe(false);
  });
});
