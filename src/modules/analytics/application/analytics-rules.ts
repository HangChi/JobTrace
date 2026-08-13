import { calendarDaysBetween } from "@/shared/date/business-date";
export function needsFollowUp(
  status: string,
  latestDate: string,
  today: string,
) {
  return (
    !["rejected", "accepted", "withdrawn", "offer"].includes(status) &&
    calendarDaysBetween(latestDate, today) >= 7
  );
}
export function summarizeApplications(items: { status: string }[]) {
  return {
    total: items.length,
    active: items.filter((x) => x.status === "active").length,
    rejected: items.filter((x) => x.status === "rejected").length,
    offers: items.filter((x) => x.status === "offer").length,
  };
}
