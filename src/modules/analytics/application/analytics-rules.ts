import { calendarDaysBetween } from "@/shared/date/business-date";
export function needsFollowUp(
  status: string,
  latestDate: string,
  today: string,
) {
  return status === "submitted" && calendarDaysBetween(latestDate, today) >= 7;
}
export function summarizeApplications(items: { status: string }[]) {
  return {
    total: items.length,
    submitted: items.filter((x) => x.status === "submitted").length,
    refused: items.filter((x) => x.status === "refused").length,
    offers: items.filter((x) => x.status === "offer").length,
  };
}
