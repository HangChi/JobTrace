import { describe, expect, it } from "vitest";
import { asProblem, Problem } from "@/shared/errors/problem";
import { sanitizeLogContext } from "@/shared/observability/logger";
import { createApplicationSchema } from "@/modules/applications/domain/application.schema";

describe("错误与隐私日志", () => {
  it("将 Zod 问题映射为字段错误", () => {
    const parsed = createApplicationSchema.safeParse({});
    if (parsed.success) throw new Error("expected failure");
    const problem = asProblem(parsed.error);
    expect(problem.status).toBe(400);
    expect(problem.fieldErrors?.map((item) => item.field)).toContain(
      "companyName",
    );
  });
  it("保留业务问题并移除敏感日志字段", () => {
    const original = new Problem("conflict", "冲突", 409);
    expect(asProblem(original)).toBe(original);
    expect(
      sanitizeLogContext({
        operation: "create",
        notes: "secret",
        apiToken: "secret",
        requestHeaders: {
          cookie: "better-auth.session_token=secret",
          authorization: "Bearer secret",
          accept: "application/json",
        },
        session: { token: "secret" },
      }),
    ).toEqual({
      operation: "create",
      requestHeaders: { accept: "application/json" },
    });
  });
  it("将未知错误隐藏为统一内部错误", () => {
    const problem = asProblem(new Error("database secret"));
    expect(problem).toMatchObject({ code: "internal", status: 500 });
    expect(problem.message).not.toContain("database secret");
  });
});
