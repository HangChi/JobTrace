import type postgres from "postgres";
import { testId } from "../setup/database";

type Sql = ReturnType<typeof postgres>;

export async function seedJobMarketCampaign(
  sql: Sql,
  options: {
    companyName: string;
    campaignName?: string;
    status?: "open" | "stale" | "closed";
    jobs: Array<{
      title: string;
      location?: string;
      applyUrl?: string | null;
      status?: "open" | "stale" | "closed";
    }>;
  },
) {
  const marker = testId("e2e-market");
  const [company] = await sql<Array<{ id: string }>>`
    insert into job_market_companies(canonical_name,normalized_name,identity_key)
    values(${options.companyName},${options.companyName.toLowerCase()},${marker}) returning id`;
  const [source] = await sql<Array<{ id: string }>>`
    insert into job_market_sources(company_id,adapter,external_key,base_url,allowed_hosts,access_basis,status,last_success_at)
    values(${company.id},'greenhouse',${marker},'https://jobs.example.com',array['jobs.example.com'],'public','active',now()) returning id`;
  const [campaign] = await sql<Array<{ id: string }>>`
    insert into job_market_campaigns(company_id,campaign_key,name,status,last_confirmed_at)
    values(${company.id},${marker},${options.campaignName ?? "2027 秋招"},${options.status ?? "open"},now()) returning id`;
  const posts: Array<{ id: string; title: string }> = [];
  for (const [index, job] of options.jobs.entries()) {
    const applyUrl =
      job.applyUrl === undefined
        ? `https://jobs.example.com/apply/${index}`
        : job.applyUrl?.startsWith("https://")
          ? job.applyUrl
          : null;
    const [post] = await sql<Array<{ id: string; title: string }>>`
      insert into job_market_posts(company_id,campaign_id,title,normalized_title,status,content_hash,primary_apply_url,last_seen_at)
      values(${company.id},${campaign.id},${job.title},${job.title.toLowerCase()},${job.status ?? options.status ?? "open"},${String(index).padStart(64, "0")},${applyUrl},now()) returning id,title`;
    posts.push(post);
    await sql`insert into job_market_source_records(source_id,external_job_id,post_id,external_apply_url,payload_hash)
      values(${source.id},${`${marker}-${index}`},${post.id},${applyUrl},${String(index).padStart(64, "0")})`;
    if (job.location) {
      const [location] = await sql<Array<{ id: string }>>`
        insert into job_market_locations(normalized_key,display_name)
        values(${`${marker}-${job.location}`},${job.location})
        on conflict(normalized_key) do update set display_name=excluded.display_name returning id`;
      await sql`insert into job_market_post_locations(post_id,location_id)
        values(${post.id},${location.id})`;
    }
  }
  return { company, source, campaign, posts };
}

export async function cleanupJobMarketCampaign(
  sql: Sql,
  seeded: Awaited<ReturnType<typeof seedJobMarketCampaign>>,
) {
  await sql`delete from job_market_events where source_id=${seeded.source.id}`;
  await sql`delete from job_market_source_records where source_id=${seeded.source.id}`;
  await sql`delete from job_market_post_locations where post_id=any(${seeded.posts.map((item) => item.id)}::uuid[])`;
  await sql`delete from job_market_locations where id not in(select location_id from job_market_post_locations)`;
  await sql`delete from application_job_market_links where post_id=any(${seeded.posts.map((item) => item.id)}::uuid[])`;
  await sql`delete from job_market_posts where campaign_id=${seeded.campaign.id}`;
  await sql`delete from job_market_campaign_favorites where campaign_id=${seeded.campaign.id}`;
  await sql`delete from job_market_campaigns where id=${seeded.campaign.id}`;
  await sql`delete from job_market_sync_runs where source_id=${seeded.source.id}`;
  await sql`delete from job_market_sources where id=${seeded.source.id}`;
  await sql`delete from job_market_companies where id=${seeded.company.id}`;
}
