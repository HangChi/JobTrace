import postgres from "postgres";

const { seedJobMarketPerformance } = await import("./job-market-seed" + ".ts");

function p95(values: number[]) {
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
}

async function measure(
  name: string,
  maximumMs: number,
  operation: () => Promise<unknown>,
) {
  const values: number[] = [];
  for (let run = 0; run < 9; run += 1) {
    const started = performance.now();
    await operation();
    values.push(performance.now() - started);
  }
  const percentile = p95(values);
  console.log(`${name}: p95=${percentile.toFixed(2)}ms`);
  if (percentile > maximumMs)
    throw new Error(`${name} exceeds ${maximumMs}ms performance gate`);
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 12 });
const rollback = new Error("ROLLBACK_JOB_MARKET_PERFORMANCE");
try {
  await sql.begin(async (tx) => {
    await seedJobMarketPerformance(tx);
    await measure(
      "job-market-campaign-read",
      500,
      () => tx`
      select campaign.id,company.canonical_name,
        (select array_agg(distinct post.title order by post.title) from job_market_posts post where post.campaign_id=campaign.id) positions
      from job_market_campaigns campaign join job_market_companies company on company.id=campaign.company_id
      order by campaign.last_confirmed_at desc,campaign.id limit 20`,
    );
    await measure(
      "job-market-filter",
      500,
      () => tx`
      select campaign.id from job_market_campaigns campaign
      where exists(select 1 from job_market_posts post where post.campaign_id=campaign.id and post.normalized_title like '%role 42%')
      order by campaign.id limit 20`,
    );
    await measure(
      "job-market-favorite-write",
      1000,
      () => tx`
      insert into job_market_campaign_favorites(owner_id,campaign_id)
      values('job-market-perf-owner','30000000-0000-4000-8000-000000000001')
      on conflict do nothing`,
    );
    await measure("job-market-concurrent-source-claim", 1000, () =>
      Promise.all(
        Array.from(
          { length: 8 },
          (_, index) => tx`
          update job_market_sources set leased_by=${`perf-worker-${index}`},lease_until=now()+interval '5 minutes'
          where id in(select id from job_market_sources where status='active' and (lease_until is null or lease_until<now()) order by id for update skip locked limit 1)`,
        ),
      ),
    );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await sql.end();
}
