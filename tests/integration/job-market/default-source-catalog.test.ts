import { expect, test } from "@playwright/test";
import { testDatabase, testId } from "../../setup/database";
import { PostgresSourceCatalogRepository } from "@/modules/job-market/infrastructure/postgres-source-catalog-repository";
import type { DefaultSourceCatalogEntry } from "@/modules/job-market/application/default-source-catalog";
import type { DefaultCompanyDirectoryEntry } from "@/modules/job-market/application/default-company-directory";

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
      countryCodes: ["cn"],
      syncIntervalMinutes: 360,
    },
  ];
  const repository = new PostgresSourceCatalogRepository();
  const legacyIdentityKey = `default:${testId("legacy-company")}`;
  const legacyExternalKey = testId("legacy-source");

  try {
    const [legacyCompany] = await sql<Array<{ id: string }>>`
      insert into job_market_companies(canonical_name,normalized_name,identity_key)
      values('Legacy Global Company','legacy global company',${legacyIdentityKey}) returning id`;
    await sql`
      insert into job_market_sources(company_id,adapter,external_key,base_url,allowed_hosts,access_basis,status)
      values(${legacyCompany.id},'greenhouse',${legacyExternalKey},'https://jobs.example.com',array['jobs.example.com'],'public','active')`;
    const first = await repository.initialize(entries, []);
    expect(first).toMatchObject({
      companyCount: 1,
      sourceCount: 1,
      createdCompanies: 1,
      createdSources: 1,
    });
    expect(first.activeSourceIds).toHaveLength(1);
    const [legacy] = await sql<Array<{ status: string }>>`
      select status::text from job_market_sources where external_key=${legacyExternalKey}`;
    expect(legacy.status).toBe("revoked");

    await sql`update job_market_sources set status='paused' where id=${first.activeSourceIds[0]}`;
    const second = await repository.initialize(entries, []);
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
    await sql`delete from job_market_sources where external_key=${legacyExternalKey}`;
    await sql`delete from job_market_companies where identity_key=${identityKey}`;
    await sql`delete from job_market_companies where identity_key=${legacyIdentityKey}`;
    await sql.end();
  }
});

test("directory initialization is idempotent and never creates a sync source", async () => {
  const sql = testDatabase();
  const identityKey = `default:${testId("wechat-company")}`;
  const directoryEntries: DefaultCompanyDirectoryEntry[] = [
    {
      identityKey,
      companyName: "公众号目录测试企业",
      companyType: "民营企业",
      industry: "测试",
      channel: "wechat",
      channelLabel: "公众号搜索：测试企业招聘",
      entryUrl: "https://weixin.sogou.com/weixin?type=1&query=test-company",
    },
  ];
  const repository = new PostgresSourceCatalogRepository();

  try {
    const first = await repository.initialize([], directoryEntries);
    expect(first).toMatchObject({
      companyCount: 1,
      sourceCount: 0,
      directoryCount: 1,
      createdCompanies: 1,
      createdSources: 0,
      createdDirectoryEntries: 1,
      activeSourceIds: [],
    });
    const second = await repository.initialize([], directoryEntries);
    expect(second).toMatchObject({
      createdCompanies: 0,
      createdDirectoryEntries: 0,
    });

    const [entry] = await sql<
      Array<{ listingKind: string; sourceCount: number; url: string }>
    >`
      select campaign.listing_kind as "listingKind",campaign.official_apply_url as url,
        (select count(*)::int from job_market_sources source where source.company_id=company.id) as "sourceCount"
      from job_market_companies company
      join job_market_campaigns campaign on campaign.company_id=company.id
      where company.identity_key=${identityKey}`;
    expect(entry).toEqual({
      listingKind: "recruitment_directory",
      sourceCount: 0,
      url: directoryEntries[0].entryUrl,
    });
  } finally {
    await sql`delete from job_market_campaigns where company_id in(select id from job_market_companies where identity_key=${identityKey})`;
    await sql`delete from job_market_companies where identity_key=${identityKey}`;
    await sql.end();
  }
});
