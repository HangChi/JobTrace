import { test, expect } from "@playwright/test";
import { testDatabase } from "../../setup/database";
import { PostgresJobMarketRepository } from "@/modules/job-market/infrastructure/postgres-job-market-repository";
import type {
  JobMarketSource,
  NormalizedJob,
} from "@/modules/job-market/domain/entities";
import {
  campaignKey,
  contentHash,
  normalizeText,
  uniqueLocations,
} from "@/modules/job-market/domain/normalization";

test("job sync is idempotent, auditable, and requires two complete absences to close", async () => {
  const sql = testDatabase();
  const identity = `fixture-${crypto.randomUUID()}`;
  const [company] = await sql<
    Array<{ id: string }>
  >`insert into job_market_companies(canonical_name,normalized_name,identity_key) values('Fixture Company','fixture company',${identity}) returning id`;
  const [sourceRow] = await sql<
    Array<{ id: string }>
  >`insert into job_market_sources(company_id,adapter,external_key,base_url,allowed_hosts,access_basis,status) values(${company.id},'greenhouse',${identity},'https://jobs.example.com',array['jobs.example.com'],'public','active') returning id`;
  const source: JobMarketSource = {
    id: sourceRow.id,
    companyId: company.id,
    companyName: "Fixture Company",
    adapter: "greenhouse",
    externalKey: identity,
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
  const base: Omit<NormalizedJob, "contentHash"> = {
    externalJobId: "job-1",
    title: "Engineer",
    normalizedTitle: normalizeText("Engineer"),
    locations: uniqueLocations(["Shanghai", "Remote"]),
    campaignName: "2027 Campus",
    campaignKey: campaignKey({ explicit: "2027 Campus", sourceKey: identity }),
    batchLabel: "2027",
    recruitmentType: "campus",
    target: null,
    education: null,
    descriptionText: "Build",
    detailUrl: "https://jobs.example.com/job-1",
    applyUrl: "https://jobs.example.com/job-1/apply",
    publishedAt: new Date("2026-08-30"),
    validThrough: null,
    sourceStatus: "open",
  };
  const job = { ...base, contentHash: contentHash(base) };
  const repository = new PostgresJobMarketRepository();
  try {
    const run = async (batchJobs: NormalizedJob[], now: Date) => {
      const [row] = await sql<
        Array<{ id: string }>
      >`insert into job_market_sync_runs(source_id,trigger,worker_id,request_id) values(${source.id},'scheduled','test',${crypto.randomUUID()}) returning id`;
      return repository.applyBatch(
        source,
        row.id,
        {
          completeness: "complete",
          sourceMetadata: { fetchedAt: now },
          jobs: batchJobs,
          rejected: [],
        },
        now,
      );
    };
    expect((await run([job], new Date("2026-08-30T00:00:00Z"))).created).toBe(
      1,
    );
    expect((await run([job], new Date("2026-08-30T01:00:00Z"))).created).toBe(
      0,
    );
    expect(
      await sql`select id from job_market_posts where company_id=${company.id}`,
    ).toHaveLength(1);
    await run([], new Date("2026-08-30T02:00:00Z"));
    expect(
      (
        await sql<
          Array<{ status: string }>
        >`select status::text from job_market_posts where company_id=${company.id}`
      )[0].status,
    ).toBe("stale");
    await run([], new Date("2026-08-30T09:00:00Z"));
    expect(
      (
        await sql<
          Array<{ status: string }>
        >`select status::text from job_market_posts where company_id=${company.id}`
      )[0].status,
    ).toBe("closed");
    await run([job], new Date("2026-08-30T10:00:00Z"));
    expect(
      (
        await sql<
          Array<{ status: string }>
        >`select status::text from job_market_posts where company_id=${company.id}`
      )[0].status,
    ).toBe("open");
    expect(
      (await sql`select id from job_market_events where source_id=${source.id}`)
        .length,
    ).toBeGreaterThan(3);
  } finally {
    await sql`delete from job_market_events where source_id=${source.id}`;
    await sql`delete from job_market_source_records where source_id=${source.id}`;
    await sql`delete from job_market_post_locations where post_id in(select id from job_market_posts where company_id=${company.id})`;
    await sql`delete from job_market_locations where id not in(select location_id from job_market_post_locations)`;
    await sql`delete from job_market_posts where company_id=${company.id}`;
    await sql`delete from job_market_campaigns where company_id=${company.id}`;
    await sql`delete from job_market_sync_runs where source_id=${source.id}`;
    await sql`delete from job_market_sources where id=${source.id}`;
    await sql`delete from job_market_companies where id=${company.id}`;
    await sql.end();
  }
});
