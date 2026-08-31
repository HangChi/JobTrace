import { test, expect } from "@playwright/test";
import {
  testDatabase,
  testId,
  createTestUser,
  cleanupTestUsers,
} from "../../setup/database";
import { PostgresCampaignQuery } from "@/modules/job-market/infrastructure/postgres-campaign-query";
test("campaign query aggregates child positions and locations while combining filters", async () => {
  const sql = testDatabase(),
    owner = testId("query-owner");
  await createTestUser(sql, owner);
  const [company] = await sql<
    Array<{ id: string }>
  >`insert into job_market_companies(canonical_name,normalized_name,identity_key) values('Query Company','query company',${testId("company")}) returning id`;
  const [source] = await sql<
    Array<{ id: string }>
  >`insert into job_market_sources(company_id,adapter,external_key,base_url,allowed_hosts,access_basis,status,last_success_at) values(${company.id},'greenhouse',${testId("source")},'https://jobs.example.com',array['jobs.example.com'],'public','active',now()) returning id`;
  const [campaign] = await sql<
    Array<{ id: string }>
  >`insert into job_market_campaigns(company_id,campaign_key,name,recruitment_type,last_confirmed_at) values(${company.id},'query-campaign','2027 Campus','campus',now()) returning id`;
  const [a, b] = await sql<
    Array<{ id: string }>
  >`insert into job_market_posts(company_id,campaign_id,title,normalized_title,content_hash,primary_apply_url) values(${company.id},${campaign.id},'Frontend Engineer','frontend engineer',${"a".repeat(64)},'https://jobs.example.com/a'),(${company.id},${campaign.id},'Backend Engineer','backend engineer',${"b".repeat(64)},'https://jobs.example.com/b') returning id`;
  const [sh] = await sql<
    Array<{ id: string }>
  >`insert into job_market_locations(normalized_key,display_name) values(${testId("sh")},'Shanghai') returning id`;
  const [hz] = await sql<
    Array<{ id: string }>
  >`insert into job_market_locations(normalized_key,display_name) values(${testId("hz")},'Hangzhou') returning id`;
  await sql`insert into job_market_post_locations(post_id,location_id) values(${a.id},${sh.id}),(${b.id},${hz.id})`;
  await sql`insert into job_market_source_records(source_id,external_job_id,post_id,payload_hash) values(${source.id},'a',${a.id},${"a".repeat(64)}),(${source.id},'b',${b.id},${"b".repeat(64)})`;
  const repo = new PostgresCampaignQuery();
  try {
    const result = await repo.list(owner, {
      q: "Backend",
      location: "Hangzhou",
      recruitmentType: "campus",
      status: "open",
      page: 1,
      limit: 20,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].positions).toEqual([
      "Backend Engineer",
      "Frontend Engineer",
    ]);
    expect(result.items[0].locations.map((item) => item.name)).toEqual([
      "Hangzhou",
      "Shanghai",
    ]);
    expect(result.items[0].applyMode).toBe("select");
    await sql`update job_market_posts set status='closed' where id=${b.id}`;
    const withoutClosed = await repo.list(owner, { page: 1, limit: 20 });
    expect(withoutClosed.items[0].positions).toEqual(["Frontend Engineer"]);
    expect(withoutClosed.items[0].locations.map((item) => item.name)).toEqual([
      "Shanghai",
    ]);
    const closedSearch = await repo.list(owner, {
      q: "Backend",
      page: 1,
      limit: 20,
    });
    expect(closedSearch.total).toBe(0);
    await sql`update job_market_sources set status='revoked' where id=${source.id}`;
    const hidden = await repo.list(owner, { page: 1, limit: 20 });
    expect(hidden).toMatchObject({ total: 0, items: [] });
  } finally {
    await sql`delete from job_market_source_records where source_id=${source.id}`;
    await sql`delete from job_market_post_locations where post_id in(${a.id},${b.id})`;
    await sql`delete from job_market_locations where id in(${sh.id},${hz.id})`;
    await sql`delete from job_market_posts where campaign_id=${campaign.id}`;
    await sql`delete from job_market_campaigns where id=${campaign.id}`;
    await sql`delete from job_market_sources where id=${source.id}`;
    await sql`delete from job_market_companies where id=${company.id}`;
    await cleanupTestUsers(sql, [owner]);
  }
});
