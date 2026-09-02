import { describe, expect, it } from "vitest";
import {
  campaignStatus,
  nextPostLifecycle,
} from "@/modules/job-market/domain/lifecycle";

const now = new Date("2026-08-30T12:00:00Z");
describe("job lifecycle", () => {
  it("requires two separated complete absences", () => {
    expect(
      nextPostLifecycle({
        current: "open",
        observed: false,
        runComplete: true,
        now,
      }).status,
    ).toBe("stale");
    expect(
      nextPostLifecycle({
        current: "stale",
        observed: false,
        runComplete: true,
        now,
        lastMissingSuccessAt: new Date("2026-08-30T05:00:00Z"),
      }).status,
    ).toBe("closed");
  });
  it("does not advance missing state on partial or failed snapshots", () => {
    expect(
      nextPostLifecycle({
        current: "open",
        observed: false,
        runComplete: false,
        now,
      }).status,
    ).toBe("open");
  });
  it("closes explicit/expired jobs and reopens observed jobs", () => {
    expect(
      nextPostLifecycle({
        current: "open",
        observed: false,
        explicitClosed: true,
        runComplete: true,
        now,
      }).status,
    ).toBe("closed");
    expect(
      nextPostLifecycle({
        current: "closed",
        observed: true,
        runComplete: true,
        now,
      }),
    ).toEqual({ status: "open", event: "reopened" });
  });
  it("derives campaign status from children", () => {
    expect(campaignStatus(["closed", "open"])).toBe("open");
    expect(campaignStatus(["closed", "stale"])).toBe("stale");
    expect(campaignStatus(["closed"])).toBe("closed");
  });
});
