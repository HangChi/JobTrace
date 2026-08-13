import { describe, expect, it } from "vitest";
import {
  businessToday,
  calendarDaysBetween,
  startOfBusinessWeek,
} from "@/shared/date/business-date";
import { decodeCursor, encodeCursor } from "@/shared/pagination/cursor";

describe("业务日期", () => {
  it("按上海时区计算自然日和周一", () => {
    expect(businessToday(new Date("2026-08-13T16:30:00Z"))).toBe("2026-08-14");
    expect(startOfBusinessWeek("2026-08-13")).toBe("2026-08-10");
    expect(calendarDaysBetween("2026-08-06", "2026-08-13")).toBe(7);
  });
});

describe("游标", () => {
  it("可无损编码并拒绝损坏数据", () => {
    const cursor = {
      value: "2026-08-13",
      id: "550e8400-e29b-41d4-a716-446655440000",
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(() => decodeCursor("not-a-cursor")).toThrow();
  });
});
