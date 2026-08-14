import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readSpreadsheet } from "@/modules/data-transfer/infrastructure/spreadsheet-reader";
import {
  rowsToCsv,
  rowsToXlsx,
} from "@/modules/data-transfer/infrastructure/spreadsheet-writer";

describe("表格读取与写出", () => {
  it("按 UTF-8 读取中文 CSV", () => {
    const bytes = new TextEncoder().encode(
      "公司,岗位,投递日期\n甲公司,开发,2026-08-13",
    );
    expect(readSpreadsheet(bytes.buffer, "valid.csv")).toEqual([
      { 公司: "甲公司", 岗位: "开发", 投递日期: "2026-08-13" },
    ]);
  });
  it("拒绝伪造 XLSX 和 CSV 二进制内容", () => {
    expect(() =>
      readSpreadsheet(new TextEncoder().encode("fake").buffer, "fake.xlsx"),
    ).toThrow("XLSX");
    expect(() =>
      readSpreadsheet(new Uint8Array([0, 1]).buffer, "fake.csv"),
    ).toThrow("二进制");
  });
  it("拒绝超限、未知格式和无法解码的文件", () => {
    expect(() =>
      readSpreadsheet(new ArrayBuffer(5 * 1024 * 1024 + 1), "large.csv"),
    ).toThrow("5MB");
    expect(() => readSpreadsheet(new ArrayBuffer(0), "data.txt")).toThrow(
      "CSV 或 XLSX",
    );
    expect(() =>
      readSpreadsheet(new Uint8Array([0xc3, 0x28]).buffer, "invalid.csv"),
    ).toThrow("UTF-8");
  });
  it("写出可往返的 XLSX 并阻止公式注入", () => {
    const rows = [{ 公司: "=CMD()", 岗位: "开发" }];
    expect(rowsToCsv(rows)).toContain("'=CMD()");
    const workbook = XLSX.read(rowsToXlsx(rows));
    const value = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets[workbook.SheetNames[0]],
    )[0];
    expect(value.公司).toBe("'=CMD()");
  });
});
