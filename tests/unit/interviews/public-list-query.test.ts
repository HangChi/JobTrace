import { describe, expect, it } from "vitest";
import { parsePublicInterviewListQuery } from "@/modules/interviews/application/public-list-query";

describe("public interview list query", () => {
  it("accepts company search and pagination only", () => {
    expect(
      parsePublicInterviewListQuery(
        new URLSearchParams("q=%20JobTrace%20&cursor=next&limit=20"),
      ),
    ).toMatchObject({
      q: "JobTrace",
      cursor: "next",
      limit: 20,
    });
  });

  it("rejects invalid page size", () => {
    expect(() =>
      parsePublicInterviewListQuery(new URLSearchParams("limit=51")),
    ).toThrow();
  });

  it("ignores retired advanced filters", () => {
    expect(
      parsePublicInterviewListQuery(
        new URLSearchParams(
          "stage=interview_1&interviewedFrom=2026-08-01&interviewedTo=2026-08-02",
        ),
      ),
    ).toEqual({ q: "", limit: 20 });
  });
});
