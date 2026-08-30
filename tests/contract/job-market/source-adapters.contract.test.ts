import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SecureSourceFetch } from "@/modules/job-market/application/ports";
import type { JobMarketSource } from "@/modules/job-market/domain/entities";
import { GreenhouseAdapter } from "@/modules/job-market/infrastructure/adapters/greenhouse-adapter";
import { LeverAdapter } from "@/modules/job-market/infrastructure/adapters/lever-adapter";
import { AshbyAdapter } from "@/modules/job-market/infrastructure/adapters/ashby-adapter";
import { SmartRecruitersAdapter } from "@/modules/job-market/infrastructure/adapters/smartrecruiters-adapter";
import { SchemaOrgAdapter } from "@/modules/job-market/infrastructure/adapters/schema-org-adapter";

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
    isOfficial: true,
    accessBasis: "public",
    status: "active",
    syncIntervalMinutes: 360,
    consecutiveFailures: 0,
    etag: null,
    lastModified: null,
  };
}
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
