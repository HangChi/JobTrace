import { calendarDaysBetween } from "@/shared/date/business-date";
import { FOLLOW_UP_THRESHOLD_DAYS } from "@/modules/applications/domain/catalog";
export function needsFollowUp(
  status: string,
  latestDate: string,
  today: string,
) {
  return (
    status === "submitted" &&
    calendarDaysBetween(latestDate, today) >= FOLLOW_UP_THRESHOLD_DAYS
  );
}
export function followUpReason(
  status: string,
  latestDate: string,
  timelineLatestDate: string | null,
  today: string,
) {
  if (status !== "submitted") return null;
  if (
    timelineLatestDate &&
    calendarDaysBetween(timelineLatestDate, today) >= FOLLOW_UP_THRESHOLD_DAYS
  ) {
    return "timeline" as const;
  }
  if (calendarDaysBetween(latestDate, today) >= FOLLOW_UP_THRESHOLD_DAYS) {
    return "application" as const;
  }
  return null;
}
export function summarizeApplications(items: { status: string }[]) {
  return {
    total: items.length,
    submitted: items.filter((x) => x.status === "submitted").length,
    refused: items.filter((x) => x.status === "refused").length,
    offers: items.filter((x) => x.status === "offer").length,
  };
}
