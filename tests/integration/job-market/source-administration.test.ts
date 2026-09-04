import { test, expect } from "@playwright/test";
import { testDatabase, testId } from "../../setup/database";
import { PostgresSyncRepository } from "@/modules/job-market/infrastructure/postgres-sync-repository";

test("source administration preserves uniqueness, scheduling, retry independence and safe diagnostics", async () => {
  const sql = testDatabase();
  const [company] = await sql<Array<{ id: string }>>`
    insert into job_market_companies(canonical_name,normalized_name,identity_key)
    values('Source Admin','source admin',${testId("company")}) returning id`;
  const repository = new PostgresSyncRepository();
  const externalKey = testId("external");
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
    await expect(
      repository.createSource({
        companyId: company.id,
        adapter: "greenhouse",
        externalKey,
        baseUrl: "https://jobs.example.com",
        allowedHosts: ["jobs.example.com"],
        countryCodes: [],
        accessBasis: "public",
        isOfficial: true,
        syncIntervalMinutes: 360,
      }),
    ).rejects.toMatchObject({ code: "23505" });

    await repository.updateSource(sourceId, { status: "active" });
    const claimedAt = new Date();
    const claim = await repository.claimOne(
      sourceId,
      "worker-a",
      "request-safe",
      claimedAt,
    );
    expect(claim?.source.id).toBe(sourceId);
    const [lease] = await sql<Array<{ leaseUntil: Date }>>`
      select lease_until as "leaseUntil" from job_market_sources where id=${sourceId}`;
    expect(
      lease.leaseUntil.getTime() - claimedAt.getTime(),
    ).toBeGreaterThanOrEqual(29 * 60_000);
    expect(
      await repository.claimOne(
        sourceId,
        "worker-b",
        "request-blocked",
        new Date(),
      ),
    ).toBeNull();
    await repository.completeFailure(
      claim!,
      new Date(claimedAt.getTime() + 60_000),
      new Date(claimedAt.getTime() + 10 * 60_000),
      {
        discovered: 0,
        created: 0,
        updated: 0,
        stale: 0,
        closed: 0,
        rejected: 0,
        errorCode: "timeout",
        errorSummary: "来源请求超时。",
      },
    );
    const runs = await repository.listRuns(sourceId, 1, 20);
    expect(runs.items[0]).toMatchObject({
      id: claim?.runId,
      sourceId,
      errorCode: "timeout",
      errorSummary: "来源请求超时。",
    });
    expect(JSON.stringify(runs)).not.toMatch(
      /jobs\.example|authorization|payload/i,
    );

    await repository.updateSource(sourceId, { status: "paused" });
    expect(
      await repository.claimOne(
        sourceId,
        "worker-c",
        "request-paused",
        new Date(),
      ),
    ).toBeNull();
    await repository.updateSource(sourceId, { status: "revoked" });
    expect(
      await repository.claimOne(
        sourceId,
        "worker-c",
        "request-revoked",
        new Date(),
      ),
    ).toBeNull();
  } finally {
    if (sourceId) {
      await sql`delete from job_market_sync_runs where source_id=${sourceId}`;
      await sql`delete from job_market_sources where id=${sourceId}`;
    }
    await sql`delete from job_market_companies where id=${company.id}`;
    await sql.end();
  }
});
