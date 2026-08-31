import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SecureSourceFetch } from "@/modules/job-market/application/ports";
import type { JobMarketSource } from "@/modules/job-market/domain/entities";
import { GreenhouseAdapter } from "@/modules/job-market/infrastructure/adapters/greenhouse-adapter";
import { LeverAdapter } from "@/modules/job-market/infrastructure/adapters/lever-adapter";
import { AshbyAdapter } from "@/modules/job-market/infrastructure/adapters/ashby-adapter";
import { SmartRecruitersAdapter } from "@/modules/job-market/infrastructure/adapters/smartrecruiters-adapter";
import { MokaAdapter } from "@/modules/job-market/infrastructure/adapters/moka-adapter";
import { SchemaOrgAdapter } from "@/modules/job-market/infrastructure/adapters/schema-org-adapter";
import { XiaomiAdapter } from "@/modules/job-market/infrastructure/adapters/xiaomi-adapter";

const fixture = (name: string) =>
  readFile(
    path.join(process.cwd(), "tests/fixtures/job-market/sources", name),
    "utf8",
  );
function source(adapter: JobMarketSource["adapter"]): JobMarketSource {
  return {
    id: `${adapter}-source`,
    companyId: "company",
    companyName: "Fixture Company",
    adapter,
    externalKey: "fixture",
    baseUrl: "https://jobs.example.com",
    allowedHosts: ["jobs.example.com"],
    countryCodes:
      adapter === "smartrecruiters" ||
      adapter === "xiaomi" ||
      adapter === "moka"
        ? ["cn"]
        : [],
    isOfficial: true,
    accessBasis: "public",
    status: "active",
    syncIntervalMinutes: 360,
    consecutiveFailures: 0,
    etag: null,
    lastModified: null,
  };
}

test("xiaomi paginates domestic jobs and preserves official application URLs", async () => {
  const pages = [
    {
      code: 0,
      data: {
        total: 3,
        list: [
          {
            id: 1,
            jobPostId: "post-1",
            title: "算法工程师",
            cityZhNames: ["北京", "上海"],
            description: "岗位职责",
            requirement: "岗位要求",
            publishTime: "2026-08-30",
            type: 1,
            url: "https://xiaomi.jobs.example.com/post-1",
          },
          {
            id: 3,
            title: "海外零售经理",
            cityZhNames: ["埃尔比勒"],
            type: 1,
            url: "https://xiaomi.jobs.example.com/post-3",
          },
        ],
      },
    },
    {
      code: 0,
      data: {
        total: 3,
        list: [
          {
            id: 2,
            title: "产品经理",
            cityZhNames: ["深圳"],
            publishTime: "2026-08-29",
            type: 3,
            url: "https://xiaomi.jobs.example.com/post-2",
          },
        ],
      },
    },
  ];
  let call = 0;
  const adapter = new XiaomiAdapter(async () => ({
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => JSON.stringify(pages[Math.min(call, 1)]),
    json: async () => pages[Math.min(call++, 1)],
  }));
  const batch = await adapter.fetch(
    { ...source("xiaomi"), baseUrl: "https://jobs.example.com/website/" },
    { runId: "run", now: new Date("2026-08-30"), maxItems: 100 },
    new AbortController().signal,
  );
  expect(batch.completeness).toBe("complete");
  expect(batch.jobs).toHaveLength(2);
  expect(batch.jobs[0]).toMatchObject({
    externalJobId: "post-1",
    recruitmentType: "社会招聘",
    campaignName: "中国区在招岗位",
    applyUrl: "https://xiaomi.jobs.example.com/post-1",
  });
  expect(batch.jobs[0].locations.map((location) => location.name)).toEqual([
    "北京",
    "上海",
  ]);
});

test("moka normalizes a domestic job and builds the official application URL", async () => {
  const adapter = new MokaAdapter(
    fetcher(await fixture("moka.json"), "application/json"),
  );
  const batch = await adapter.fetch(
    {
      ...source("moka"),
      externalKey: "fixture|social|44726",
      baseUrl: "https://api.mokahr.com/",
      allowedHosts: ["api.mokahr.com"],
    },
    { runId: "run", now: new Date("2026-08-30"), maxItems: 100 },
    new AbortController().signal,
  );
  expect(batch.completeness).toBe("complete");
  expect(batch.jobs).toHaveLength(1);
  expect(batch.jobs[0]).toMatchObject({
    title: "芯片研发工程师",
    campaignName: "社会招聘",
    recruitmentType: "全职",
    applyUrl:
      "https://app.mokahr.com/apply/fixture/44726#/job/moka-job-1/apply",
  });
  expect(batch.jobs[0].locations.map((location) => location.name)).toEqual([
    "上海市 · 闵行区",
  ]);
});
function fetcher(body: string, contentType: string): SecureSourceFetch {
  return async () => ({
    status: 200,
    headers: new Headers({ "content-type": contentType }),
    text: async () => body,
    json: async () => JSON.parse(body) as unknown,
  });
}

for (const [kind, file, Adapter] of [
  ["greenhouse", "greenhouse.json", GreenhouseAdapter],
  ["lever", "lever.json", LeverAdapter],
  ["ashby", "ashby.json", AshbyAdapter],
  ["smartrecruiters", "smartrecruiters.json", SmartRecruitersAdapter],
] as const) {
  test(`${kind} normalizes a complete public job batch`, async () => {
    const adapter = new Adapter(
      fetcher(await fixture(file), "application/json"),
    );
    const batch = await adapter.fetch(
      source(kind),
      { runId: "run", now: new Date("2026-08-30"), maxItems: 100 },
      new AbortController().signal,
    );
    expect(batch.completeness).toBe("complete");
    expect(batch.jobs).toHaveLength(1);
    expect(batch.jobs[0].applyUrl).toMatch(/^https:\/\//);
    expect(batch.jobs[0].contentHash).toHaveLength(64);
  });
}

test("schema.org extracts JobPosting without retaining active markup", async () => {
  const adapter = new SchemaOrgAdapter(
    fetcher(await fixture("schema-org.html"), "text/html"),
  );
  const batch = await adapter.fetch(
    source("schema_org"),
    { runId: "run", now: new Date("2026-08-30"), maxItems: 100 },
    new AbortController().signal,
  );
  expect(batch.jobs).toHaveLength(1);
  expect(batch.jobs[0].descriptionText).toBe("Build AI");
});

test("adapter isolates malformed items, sanitizes unsafe URLs and reports bounded partial batches", async () => {
  const adapter = new GreenhouseAdapter(
    fetcher(await fixture("edge-cases.json"), "application/json"),
  );
  const result = await adapter.fetch(
    source("greenhouse"),
    { runId: "run", now: new Date("2026-08-30"), maxItems: 3 },
    new AbortController().signal,
  );
  expect(result.completeness).toBe("partial");
  expect(result.jobs).toHaveLength(2);
  expect(result.rejected).toEqual([
    expect.objectContaining({
      externalJobId: "edge-malformed",
      reasonCode: "invalid_item",
    }),
  ]);
  expect(
    result.jobs.find((job) => job.externalJobId === "edge-unsafe")?.applyUrl,
  ).toBeNull();
  expect(result.jobs[0].locations.map((location) => location.name)).toEqual([
    "上海",
    "杭州",
  ]);
});
