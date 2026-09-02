import { describe, expect, it } from "vitest";
import {
  applyTargetForJobs,
  applyUnavailableReason,
} from "@/modules/job-market/domain/apply-target";

describe("campaign apply target", () => {
  const jobs = [
    {
      id: "1",
      title: "A",
      status: "open" as const,
      applyUrl: "https://jobs.example.com/a",
    },
    {
      id: "2",
      title: "B",
      status: "open" as const,
      applyUrl: "https://jobs.example.com/b",
    },
  ];
  it("uses one campaign URL directly", () =>
    expect(applyTargetForJobs(jobs, "https://jobs.example.com").mode).toBe(
      "single",
    ));
  it("selects among multiple job URLs", () =>
    expect(applyTargetForJobs(jobs).mode).toBe("select"));
  it("disables unsafe and closed targets", () => {
    expect(
      applyUnavailableReason("closed", "https://jobs.example.com"),
    ).toContain("失效");
    expect(applyUnavailableReason("open", "http://unsafe.test")).toContain(
      "安全",
    );
    expect(
      applyUnavailableReason("open", "https://jobs.example.com/apply"),
    ).toBeNull();
    expect(
      applyTargetForJobs([
        ...jobs,
        { id: "3", title: "C", status: "closed", applyUrl: null },
      ]).jobs,
    ).toHaveLength(2);
  });
});
