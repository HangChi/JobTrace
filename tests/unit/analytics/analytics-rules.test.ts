import { describe, expect, it } from "vitest";
import {
  needsFollowUp,
  summarizeApplications,
} from "@/modules/analytics/application/analytics-rules";
describe("统计规则", () => {
  it("结束状态不提醒，满 7 天提醒", () => {
    expect(needsFollowUp("active", "2026-08-06", "2026-08-13")).toBe(true);
    expect(needsFollowUp("offer", "2026-08-07", "2026-08-13")).toBe(false);
    expect(needsFollowUp("rejected", "2026-01-01", "2026-08-13")).toBe(false);
  });
  it("汇总状态", () =>
    expect(
      summarizeApplications([
        { status: "active" },
        { status: "offer" },
        { status: "rejected" },
      ]),
    ).toEqual({ total: 3, active: 1, rejected: 1, offers: 1 }));
});
