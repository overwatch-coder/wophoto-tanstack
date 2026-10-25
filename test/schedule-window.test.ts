import { describe, expect, it } from "vitest";
import { getInitialScheduleWindow } from "@/lib/schedule-window";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("initial schedule window", () => {
  it("covers the full month calendar grid and stays under the 62 day query cap", () => {
    for (let year = 2024; year <= 2028; year += 1) {
      for (let month = 0; month < 12; month += 1) {
        const { startDate, endDate } = getInitialScheduleWindow(
          new Date(Date.UTC(year, month, 15))
        );
        const firstOfMonth = new Date(Date.UTC(year, month, 1));
        const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
        const gridStart = new Date(
          firstOfMonth.getTime() - firstOfMonth.getUTCDay() * DAY_MS
        );
        const gridEnd = new Date(
          lastOfMonth.getTime() + (6 - lastOfMonth.getUTCDay()) * DAY_MS + DAY_MS - 1
        );

        expect(startDate.getTime()).toBeLessThanOrEqual(gridStart.getTime());
        expect(endDate.getTime()).toBeGreaterThanOrEqual(gridEnd.getTime());
        expect(endDate.getTime() - startDate.getTime()).toBeLessThanOrEqual(62 * DAY_MS);
      }
    }
  });

  it("includes the previous and next UTC day as timezone padding", () => {
    const { startDate, endDate } = getInitialScheduleWindow(
      new Date("2026-10-25T12:00:00.000Z")
    );

    expect(startDate.toISOString()).toBe("2026-09-26T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-11-01T23:59:59.999Z");
  });
});
