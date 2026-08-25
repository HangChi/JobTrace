import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readSpreadsheet } from "@/modules/data-transfer/infrastructure/spreadsheet-reader";
import {
  rowsToCsv,
  rowsToXlsx,
} from "@/modules/data-transfer/infrastructure/spreadsheet-writer";

describe("表格读取与写出", () => {
  it("按 UTF-8 读取中文 CSV", async () => {
    const bytes = new TextEncoder().encode(
      "公司,岗位,投递日期\n甲公司,开发,2026-08-13",
    );
    await expect(readSpreadsheet(bytes.buffer, "valid.csv")).resolves.toEqual([
      { 公司: "甲公司", 岗位: "开发", 投递日期: "2026-08-13" },
    ]);
  });
  it("拒绝伪造 XLSX 和 CSV 二进制内容", async () => {
    await expect(
      readSpreadsheet(new TextEncoder().encode("fake").buffer, "fake.xlsx"),
    ).rejects.toThrow("XLSX");
    await expect(
      readSpreadsheet(new Uint8Array([0, 1]).buffer, "fake.csv"),
    ).rejects.toThrow("二进制");
  });
  it("拒绝超限、未知格式和无法解码的文件", async () => {
    await expect(
      readSpreadsheet(new ArrayBuffer(5 * 1024 * 1024 + 1), "large.csv"),
    ).rejects.toThrow("5MB");
    await expect(
      readSpreadsheet(new ArrayBuffer(0), "data.txt"),
    ).rejects.toThrow("CSV 或 XLSX");
    await expect(
      readSpreadsheet(new Uint8Array([0xc3, 0x28]).buffer, "invalid.csv"),
    ).rejects.toThrow("UTF-8");
  });
  it("写出可往返的 XLSX 并阻止公式注入", async () => {
    const rows = [
      { 公司: "=CMD()", 岗位: "开发", 职位链接: "https://example.com/job" },
    ];
    expect(rowsToCsv(rows)).toContain("'=CMD()");
    const workbook = new ExcelJS.Workbook();
    const output = await rowsToXlsx(rows, {
      hyperlinkColumns: ["职位链接"],
    });
    await workbook.xlsx.load(output.buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell("A2").text).toBe("'=CMD()");
    expect(sheet.getCell("C2").hyperlink).toBe("https://example.com/job");
  });
});
