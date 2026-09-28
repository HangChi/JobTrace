import { describe, expect, it } from "vitest";
import { normalizeItems } from "@/modules/job-market/infrastructure/adapters/shared";
import type { JobMarketSource } from "@/modules/job-market/domain/entities";

const source: JobMarketSource = {
  id: "source-1",
  companyId: "company-1",
  companyName: "Example",
  adapter: "china_bigtech",
  externalKey: "example",
  baseUrl: "https://jobs.example.com",
  allowedHosts: ["jobs.example.com"],
  countryCodes: [],
  isOfficial: true,
  accessBasis: "public",
  status: "active",
  syncIntervalMinutes: 360,
  consecutiveFailures: 0,
  etag: null,
  lastModified: null,
};

describe("normalizeItems", () => {
  it("deduplicates repeated external ids and merges their locations", () => {
    const result = normalizeItems(source, [
      {
        id: "job-1",
        title: "Engineer",
        locations: "上海",
        detailUrl: "https://jobs.example.com/job-1",
      },
      {
        id: "job-1",
        title: "Engineer",
        locations: "深圳",
        detailUrl: "https://jobs.example.com/job-1",
      },
    ]);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].locations.map((location) => location.name)).toEqual([
      "上海",
      "深圳",
    ]);
  });

  it("drops an upstream deadline that predates its publish time", () => {
    const result = normalizeItems(source, [
      {
        id: "job-2",
        title: "Designer",
        publishedAt: "2026-06-01T00:00:00Z",
        validThrough: "2026-01-26T00:00:00Z",
      },
    ]);

    expect(result.jobs[0]).toMatchObject({
      publishedAt: new Date("2026-06-01T00:00:00Z"),
      validThrough: null,
    });
  });
});
