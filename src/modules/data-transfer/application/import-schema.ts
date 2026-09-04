import { createApplicationSchema } from "@/modules/applications/domain/application.schema";
import {
  RECRUITMENT_STAGES,
  STAGE_LABELS,
  type RecruitmentStage,
} from "@/modules/applications/domain/catalog";
import { Problem } from "@/shared/errors/problem";

export const IMPORT_FIELDS = [
  "companyName",
  "positionName",
  "appliedDate",
  "type",
  "city",
  "jobUrl",
  "notes",
  "status",
  "stages",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  companyName: "公司名称",
  positionName: "岗位名称",
  appliedDate: "投递日期",
  type: "类型",
  city: "城市",
  jobUrl: "职位链接",
  notes: "备注",
  status: "状态",
  stages: "阶段历史",
};

const aliases: Record<ImportField, readonly string[]> = {
  companyName: ["companyName", "公司", "公司名称"],
  positionName: ["positionName", "岗位", "岗位名称"],
  appliedDate: ["appliedDate", "投递日期"],
  type: ["type", "类型"],
  city: ["city", "城市"],
  jobUrl: ["jobUrl", "职位链接"],
  notes: ["notes", "备注"],
  status: ["status", "状态", "投递"],
  stages: ["stages", "阶段", "阶段历史"],
};
const typeAliases: Record<string, string> = {
  暑期实习: "summer_internship",
  summer_internship: "summer_internship",
  日常实习: "daily_internship",
  daily_internship: "daily_internship",
  秋招提前批: "early_campus_recruitment",
  early_campus_recruitment: "early_campus_recruitment",
  秋招: "campus_recruitment",
  campus_recruitment: "campus_recruitment",
  社招: "social_recruitment",
  social_recruitment: "social_recruitment",
};
const statusAliases: Record<string, string> = {
  Offer: "offer",
  offer: "offer",
  已投递: "submitted",
  submitted: "submitted",
  拒绝: "refused",
  refused: "refused",
};
const stageByLabel = new Map(
  RECRUITMENT_STAGES.map((stage) => [STAGE_LABELS[stage], stage]),
);

export function inferImportMapping(columns: string[]) {
  return Object.fromEntries(
    columns.map((column) => {
      const field = IMPORT_FIELDS.find((candidate) =>
        aliases[candidate].includes(column),
      );
      return [column, field ?? ""];
    }),
  );
}

export function validateImportMapping(
  columns: string[],
  mapping: Record<string, string>,
) {
  const knownColumns = new Set(columns);
  const targets = new Set<string>();
  for (const [column, field] of Object.entries(mapping)) {
    if (!knownColumns.has(column))
      throw new Problem("validation", `映射包含未知源列：${column}`, 400);
    if (!field) continue;
    if (!IMPORT_FIELDS.includes(field as ImportField))
      throw new Problem("validation", `映射包含未知业务字段：${field}`, 400);
    if (targets.has(field))
      throw new Problem("validation", "同一业务字段不能映射多个源列。", 400);
    targets.add(field);
  }
  return Object.fromEntries(
    columns.map((column) => [column, mapping[column] ?? ""]),
  );
}

export function applyImportMapping(
  row: Record<string, unknown>,
  mapping: Record<string, string>,
) {
  return Object.fromEntries(
    Object.entries(mapping).flatMap(([column, field]) =>
      field ? [[field, row[column]]] : [],
    ),
  );
}

export function parseStageHistory(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/[；;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.+?)\s*(?:\+|@)\s*(\d{4}-\d{2}-\d{2})$/);
      if (!match) return { stage: "", occurredOn: "" };
      const descriptor = match[1].trim();
      const code = descriptor.split("/")[0].trim();
      const stage = RECRUITMENT_STAGES.includes(code as RecruitmentStage)
        ? code
        : stageByLabel.get(descriptor);
      return { stage: stage ?? "", occurredOn: match[2] };
    });
}

export function normalizeImportRow(row: Record<string, unknown>) {
  const value: Record<string, unknown> = {};
  for (const [field, names] of Object.entries(aliases))
    for (const name of names)
      if (row[name] != null) {
        value[field] =
          typeof row[name] === "string" ? row[name].trim() : row[name];
        break;
      }
  if (typeof value.status === "string")
    value.status = statusAliases[value.status] ?? value.status;
  if (typeof value.type === "string")
    value.type = typeAliases[value.type] ?? value.type;
  if (value.stages != null) value.stages = parseStageHistory(value.stages);
  return value;
}
export function validateImportRow(row: Record<string, unknown>) {
  return createApplicationSchema.safeParse(normalizeImportRow(row));
}
export function escapeSpreadsheetFormula(value: unknown) {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
