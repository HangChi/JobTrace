import { describe, expect, it } from "vitest";
import { parseInterviewListQuery } from "@/modules/interviews/application/list-query";

describe("interview list query", () => {
  it("uses stable defaults and trims free-text search", () => {
    const query = parseInterviewListQuery(new URLSearchParams("q=%20Acme%20"));

    expect(query).toMatchObject({
      q: "Acme",
      status: [],
      stage: [],
      result: [],
      limit: 50,
    });
  });

  it("parses repeated filters and clamps the supported page size", () => {
    const query = parseInterviewListQuery(
      new URLSearchParams(
        [
          "status=draft",
          "status=completed",
          "stage=interview_1",
          "result=passed",
          "limit=100",
          "cursor=2026-08-18T10%3A00%3A00.000Z%3Aabc",
        ].join("&"),
      ),
    );

    expect(query.status).toEqual(["draft", "completed"]);
    expect(query.stage).toEqual(["interview_1"]);
    expect(query.result).toEqual(["passed"]);
    expect(query.limit).toBe(100);
    expect(query.cursor).toContain("abc");
  });

  it("rejects invalid enum and date filters", () => {
    expect(() =>
      parseInterviewListQuery(new URLSearchParams("status=unknown")),
    ).toThrow();
    expect(() =>
      parseInterviewListQuery(
        new URLSearchParams("interviewedFrom=2026-99-99"),
      ),
    ).toThrow();
  });
});
