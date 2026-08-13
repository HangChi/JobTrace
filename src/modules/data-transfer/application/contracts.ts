export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10000;
export type ImportRow = {
  rowNumber: number;
  data: Record<string, unknown> | null;
  errors: { field: string; code: string; message: string }[];
  duplicateApplicationIds: string[];
};
export type ImportPreview = {
  id: string;
  expiresAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  columns: Record<string, string>;
  rows: ImportRow[];
};
export type ImportDecision = { rowNumber: number; action: "import" | "skip" };
export type ImportResultRow = {
  rowNumber: number;
  result: "created" | "skipped" | "failed";
  applicationId: string | null;
  error: { code: string; message: string; requestId: string } | null;
};
export type ImportResult = {
  created: number;
  skipped: number;
  failed: number;
  rows: ImportResultRow[];
};
