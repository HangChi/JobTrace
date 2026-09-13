import { describe, expect, it } from "vitest";
import { parsePublicInterviewListQuery } from "@/modules/interviews/application/public-list-query";

describe("public interview list query", () => {
  it("accepts company, city, position, sorting, and pagination", () => {
    expect(
      parsePublicInterviewListQuery(
        new URLSearchParams(
          "q=%20JobTrace%20&city=Shanghai&position=Engineer&sort=hot&cursor=next&limit=20",
        ),
      ),
    ).toMatchObject({
      q: "JobTrace",
      city: "Shanghai",
      position: "Engineer",
      sort: "hot",
      cursor: "next",
      limit: 20,
    });
  });

  it("rejects invalid page size", () => {
    expect(() =>
      parsePublicInterviewListQuery(new URLSearchParams("limit=51")),
    ).toThrow();
  });

  it("defaults to latest ordering", () => {
    expect(
      parsePublicInterviewListQuery(
        new URLSearchParams(
          "stage=interview_1&interviewedFrom=2026-08-01&interviewedTo=2026-08-02",
        ),
      ),
    ).toEqual({
      q: "",
      city: "",
      position: "",
      sort: "latest",
      limit: 20,
    });
  });

  it("rejects unsupported sorting", () => {
    expect(() =>
      parsePublicInterviewListQuery(new URLSearchParams("sort=popular")),
    ).toThrow();
  });
});
