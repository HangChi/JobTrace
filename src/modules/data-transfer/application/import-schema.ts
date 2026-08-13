import { createApplicationSchema } from "@/modules/applications/domain/application.schema";
const aliases = {
  companyName: ["companyName", "公司", "公司名称"],
  positionName: ["positionName", "岗位", "岗位名称"],
  appliedDate: ["appliedDate", "投递日期"],
  city: ["city", "城市"],
  jobUrl: ["jobUrl", "职位链接"],
  notes: ["notes", "备注"],
} as const;
export function normalizeImportRow(row: Record<string, unknown>) {
  const value: Record<string, unknown> = {};
  for (const [field, names] of Object.entries(aliases))
    for (const name of names)
      if (row[name] != null) {
        value[field] =
          typeof row[name] === "string" ? row[name].trim() : row[name];
        break;
      }
  return value;
}
export function validateImportRow(row: Record<string, unknown>) {
  return createApplicationSchema.safeParse(normalizeImportRow(row));
}
export function escapeSpreadsheetFormula(value: unknown) {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
