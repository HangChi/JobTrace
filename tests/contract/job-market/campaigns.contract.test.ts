import { test, expect } from "@playwright/test";
import { testDatabase, testId } from "../../setup/database";
test("authenticated campaign list and detail return aggregated public fields", async ({
  request,
}) => {
  const sql = testDatabase();
  const [user] = await sql<
    Array<{ id: string }>
  >`select id from users where username='playwright_user'`;
  expect(user).toBeTruthy();
  const [company] = await sql<
    Array<{ id: string }>
  >`insert into job_market_companies(canonical_name,normalized_name,identity_key) values('Contract Market','contract market',${testId("company")}) returning id`;
  const [source] = await sql<
    Array<{ id: string }>
  >`insert into job_market_sources(company_id,adapter,external_key,base_url,allowed_hosts,access_basis,status,last_success_at) values(${company.id},'greenhouse',${testId("source")},'https://jobs.example.com',array['jobs.example.com'],'public','active',now()) returning id`;
  const [campaign] = await sql<
    Array<{ id: string }>
  >`insert into job_market_campaigns(company_id,campaign_key,name,last_confirmed_at) values(${company.id},'contract-campaign','Contract Campaign',now()) returning id`;
  const [post] = await sql<
    Array<{ id: string }>
  >`insert into job_market_posts(company_id,campaign_id,title,normalized_title,content_hash,primary_apply_url) values(${company.id},${campaign.id},'Contract Engineer','contract engineer',${"c".repeat(64)},'https://jobs.example.com/apply') returning id`;
  await sql`insert into job_market_source_records(source_id,external_job_id,post_id,payload_hash) values(${source.id},'contract-job',${post.id},${"c".repeat(64)})`;
  try {
    const list = await request.get(
      "/api/job-market/campaigns?q=Contract&limit=20",
    );
    expect(list.status()).toBe(200);
    expect(await list.json()).toMatchObject({
      items: [
        {
          id: campaign.id,
          company: { name: "Contract Market" },
          positions: ["Contract Engineer"],
          positionCount: 1,
          applyMode: "single",
          source: { url: "https://jobs.example.com" },
          isFavorite: false,
        },
      ],
      page: 1,
      limit: 20,
    });
    const detail = await request.get(
      `/api/job-market/campaigns/${campaign.id}`,
    );
    expect(detail.status()).toBe(200);
    expect(await detail.json()).toMatchObject({
      id: campaign.id,
      jobs: [
        {
          id: post.id,
          title: "Contract Engineer",
          applyUrl: "https://jobs.example.com/apply",
          alreadyTrackedApplicationId: null,
        },
      ],
    });
    expect(
      (await request.get("/api/job-market/campaigns?limit=1000")).status(),
    ).toBe(400);
  } finally {
    await sql`delete from job_market_source_records where source_id=${source.id}`;
    await sql`delete from job_market_posts where id=${post.id}`;
    await sql`delete from job_market_campaigns where id=${campaign.id}`;
    await sql`delete from job_market_sources where id=${source.id}`;
    await sql`delete from job_market_companies where id=${company.id}`;
    await sql.end();
  }
});
