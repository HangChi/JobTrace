import { describe, expect, it } from "vitest";
import { needsProgressReminder } from "@/modules/analytics/application/analytics-rules";

describe("进展提醒规则", () => {
  it("测评和笔试阶段需要提醒", () => {
    expect(needsProgressReminder("assessment")).toBe(true);
    expect(needsProgressReminder("written_test")).toBe(true);
  });

  it("面试没有完成复盘时需要提醒", () => {
    expect(needsProgressReminder("interview_1")).toBe(true);
    expect(needsProgressReminder("interview_1", "draft")).toBe(true);
    expect(needsProgressReminder("interview_1", "pending_review")).toBe(true);
  });

  it("面经完成后不再提醒", () => {
    expect(needsProgressReminder("interview_1", "completed")).toBe(false);
    expect(needsProgressReminder("hr_interview", "completed")).toBe(false);
  });

  it("简历筛选等非待处理阶段不提醒", () => {
    expect(needsProgressReminder("screening")).toBe(false);
  });
});
