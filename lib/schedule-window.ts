const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns an initial data window that covers the complete visible month grid,
 * with one extra day at each edge for client/server timezone differences.
 */
export function getInitialScheduleWindow(referenceDate: Date) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0));
  const monthEndWeekday = monthEnd.getUTCDay();

  const startDate = new Date(
    monthStart.getTime() - (monthStart.getUTCDay() + 1) * DAY_MS
  );
  const endDate = new Date(
    monthEnd.getTime() + (6 - monthEndWeekday + 2) * DAY_MS - 1
  );

  return { startDate, endDate };
}
