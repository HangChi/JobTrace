import { describe, expect, it } from "vitest";
import {
  createApplicationSchema,
  updateApplicationSchema,
} from "@/modules/applications/domain/application.schema";
import {
  isTerminalStatus,
  uniqueStages,
} from "@/modules/applications/domain/application";

describe("投递领域", () => {
  it("新记录默认属于秋招且拒绝未知类型", () => {
    const parsed = createApplicationSchema.parse({
      companyName: "甲",
      positionName: "开发",
      appliedDate: "2026-08-13",
    });
    expect(parsed.type).toBe("campus_recruitment");
    expect(
      createApplicationSchema.safeParse({
        ...parsed,
        type: "unknown",
      }).success,
    ).toBe(false);
  });
  it("校验必要字段、URL 和日期关系", () => {
    expect(
      createApplicationSchema.safeParse({
        companyName: "",
        positionName: "开发",
        appliedDate: "2026-08-13",
      }).success,
    ).toBe(false);
    expect(
      createApplicationSchema.safeParse({
        companyName: "甲",
        positionName: "开发",
        appliedDate: "2026-08-13",
        jobUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      updateApplicationSchema.safeParse({
        companyName: "甲",
        positionName: "开发",
        appliedDate: "2026-08-13",
        changeDate: "2026-08-12",
        version: 1,
      }).success,
    ).toBe(false);
  });
  it("识别结束状态并按阶段代码去重", () => {
    expect(isTerminalStatus("refused")).toBe(true);
    expect(isTerminalStatus("submitted")).toBe(false);
    expect(
      uniqueStages([
        { stage: "screening", occurredOn: "2026-08-13" },
        { stage: "screening", occurredOn: "2026-08-13" },
      ]),
    ).toHaveLength(1);
  });
});
