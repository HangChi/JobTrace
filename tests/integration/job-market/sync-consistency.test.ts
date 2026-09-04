import { expect, test } from "@playwright/test";
import { testDatabase, testId } from "../../setup/database";
import { PostgresJobMarketRepository } from "@/modules/job-market/infrastructure/postgres-job-market-repository";
import { PostgresSyncRepository } from "@/modules/job-market/infrastructure/postgres-sync-repository";
import {
  campaignKey,
  contentHash,
  normalizeText,
  uniqueLocations,
} from "@/modules/job-market/domain/normalization";
import type { NormalizedSourceBatch } from "@/modules/job-market/domain/entities";

function batch(externalKey: string, observedAt: Date): NormalizedSourceBatch {
  const base = {
    externalJobId: "consistent-job",
    title: "Consistency Engineer",
    normalizedTitle: normalizeText("Consistency Engineer"),
    locations: uniqueLocations(["Shanghai"]),
    campaignName: "2027 Campus",
    campaignKey: campaignKey({
      explicit: "2027 Campus",
      sourceKey: externalKey,
    }),
    batchLabel: "2027",
    recruitmentType: "campus",
    target: null,
    education: null,
    descriptionText: "Keep sync state atomic",
    detailUrl: "https://jobs.example.com/consistent-job",
    applyUrl: "https://jobs.example.com/consistent-job/apply",
    publishedAt: observedAt,
    validThrough: null,
    sourceStatus: "open" as const,
  };
  return {
    completeness: "complete",
    sourceMetadata: { fetchedAt: observedAt, etag: '"consistent"' },
    jobs: [{ ...base, contentHash: contentHash(base) }],
    rejected: [],
  };
}

test("sync completion is fenced and atomically updates data, run and source state", async () => {
  const sql = testDatabase();
  const repository = new PostgresSyncRepository();
  const jobs = new PostgresJobMarketRepository();
  const externalKey = testId("sync-consistency");
  const [company] = await sql<Array<{ id: string }>>`
    insert into job_market_companies(canonical_name,normalized_name,identity_key)
    values('Sync Consistency','sync consistency',${testId("company")}) returning id
  `;
  let sourceId: string | undefined;

  try {
    sourceId = await repository.createSource({
      companyId: company.id,
      adapter: "greenhouse",
      externalKey,
      baseUrl: "https://jobs.example.com",
      allowedHosts: ["jobs.example.com"],
      countryCodes: [],
      accessBasis: "public",
      isOfficial: true,
      syncIntervalMinutes: 360,
    });
    await repository.updateSource(sourceId, { status: "active" });

    const first = await repository.claimOne(
      sourceId,
      "worker-a",
      "request-a",
      new Date("2026-09-04T00:00:00Z"),
    );
    expect(first).not.toBeNull();
    expect(first?.runId).toEqual(expect.any(String));
    expect(
      await sql`select id from job_market_sync_runs where id=${first?.runId} and status='running'`,
    ).toHaveLength(1);

    await sql`update job_market_sources set lease_until='2026-09-04T00:01:00Z' where id=${sourceId}`;
    const second = await repository.claimOne(
      sourceId,
      "worker-b",
      "request-b",
      new Date("2026-09-04T00:02:00Z"),
    );
    expect(second).not.toBeNull();
    expect(second?.runId).not.toBe(first?.runId);
    expect(
      await sql`select id from job_market_sync_runs where id=${first?.runId} and status='failed' and error_code='lease_expired'`,
    ).toHaveLength(1);

    await expect(
      jobs.completeBatch(
        first!,
        batch(externalKey, new Date("2026-09-04T00:03:00Z")),
        new Date("2026-09-04T00:03:00Z"),
        "succeeded",
      ),
    ).rejects.toThrow(/sync_lease_lost/);
    expect(
      await sql`select id from job_market_posts where company_id=${company.id}`,
    ).toHaveLength(0);
    expect(
      await repository.completeFailure(
        first!,
        new Date("2026-09-04T00:03:00Z"),
        new Date("2026-09-04T00:08:00Z"),
        {
          discovered: 0,
          created: 0,
          updated: 0,
          stale: 0,
          closed: 0,
          rejected: 0,
          errorCode: "source_unavailable",
          errorSummary: "Source request failed",
        },
      ),
    ).toBe(false);

    const result = await jobs.completeBatch(
      second!,
      batch(externalKey, new Date("2026-09-04T00:04:00Z")),
      new Date("2026-09-04T00:04:00Z"),
      "succeeded",
    );
    expect(result.created).toBe(1);
    expect(
      await sql`select id from job_market_sync_runs where id=${second?.runId} and status='succeeded' and created_count=1`,
    ).toHaveLength(1);
    const [sourceState] = await sql<
      Array<{
        leasedBy: string | null;
        leaseRunId: string | null;
        failures: number;
        etag: string | null;
      }>
    >`select leased_by as "leasedBy",lease_run_id as "leaseRunId",
        consecutive_failures as failures,etag
      from job_market_sources where id=${sourceId}`;
    expect(sourceState).toMatchObject({
      leasedBy: null,
      leaseRunId: null,
      failures: 0,
      etag: '"consistent"',
    });
  } finally {
    if (sourceId) {
      await sql`update job_market_sources set lease_until=null,leased_by=null,lease_run_id=null where id=${sourceId}`.catch(
        () => undefined,
      );
      await sql`delete from job_market_events where source_id=${sourceId}`;
      await sql`delete from job_market_source_records where source_id=${sourceId}`;
      await sql`delete from job_market_post_locations where post_id in(select id from job_market_posts where company_id=${company.id})`;
      await sql`delete from job_market_posts where company_id=${company.id}`;
      await sql`delete from job_market_campaigns where company_id=${company.id}`;
      await sql`delete from job_market_sync_runs where source_id=${sourceId}`;
      await sql`delete from job_market_sources where id=${sourceId}`;
    }
    await sql`delete from job_market_companies where id=${company.id}`;
    await sql.end();
  }
});

test("failed completion atomically records diagnostics and releases its own lease", async () => {
  const sql = testDatabase();
  const repository = new PostgresSyncRepository();
  const [company] = await sql<Array<{ id: string }>>`
    insert into job_market_companies(canonical_name,normalized_name,identity_key)
    values('Sync Failure','sync failure',${testId("company")}) returning id
  `;
  let sourceId: string | undefined;

  try {
    sourceId = await repository.createSource({
      companyId: company.id,
      adapter: "greenhouse",
      externalKey: testId("failure"),
      baseUrl: "https://jobs.example.com",
      allowedHosts: ["jobs.example.com"],
      countryCodes: [],
      accessBasis: "public",
      isOfficial: true,
      syncIntervalMinutes: 360,
    });
    await repository.updateSource(sourceId, { status: "active" });
    const claim = await repository.claimOne(
      sourceId,
      "worker-failure",
      "request-failure",
      new Date("2026-09-04T01:00:00Z"),
    );
    const result = {
      discovered: 0,
      created: 0,
      updated: 0,
      stale: 0,
      closed: 0,
      rejected: 0,
      errorCode: "source_timeout",
      errorSummary: "Source request timed out",
    };
    expect(
      await repository.completeFailure(
        claim!,
        new Date("2026-09-04T01:01:00Z"),
        new Date("2026-09-04T01:06:00Z"),
        result,
      ),
    ).toBe(true);
    expect(
      await sql`select source.id from job_market_sources source
        join job_market_sync_runs run on run.source_id=source.id
        where source.id=${sourceId} and source.lease_until is null
          and source.leased_by is null and source.lease_run_id is null
          and source.consecutive_failures=1 and run.id=${claim?.runId}
          and run.status='failed' and run.error_code='source_timeout'`,
    ).toHaveLength(1);

    await repository.updateSource(sourceId, { status: "active" });
    const disabledClaim = await repository.claimOne(
      sourceId,
      "worker-disabled",
      "request-disabled",
      new Date("2026-09-04T01:10:00Z"),
    );
    expect(disabledClaim).not.toBeNull();
    await repository.updateSource(sourceId, { status: "paused" });
    expect(
      await sql`select run.id from job_market_sync_runs run
        join job_market_sources source on source.id=run.source_id
        where run.id=${disabledClaim?.runId} and run.status='failed'
          and run.error_code='source_disabled' and source.status='paused'
          and source.lease_until is null and source.leased_by is null
          and source.lease_run_id is null`,
    ).toHaveLength(1);
    expect(
      await repository.completeFailure(
        disabledClaim!,
        new Date("2026-09-04T01:11:00Z"),
        new Date("2026-09-04T01:16:00Z"),
        result,
      ),
    ).toBe(false);
  } finally {
    if (sourceId) {
      await sql`update job_market_sources set lease_until=null,leased_by=null,lease_run_id=null where id=${sourceId}`.catch(
        () => undefined,
      );
      await sql`delete from job_market_sync_runs where source_id=${sourceId}`;
      await sql`delete from job_market_sources where id=${sourceId}`;
    }
    await sql`delete from job_market_companies where id=${company.id}`;
    await sql.end();
  }
});
