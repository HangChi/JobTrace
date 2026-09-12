// PG date 列（无时区语义的业务日期）到 YYYY-MM-DD 字符串的统一截断。
export function dateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
