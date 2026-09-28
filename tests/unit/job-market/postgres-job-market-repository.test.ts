import { describe, expect, it } from "vitest";
import { buildBatchPayload } from "@/modules/job-market/infrastructure/postgres-job-market-repository";
import type { NormalizedSourceBatch } from "@/modules/job-market/domain/entities";

function job(
  externalJobId: string,
  location: { name: string; normalizedKey: string; isRemote: boolean },
): NormalizedSourceBatch["jobs"][number] {
  return {
    externalJobId,
    title: `Job ${externalJobId}`,
    normalizedTitle: `job ${externalJobId}`,
    locations: [location],
    campaignName: "Open roles",
    campaignKey: "open-roles",
    batchLabel: null,
    recruitmentType: null,
    target: null,
    education: null,
    descriptionText: null,
    detailUrl: null,
    applyUrl: null,
    publishedAt: null,
    validThrough: null,
    sourceStatus: "open",
    contentHash: externalJobId,
  };
}

describe("PostgresJobMarketRepository batch payload", () => {
  it("uses one display value for the same normalized location key", () => {
    const payload = buildBatchPayload({
      completeness: "complete",
      sourceMetadata: { fetchedAt: new Date("2026-09-28T00:00:00Z") },
      rejected: [],
      jobs: [
        job("1", {
          name: "Shanghai, cn",
          normalizedKey: "shanghai| cn",
          isRemote: false,
        }),
        job("2", {
          name: "shanghai, cn",
          normalizedKey: "shanghai| cn",
          isRemote: false,
        }),
      ],
    });

    expect(payload.map((item) => item.locations[0])).toEqual([
      {
        name: "Shanghai, cn",
        normalizedKey: "shanghai| cn",
        isRemote: false,
      },
      {
        name: "Shanghai, cn",
        normalizedKey: "shanghai| cn",
        isRemote: false,
      },
    ]);
  });
});
