import { getJobMarketEnv } from "@/shared/config/env";
import { createSecureSourceClient } from "../infrastructure/secure-source-client.server";
import { SourceAdapterRegistry } from "../infrastructure/source-adapter-registry";
import { GreenhouseAdapter } from "../infrastructure/adapters/greenhouse-adapter";
import { LeverAdapter } from "../infrastructure/adapters/lever-adapter";
import { AshbyAdapter } from "../infrastructure/adapters/ashby-adapter";
import { SmartRecruitersAdapter } from "../infrastructure/adapters/smartrecruiters-adapter";
import { MokaAdapter } from "../infrastructure/adapters/moka-adapter";
import { SchemaOrgAdapter } from "../infrastructure/adapters/schema-org-adapter";
import { XiaomiAdapter } from "../infrastructure/adapters/xiaomi-adapter";
import { FeishuAdapter } from "../infrastructure/adapters/feishu-adapter";
import { BeisenAdapter } from "../infrastructure/adapters/beisen-adapter";
import { WorkdayAdapter } from "../infrastructure/adapters/workday-adapter";
import {
  DayeeAdapter,
  HtmlListAdapter,
  Job51Adapter,
} from "../infrastructure/adapters/html-list-adapter";
import { ChinaBigTechAdapter } from "../infrastructure/adapters/china-bigtech-adapter";
import { PostgresSyncRepository } from "../infrastructure/postgres-sync-repository";
import { PostgresJobMarketRepository } from "../infrastructure/postgres-job-market-repository";
import { synchronizeSource } from "./synchronize-source";

function productionDependencies() {
  const fetcher = createSecureSourceClient();
  return {
    syncRepository: new PostgresSyncRepository(),
    jobRepository: new PostgresJobMarketRepository(),
    adapters: new SourceAdapterRegistry([
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
    ]),
  };
}

export async function synchronizeDueSources(
  limit?: number,
  requestId = crypto.randomUUID(),
) {
  const env = getJobMarketEnv();
  const dependencies = productionDependencies();
  const sources = await dependencies.syncRepository.claimDue(
    Math.min(limit ?? env.syncBatchSize, env.syncBatchSize),
    env.workerId,
    new Date(),
  );
  const results = await Promise.all(
    sources.map((source) =>
      synchronizeSource({
        source,
        trigger: "scheduled",
        requestId,
        workerId: env.workerId,
        adapter: dependencies.adapters.get(source.adapter),
        syncRepository: dependencies.syncRepository,
        jobRepository: dependencies.jobRepository,
      }),
    ),
  );
  return {
    claimed: results.length,
    succeeded: results.filter((item) => item.status === "succeeded").length,
    partial: results.filter((item) => item.status === "partial").length,
    failed: results.filter((item) => item.status === "failed").length,
    runIds: results.map((item) => item.runId),
  };
}

export async function synchronizeOneSource(
  sourceId: string,
  requestId = crypto.randomUUID(),
) {
  const env = getJobMarketEnv();
  const dependencies = productionDependencies();
  const source = await dependencies.syncRepository.claimOne(
    sourceId,
    env.workerId,
    new Date(),
  );
  if (!source)
    return {
      accepted: false,
      runId: null,
      status: null,
      reason: "source_unavailable_or_leased",
    };
  const result = await synchronizeSource({
    source,
    trigger: "admin",
    requestId,
    workerId: env.workerId,
    adapter: dependencies.adapters.get(source.adapter),
    syncRepository: dependencies.syncRepository,
    jobRepository: dependencies.jobRepository,
  });
  return {
    accepted: true,
    runId: result.runId,
    status: result.status,
    reason: null,
  };
}
