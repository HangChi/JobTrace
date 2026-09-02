export type FieldError = { field: string; code: string; message: string };
export type ProblemDetails = {
  existingApplicationId?: string;
  auditEventId?: string;
  latestAccessState?: {
    role: "user" | "admin";
    disabled: boolean;
    accessVersion: number;
  };
};
export class Problem extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
    public fieldErrors?: FieldError[],
    public details?: ProblemDetails,
  ) {
    super(message);
  }
}
export function asProblem(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (
      error as {
        issues: { path: PropertyKey[]; code: string; message: string }[];
      }
    ).issues;
    return new Problem(
      "validation",
      "请检查输入内容。",
      400,
      issues.map((issue) => ({
        field: String(issue.path[0] ?? "request"),
        code: issue.code,
        message: issue.message,
      })),
    );
  }
  return error instanceof Problem
    ? error
    : new Problem("internal", "服务暂时不可用，请稍后重试。", 500);
}
