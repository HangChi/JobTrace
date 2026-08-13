import { describe, expect, it } from "vitest";
import {
  escapeSpreadsheetFormula,
  normalizeImportRow,
} from "@/modules/data-transfer/application/import-schema";
describe("导入导出安全", () => {
  it("归一化中文列", () =>
    expect(
      normalizeImportRow({
        公司: " 甲 ",
        岗位: "开发",
        投递日期: "2026-08-13",
      }),
    ).toMatchObject({ companyName: "甲", positionName: "开发" }));
  it("阻止公式注入", () =>
    expect(escapeSpreadsheetFormula('=HYPERLINK("bad")')).toBe(
      '\'=HYPERLINK("bad")',
    ));
});
