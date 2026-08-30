import { expect, test } from "@playwright/test";
import { testDatabase, testId } from "../../setup/database";
import { PostgresSourceCatalogRepository } from "@/modules/job-market/infrastructure/postgres-source-catalog-repository";
import type { DefaultSourceCatalogEntry } from "@/modules/job-market/application/default-source-catalog";

test("default source initialization is idempotent and preserves operator state", async () => {
  const sql = testDatabase();
  const identityKey = testId("default-company");
  const externalKey = testId("default-source");
  const entries: DefaultSourceCatalogEntry[] = [
    {
      identityKey,
      companyName: "默认目录测试企业",
      companyType: "科技企业",
      industry: "测试",
      websiteUrl: "https://company.example.com/",
      adapter: "greenhouse",
      externalKey,
      baseUrl: "https://jobs.example.com/",
      allowedHosts: ["jobs.example.com"],
      syncIntervalMinutes: 360,
    },
  ];
  const repository = new PostgresSourceCatalogRepository();

  try {
    const first = await repository.initialize(entries);
    expect(first).toMatchObject({
      companyCount: 1,
      sourceCount: 1,
      createdCompanies: 1,
      createdSources: 1,
    });
    expect(first.activeSourceIds).toHaveLength(1);

    await sql`update job_market_sources set status='paused' where id=${first.activeSourceIds[0]}`;
    const second = await repository.initialize(entries);
    expect(second).toMatchObject({
      createdCompanies: 0,
      createdSources: 0,
      activeSourceIds: [],
    });

    const [counts] = await sql<Array<{ companies: number; sources: number }>>`
      select
        (select count(*)::int from job_market_companies where identity_key=${identityKey}) companies,
        (select count(*)::int from job_market_sources where external_key=${externalKey}) sources`;
    expect(counts).toEqual({ companies: 1, sources: 1 });
  } finally {
    await sql`delete from job_market_sources where external_key=${externalKey}`;
    await sql`delete from job_market_companies where identity_key=${identityKey}`;
    await sql.end();
  }
});
