import { differenceInCalendarDays, format, startOfWeek } from "date-fns";

export type BusinessDate = `${number}-${number}-${number}`;
export function businessToday(now = new Date()): BusinessDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}` as BusinessDate;
}
export function calendarDaysBetween(from: string, to: string) {
  return differenceInCalendarDays(
    new Date(`${to}T00:00:00Z`),
    new Date(`${from}T00:00:00Z`),
  );
}
export function startOfBusinessWeek(date: string): BusinessDate {
  return format(
    startOfWeek(new Date(`${date}T12:00:00Z`), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  ) as BusinessDate;
}
