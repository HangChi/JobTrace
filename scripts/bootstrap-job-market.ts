// 离线 bootstrap：应用停机时把默认目录写入数据库并完成首轮岗位同步。
// 不经过 synchronize-due-sources（其依赖 next/cache 的缓存失效，需要请求上下文）；
// 停机状态下不存在进程内缓存，服务重启后自然读到新数据。
// 运行：DATABASE_URL=... JITI_TSCONFIG_PATHS=true pnpm jiti scripts/bootstrap-job-market.ts
// 注意：src/shared/database 的 server-only 标记需临时桩化后运行并还原。
import postgres from "postgres";
import { PostgresSourceCatalogRepository } from "../src/modules/job-market/infrastructure/postgres-source-catalog-repository";
import { PostgresSyncRepository } from "../src/modules/job-market/infrastructure/postgres-sync-repository";
import { PostgresJobMarketRepository } from "../src/modules/job-market/infrastructure/postgres-job-market-repository";
import { createSecureSourceClient } from "../src/modules/job-market/infrastructure/secure-source-client.server";
import { SourceAdapterRegistry } from "../src/modules/job-market/infrastructure/source-adapter-registry";
import { GreenhouseAdapter } from "../src/modules/job-market/infrastructure/adapters/greenhouse-adapter";
import { LeverAdapter } from "../src/modules/job-market/infrastructure/adapters/lever-adapter";
import { AshbyAdapter } from "../src/modules/job-market/infrastructure/adapters/ashby-adapter";
import { SmartRecruitersAdapter } from "../src/modules/job-market/infrastructure/adapters/smartrecruiters-adapter";
import { MokaAdapter } from "../src/modules/job-market/infrastructure/adapters/moka-adapter";
import { SchemaOrgAdapter } from "../src/modules/job-market/infrastructure/adapters/schema-org-adapter";
import { XiaomiAdapter } from "../src/modules/job-market/infrastructure/adapters/xiaomi-adapter";
import { FeishuAdapter } from "../src/modules/job-market/infrastructure/adapters/feishu-adapter";
import { BeisenAdapter } from "../src/modules/job-market/infrastructure/adapters/beisen-adapter";
import { WorkdayAdapter } from "../src/modules/job-market/infrastructure/adapters/workday-adapter";
import {
  DayeeAdapter,
  HtmlListAdapter,
  Job51Adapter,
} from "../src/modules/job-market/infrastructure/adapters/html-list-adapter";
import { ChinaBigTechAdapter } from "../src/modules/job-market/infrastructure/adapters/china-bigtech-adapter";
import { synchronizeSource } from "../src/modules/job-market/application/synchronize-source";
import { DEFAULT_SOURCE_CATALOG } from "../src/modules/job-market/application/default-source-catalog";
import { DEFAULT_COMPANY_DIRECTORY } from "../src/modules/job-market/application/default-company-directory";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const initialized = await new PostgresSourceCatalogRepository().initialize(
  DEFAULT_SOURCE_CATALOG,
  DEFAULT_COMPANY_DIRECTORY,
);
console.log(
  `initialized: companies=${initialized.companyCount} sources=${initialized.sourceCount} ` +
    `createdCompanies=${initialized.createdCompanies} createdSources=${initialized.createdSources} ` +
    `directory=${initialized.directoryCount} createdDirectoryEntries=${initialized.createdDirectoryEntries} ` +
    `activeSources=${initialized.activeSourceIds.length}`,
);

const workerId = "bootstrap-script";
const fetcher = createSecureSourceClient();
const adapters = new SourceAdapterRegistry([
  new GreenhouseAdapter(fetcher),
  new LeverAdapter(fetcher),
  new AshbyAdapter(fetcher),
  new SmartRecruitersAdapter(fetcher),
  new MokaAdapter(fetcher),
  new SchemaOrgAdapter(fetcher),
  new XiaomiAdapter(fetcher),
  new FeishuAdapter(fetcher),
  new BeisenAdapter(fetcher),
  new DayeeAdapter(fetcher),
  new WorkdayAdapter(fetcher),
  new Job51Adapter(fetcher),
  new ChinaBigTechAdapter(fetcher),
  new HtmlListAdapter(fetcher),
]);
const syncRepository = new PostgresSyncRepository();
const jobRepository = new PostgresJobMarketRepository();

const monitor = postgres(process.env.DATABASE_URL, { max: 1 });
let round = 0;
let succeeded = 0;
let partial = 0;
let failed = 0;

async function syncPass(label: string) {
  while (true) {
    const claims = await syncRepository.claimDue(
      10,
      workerId,
      `bootstrap-${round}`,
      new Date(),
    );
    if (!claims.length) break;
    round++;
    const results = await Promise.all(
      claims.map((claim) =>
        synchronizeSource({
          claim,
          requestId: `bootstrap-${round}`,
          adapter: adapters.get(claim.source.adapter),
          syncRepository,
          jobRepository,
        }),
      ),
    );
    succeeded += results.filter((item) => item.status === "succeeded").length;
    partial += results.filter((item) => item.status === "partial").length;
    failed += results.filter((item) => item.status === "failed").length;
    console.log(
      `${label} round ${round}: claimed=${claims.length} ok=${succeeded + partial} ` +
        `(succeeded=${succeeded} partial=${partial}) failed=${failed}`,
    );
  }
}

await syncPass("pass1");
// 失败退避最短 5 分钟，单趟循环等不到重试；重置退避再跑一趟，
// 仍失败的即真实不可用来源，留给线上定时器按指数退避处理。
await monitor`update job_market_sources set next_sync_at=now(),lease_until=null,leased_by=null,lease_run_id=null
  where status='active' and consecutive_failures>=1`;
succeeded = partial = failed = 0;
await syncPass("pass2");

const [final] = await monitor`
  select
    (select count(*)::int from job_market_sources where status='active') as active_sources,
    (select count(*)::int from job_market_sources where consecutive_failures>=3) as broken_sources,
    (select count(*)::int from job_market_campaigns where listing_kind='recruitment_directory' and status='open') as directory_campaigns,
    (select count(*)::int from job_market_campaigns where listing_kind<>'recruitment_directory' and status='open') as job_campaigns`;
await monitor.end();
console.log("final state:", JSON.stringify(final));
console.log("bootstrap complete");
