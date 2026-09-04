import { describe, expect, it } from "vitest";
import {
  applyImportMapping,
  escapeSpreadsheetFormula,
  inferImportMapping,
  normalizeImportRow,
  parseStageHistory,
  validateImportMapping,
  validateImportRow,
} from "@/modules/data-transfer/application/import-schema";
describe("导入导出安全", () => {
  it("归一化中文列", () =>
    expect(
      normalizeImportRow({
        公司: " 甲 ",
        岗位: "开发",
        投递日期: "2026-08-13",
        类型: "暑期实习",
        投递: "Offer",
      }),
    ).toMatchObject({
      companyName: "甲",
      positionName: "开发",
      status: "offer",
      type: "summer_internship",
    }));
  it("归一化秋招提前批类型", () => {
    expect(
      validateImportRow({
        公司: "甲",
        岗位: "开发",
        投递日期: "2026-08-13",
        类型: "秋招提前批",
      }),
    ).toMatchObject({
      success: true,
      data: { type: "early_campus_recruitment" },
    });
  });
  it("阻止公式注入", () =>
    expect(escapeSpreadsheetFormula('=HYPERLINK("bad")')).toBe(
      '\'=HYPERLINK("bad")',
    ));
  it("保留非字符串值和未知状态供领域校验", () => {
    expect(
      normalizeImportRow({
        companyName: 42,
        positionName: " 开发 ",
        appliedDate: "2026-08-13",
        status: "unknown",
      }),
    ).toMatchObject({
      companyName: 42,
      positionName: "开发",
      status: "unknown",
    });
    expect(validateImportRow({ companyName: 42 }).success).toBe(false);
    expect(escapeSpreadsheetFormula(42)).toBe(42);
    expect(escapeSpreadsheetFormula("plain text")).toBe("plain text");
  });
  it("识别源列并允许修正自定义表头", () => {
    expect(inferImportMapping(["公司", "岗位名称", "when", "无关列"])).toEqual({
      公司: "companyName",
      岗位名称: "positionName",
      when: "",
      无关列: "",
    });
    expect(
      applyImportMapping(
        { 公司简称: "甲", 职位: "开发", 日期: "2026-08-13", 忽略: "x" },
        {
          公司简称: "companyName",
          职位: "positionName",
          日期: "appliedDate",
          忽略: "",
        },
      ),
    ).toEqual({
      companyName: "甲",
      positionName: "开发",
      appliedDate: "2026-08-13",
    });
  });
  it("拒绝重复目标、未知列和未知业务字段", () => {
    expect(() =>
      validateImportMapping(["A", "B"], { A: "companyName", B: "companyName" }),
    ).toThrow("同一业务字段");
    expect(() => validateImportMapping(["A"], { B: "companyName" })).toThrow(
      "源列",
    );
    expect(() => validateImportMapping(["A"], { A: "systemTime" })).toThrow(
      "业务字段",
    );
  });
  it("解析可读阶段历史并保留重复阶段的不同日期", () => {
    expect(
      parseStageHistory(
        "interview_1/一面 + 2026-08-10；一面/AI面 + 2026-08-12",
      ),
    ).toEqual([
      { stage: "interview_1", occurredOn: "2026-08-10" },
      { stage: "interview_1", occurredOn: "2026-08-12" },
    ]);
  });
});
