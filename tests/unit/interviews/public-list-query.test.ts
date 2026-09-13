import { describe, expect, it } from "vitest";
import { parsePublicInterviewListQuery } from "@/modules/interviews/application/public-list-query";

describe("public interview list query", () => {
  it("accepts only public discovery filters", () => {
    expect(
      parsePublicInterviewListQuery(
        new URLSearchParams(
          "q=%20cache%20&stage=interview_1&interviewedFrom=2026-08-01&limit=20",
        ),
      ),
    ).toMatchObject({
      q: "cache",
      stage: ["interview_1"],
      interviewedFrom: "2026-08-01",
      limit: 20,
    });
  });

  it("rejects invalid stage and page size", () => {
    expect(() =>
      parsePublicInterviewListQuery(new URLSearchParams("stage=offer")),
    ).toThrow();
    expect(() =>
      parsePublicInterviewListQuery(new URLSearchParams("limit=101")),
    ).toThrow();
  });

  it("ignores empty values submitted by the filter form", () => {
    expect(
      parsePublicInterviewListQuery(
        new URLSearchParams("stage=&interviewedFrom=&interviewedTo="),
      ),
    ).toMatchObject({ stage: [], interviewedFrom: undefined });
  });
});
