import { describe, expect, it } from "vitest";
import {
  followUpReason,
  needsFollowUp,
  summarizeApplications,
} from "@/modules/analytics/application/analytics-rules";
describe("统计规则", () => {
  it("结束状态不提醒，满 15 天提醒", () => {
    expect(needsFollowUp("submitted", "2026-07-30", "2026-08-13")).toBe(false);
    expect(needsFollowUp("submitted", "2026-07-29", "2026-08-13")).toBe(true);
    expect(needsFollowUp("offer", "2026-08-07", "2026-08-13")).toBe(false);
    expect(needsFollowUp("refused", "2026-01-01", "2026-08-13")).toBe(false);
  });
  it("区分时间线和投递记录未更新", () => {
    expect(
      followUpReason("submitted", "2026-08-10", "2026-07-30", "2026-08-14"),
    ).toBe("timeline");
    expect(followUpReason("submitted", "2026-07-30", null, "2026-08-14")).toBe(
      "application",
    );
    expect(
      followUpReason("offer", "2026-01-01", "2026-01-01", "2026-08-14"),
    ).toBeNull();
    expect(
      followUpReason("refused", "2026-01-01", "2026-01-01", "2026-08-14"),
    ).toBeNull();
  });
  it("汇总状态", () =>
    expect(
      summarizeApplications([
        { status: "submitted" },
        { status: "offer" },
        { status: "refused" },
      ]),
    ).toEqual({ total: 3, submitted: 1, refused: 1, offers: 1 }));
});
