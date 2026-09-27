import { describe, expect, it } from "vitest";
import {
  calculateNotifyAt,
  parseBeijingDateTime,
  toBeijingLocalInput,
  validateReminderTimes,
} from "@/modules/reminders/domain/reminder-rules";

describe("reminder time rules", () => {
  it("interprets datetime-local values as Beijing time", () => {
    expect(parseBeijingDateTime("2026-10-08T14:00").toISOString()).toBe(
      "2026-10-08T06:00:00.000Z",
    );
  });

  it.each([
    ["on_time", "2026-10-08T06:00:00.000Z"],
    ["30m", "2026-10-08T05:30:00.000Z"],
    ["1h", "2026-10-08T05:00:00.000Z"],
    ["1d", "2026-10-07T06:00:00.000Z"],
  ] as const)("calculates %s lead time", (lead, expected) => {
    expect(
      calculateNotifyAt(
        new Date("2026-10-08T06:00:00.000Z"),
        lead,
      )?.toISOString(),
    ).toBe(expected);
  });

  it("round trips Beijing local display input", () => {
    expect(toBeijingLocalInput("2026-10-08T06:00:00.000Z")).toBe(
      "2026-10-08T14:00",
    );
  });

  it("rejects past and post-event notification times", () => {
    expect(() =>
      validateReminderTimes(
        new Date("2026-10-08T06:00:00Z"),
        new Date("2026-10-08T07:00:00Z"),
        new Date("2026-10-01T00:00:00Z"),
      ),
    ).toThrow("请检查提醒时间");
    expect(() =>
      validateReminderTimes(
        new Date("2026-10-08T06:00:00Z"),
        new Date("2026-09-30T00:00:00Z"),
        new Date("2026-10-01T00:00:00Z"),
      ),
    ).toThrow("请检查提醒时间");
  });

  it("allows snoozing after an event while requiring a future notification", () => {
    expect(() =>
      validateReminderTimes(
        new Date("2026-10-01T06:00:00Z"),
        new Date("2026-10-08T07:00:00Z"),
        new Date("2026-10-08T06:00:00Z"),
        { snooze: true },
      ),
    ).not.toThrow();
  });
});
