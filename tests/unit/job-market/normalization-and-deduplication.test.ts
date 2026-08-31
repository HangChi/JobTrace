import { describe, expect, it } from "vitest";
import {
  choosePrimary,
  findDedupMatch,
  jobFingerprint,
} from "@/modules/job-market/domain/deduplication";
import {
  campaignKey,
  canonicalHttpsUrl,
  contentHash,
  normalizeLocation,
  normalizeText,
  plainText,
  safeDate,
  uniqueLocations,
} from "@/modules/job-market/domain/normalization";
import type { NormalizedJob } from "@/modules/job-market/domain/entities";

const job = (partial: Partial<NormalizedJob> = {}): NormalizedJob => ({
  externalJobId: "job-1",
  title: "软件 工程师",
  normalizedTitle: "软件 工程师",
  locations: uniqueLocations(["上海", "上海"]),
  campaignName: "2027 校招",
  campaignKey: campaignKey({ explicit: "2027 校招", sourceKey: "board" }),
  batchLabel: "2027",
  recruitmentType: "campus",
  target: null,
  education: null,
  descriptionText: null,
  detailUrl: "https://jobs.example.com/1?utm_source=test",
  applyUrl: "https://jobs.example.com/1/apply",
  publishedAt: null,
  validThrough: null,
  sourceStatus: "open",
  contentHash: "a".repeat(64),
  ...partial,
});

describe("job normalization and conservative deduplication", () => {
  it("normalizes text, locations, campaigns, and tracking URLs deterministically", () => {
    expect(normalizeText("  Ａ  B ")).toBe("a b");
    expect(uniqueLocations(["上海", " 上海 ", "Remote"])).toHaveLength(2);
    expect(campaignKey({ explicit: "秋招", sourceKey: "a" })).toBe(
      campaignKey({ explicit: " 秋招 ", sourceKey: "b" }),
    );
    expect(canonicalHttpsUrl("https://jobs.example.com/1?utm_source=x")).toBe(
      "https://jobs.example.com/1",
    );
    expect(
      canonicalHttpsUrl("https://jobs.example.com/app#/job/1/apply", {
        preserveHash: true,
      }),
    ).toBe("https://jobs.example.com/app#/job/1/apply");
  });
  it("matches source identity then canonical URLs and never crosses companies", () => {
    const candidate = {
      postId: "p1",
      companyId: "c1",
      sourceId: "s1",
      externalJobId: "job-1",
      isOfficial: true,
      job: job(),
    };
    expect(
      findDedupMatch(
        { companyId: "c1", sourceId: "s1", isOfficial: false, job: job() },
        [candidate],
      )?.reason,
    ).toBe("source_identity");
    expect(
      findDedupMatch(
        {
          companyId: "c2",
          sourceId: "s2",
          isOfficial: false,
          job: job({ externalJobId: "other" }),
        },
        [candidate],
      ),
    ).toBeNull();
    expect(jobFingerprint("c1", job())).toBe(jobFingerprint("c1", job()));
  });
  it("prefers official and then freshest provenance", () => {
    const primary = choosePrimary([
      { isOfficial: false, lastSeenAt: new Date("2026-01-02") },
      { isOfficial: true, lastSeenAt: new Date("2026-01-01") },
    ]);
    expect(primary?.isOfficial).toBe(true);
    expect(
      choosePrimary([
        { isOfficial: true, lastSeenAt: new Date("2026-01-01") },
        { isOfficial: true, lastSeenAt: new Date("2026-01-03") },
      ])?.lastSeenAt.toISOString(),
    ).toContain("2026-01-03");
    expect(choosePrimary([])).toBeNull();
  });
  it("sanitizes optional text, dates, locations, and unsafe URLs", () => {
    expect(plainText(null)).toBeNull();
    expect(
      plainText("<script>x()</script><style>x</style><b> Build </b>", 4),
    ).toBe("Buil");
    expect(plainText("<script>x()</script>")).toBeNull();
    expect(normalizeLocation(" Remote ").isRemote).toBe(true);
    expect(uniqueLocations(["", "  "])).toEqual([]);
    const date = new Date("2026-08-30T00:00:00Z");
    expect(safeDate(date)).toBe(date);
    expect(safeDate("not-a-date")).toBeNull();
    expect(safeDate(null)).toBeNull();
    expect(canonicalHttpsUrl("http://jobs.example.com")).toBeNull();
    expect(canonicalHttpsUrl("https://user:pass@jobs.example.com")).toBeNull();
    expect(canonicalHttpsUrl("not a url")).toBeNull();
    expect(
      canonicalHttpsUrl(
        "https://jobs.example.com/a?utm_medium=x&source=y&keep=z#section",
      ),
    ).toBe("https://jobs.example.com/a?keep=z");
    expect(
      campaignKey({ sourceKey: "board", recruitmentType: null }),
    ).toHaveLength(64);
    const value = job();
    expect(
      contentHash({ ...value, locations: [...value.locations].reverse() }),
    ).toBe(contentHash(value));
  });
  it("does not merge an ambiguous exact fingerprint", () => {
    const candidates = ["p1", "p2"].map((postId, index) => ({
      postId,
      companyId: "c1",
      sourceId: `s${index}`,
      externalJobId: `external-${index}`,
      isOfficial: false,
      job: job({
        externalJobId: `external-${index}`,
        detailUrl: null,
        applyUrl: null,
      }),
    }));
    expect(
      findDedupMatch(
        {
          companyId: "c1",
          sourceId: "incoming",
          isOfficial: false,
          job: job({
            externalJobId: "incoming",
            detailUrl: null,
            applyUrl: null,
          }),
        },
        candidates,
      ),
    ).toBeNull();
  });
});
