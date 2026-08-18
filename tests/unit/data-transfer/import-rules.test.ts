import { describe, expect, it } from "vitest";
import {
  escapeSpreadsheetFormula,
  normalizeImportRow,
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
});
