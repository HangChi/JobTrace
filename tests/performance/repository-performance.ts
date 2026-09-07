import { createJiti } from "jiti";
import postgres from "postgres";

const maximumMs = 500;
const runs = 9;

type Page<T> = { total: number; items: T[] };
type ApplicationPerformanceItem = { stages: string[] };
type InterviewPerformanceItem = { questionCount: number; actionCount: number };
type AnalyticsPerformanceData = {
  current: { metrics: { applications: number } };
};
type CampaignPerformanceItem = { id: string };

function p95(values: number[]) {
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function measure(
  name: string,
  operation: () => Promise<unknown>,
  maximum = maximumMs,
) {
  await operation();
  const timings: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    await operation();
    timings.push(performance.now() - started);
  }
  const percentile = p95(timings);
  console.log(`${name}: p95=${percentile.toFixed(2)}ms`);
  if (percentile > maximum) {
    throw new Error(`${name} exceeds ${maximum}ms performance gate`);
  }
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": `${process.cwd()}/src`,
    "server-only": `${process.cwd()}/tests/setup/server-only.ts`,
  },
});
const [applicationsModule, interviewsModule, analyticsModule, campaignModule] =
  await Promise.all([
    jiti.import<{
      PostgresApplicationRepository: new () => {
        list(
          ownerId: string,
          query: Record<string, unknown>,
        ): Promise<Page<ApplicationPerformanceItem>>;
      };
    }>(
      "../..//src/modules/applications/infrastructure/postgres-application-repository.ts",
    ),
    jiti.import<{
      PostgresInterviewRepository: new () => {
        list(
          ownerId: string,
          query: Record<string, unknown>,
        ): Promise<Page<InterviewPerformanceItem>>;
      };
    }>(
      "../..//src/modules/interviews/infrastructure/postgres-interview-repository.ts",
    ),
    jiti.import<{
      fetchAnalyticsReportData(
        ownerId: string,
        query: Record<string, unknown>,
      ): Promise<AnalyticsPerformanceData>;
    }>(
      "../..//src/modules/analytics/infrastructure/postgres-analytics-report.ts",
    ),
    jiti.import<{
      PostgresCampaignQuery: new () => {
        list(
          ownerId: string,
          query: Record<string, unknown>,
        ): Promise<Page<CampaignPerformanceItem>>;
      };
    }>(
      "../..//src/modules/job-market/infrastructure/postgres-campaign-query.ts",
    ),
  ]);
const { seedJobMarketPerformance } = await jiti.import<{
  seedJobMarketPerformance(sql: unknown): Promise<void>;
}>("./job-market-seed.ts");

const seedSql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const ownerId = "repository-performance-owner";
await seedSql`
  insert into users(id,display_name,email,email_verified,role,username,display_username)
  values(${ownerId},'Repository Performance','repository-performance@example.test',true,'user','repository_performance','repository_performance')
`;
await seedSql`
  insert into applications(owner_id,company_name,position_name,city,applied_date,status,latest_date)
  select ${ownerId},'Repository Company ' || (n % 500),'Role ' || (n % 100),
    (array['上海','北京','深圳','杭州'])[(n % 4)+1],
    date '2026-01-01' + (n % 200),
    case when n % 9=0 then 'refused'::application_status else 'submitted'::application_status end,
    date '2026-01-01' + (n % 200)
  from generate_series(1,10000) n
`;
await seedSql`
  insert into application_stage_occurrences(application_id,stage,occurred_on)
  select id,'screening',applied_date from applications where owner_id=${ownerId}
`;
await seedSql`
  insert into interview_reviews(owner_id,application_id,stage_occurrence_id,stage_snapshot,interviewed_on,status,round_result)
  select ${ownerId},a.id,s.id,'interview_1',a.applied_date,
    case when row_number() over(order by a.id) % 3=0 then 'completed'::review_status else 'pending_review'::review_status end,
    case when row_number() over(order by a.id) % 4=0 then 'passed'::round_result else 'pending'::round_result end
  from applications a
  join application_stage_occurrences s on s.application_id=a.id
  where a.owner_id=${ownerId}
`;
await seedSql`
  insert into interview_questions(interview_review_id,sort_order,category,question)
  select id,0,'technical','Repository Question ' || row_number() over(order by id)
  from interview_reviews where owner_id=${ownerId}
`;
await seedSql`
  insert into interview_action_items(interview_review_id,sort_order,content)
  select id,0,'Repository action'
  from interview_reviews where owner_id=${ownerId}
`;
await seedJobMarketPerformance(seedSql);
await seedSql.end();

const applicationRepository =
  new applicationsModule.PostgresApplicationRepository();
const interviewRepository = new interviewsModule.PostgresInterviewRepository();
const campaignRepository = new campaignModule.PostgresCampaignQuery();
const applicationQuery = {
  q: "repository company 12",
  status: ["submitted"],
  type: [],
  stage: ["screening"],
  city: ["上海"],
  sort: "latestDate",
  defaultOrder: false,
  direction: "desc",
  page: 1,
  limit: 50,
};
const interviewQuery = {
  q: "question 42",
  status: [],
  stage: [],
  result: [],
  page: 1,
  limit: 50,
};
const analyticsQuery = {
  period: "all",
  hasCityFilter: false,
  granularity: "month",
};

await measure("repository-application-list", async () => {
  const page = await applicationRepository.list(ownerId, applicationQuery);
  assert(page.total > 0, "application repository returned no matches");
  assert(
    page.items.length > 0,
    "application repository returned an empty page",
  );
  assert(
    page.items.every((item) => item.stages.includes("screening")),
    "application stages were not assembled",
  );
});
await measure("repository-interview-list", async () => {
  const page = await interviewRepository.list(ownerId, interviewQuery);
  assert(page.total > 0, "interview repository returned no matches");
  assert(
    page.items.every(
      (item) => item.questionCount === 1 && item.actionCount === 1,
    ),
    "interview child counts are incorrect",
  );
});
await measure("repository-analytics-report", async () => {
  const report = await analyticsModule.fetchAnalyticsReportData(
    ownerId,
    analyticsQuery,
  );
  assert(
    report.current.metrics.applications === 10000,
    "analytics cohort count is incorrect",
  );
});
await measure("repository-job-market-list", async () => {
  const page = await campaignRepository.list("job-market-perf-owner", {
    q: "role 42",
    page: 1,
    limit: 20,
  });
  assert(page.total === 100, "campaign repository company count is incorrect");
  assert(
    page.items.length === 20,
    "campaign repository page size is incorrect",
  );
});

const refreshSql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
});
await measure(
  "repository-job-market-refresh",
  () =>
    refreshSql`select public.refresh_job_market_company_read_model('10000000-0000-4000-8000-000000000001')`,
  1000,
);
await refreshSql.end();

const databaseModule = await jiti.import<{
  createServerDatabase(): { end(): Promise<void> };
}>("../..//src/shared/database/postgres.server.ts");
await databaseModule.createServerDatabase().end();
