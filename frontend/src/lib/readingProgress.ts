import type { ReadingStatus } from "./api";

export function deriveReadingStatusFromDates(
  currentStatus: ReadingStatus,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): ReadingStatus {
  if (endDate) {
    return "finished";
  }

  if (startDate) {
    return "reading";
  }

  return currentStatus;
}
