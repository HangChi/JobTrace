import { Problem } from "@/shared/errors/problem";

export const REMINDER_TIME_ZONE = "Asia/Shanghai";
export const REMINDER_TIME_ZONE_LABEL = "北京时间";
export type ReminderLead = "on_time" | "30m" | "1h" | "1d" | "custom";

const leadMilliseconds: Record<Exclude<ReminderLead, "custom">, number> = {
  on_time: 0,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

export function parseBeijingDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Problem("validation", "请填写有效的日期和时间。", 400, [
      {
        field: "eventAt",
        code: "invalid_datetime",
        message: "请填写有效的日期和时间。",
      },
    ]);
  }
  const date = new Date(`${value}:00+08:00`);
  if (Number.isNaN(date.getTime()))
    throw new Problem("validation", "请填写有效的日期和时间。", 400);
  return date;
}

export function calculateNotifyAt(eventAt: Date, lead: ReminderLead) {
  if (lead === "custom") return null;
  return new Date(eventAt.getTime() - leadMilliseconds[lead]);
}

export function validateReminderTimes(
  eventAt: Date,
  notifyAt: Date,
  now = new Date(),
  options: { snooze?: boolean } = {},
) {
  const errors = [];
  if (notifyAt <= now)
    errors.push({
      field: "notifyAt",
      code: "past",
      message: "提醒时间必须晚于当前时间。",
    });
  if (!options.snooze && notifyAt > eventAt)
    errors.push({
      field: "notifyAt",
      code: "after_event",
      message: "提醒时间不能晚于事项时间。",
    });
  if (errors.length)
    throw new Problem("validation", "请检查提醒时间。", 400, errors);
}

export function formatBeijingDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function toBeijingLocalInput(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
