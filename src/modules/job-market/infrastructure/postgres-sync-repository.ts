import { createServerDatabase } from "@/shared/database";
import type {
  SyncClaim,
  SyncRepository,
  SyncResult,
} from "../application/ports";
import type { JobMarketSource } from "../domain/entities";

type SourceRow = {
  id: string;
  companyId: string;
  companyName: string;
  adapter: JobMarketSource["adapter"];
  externalKey: string;
  baseUrl: string;
  allowedHosts: string[];
  countryCodes: string[];
  isOfficial: boolean;
  accessBasis: "public" | "authorized";
  status: JobMarketSource["status"];
  syncIntervalMinutes: number;
  consecutiveFailures: number;
  etag: string | null;
  lastModified: string | null;
};
const selectSource = `select source.id,source.company_id as "companyId",company.canonical_name as "companyName",source.adapter,
source.external_key as "externalKey",source.base_url as "baseUrl",source.allowed_hosts as "allowedHosts",source.is_official as "isOfficial",
source.country_codes as "countryCodes",
source.access_basis as "accessBasis",source.status,source.sync_interval_minutes as "syncIntervalMinutes",source.consecutive_failures as "consecutiveFailures",source.etag,source.last_modified as "lastModified"
from job_market_sources source join job_market_companies company on company.id=source.company_id`;
const SOURCE_LEASE_MS = 30 * 60_000;

type ClaimRow = { id: string; leaseRunId: string | null };

export class PostgresSyncRepository implements SyncRepository {
  constructor(private readonly sql = createServerDatabase()) {}
  async claimDue(
    limit: number,
    workerId: string,
    requestId: string,
    now: Date,
  ) {
    return this.sql.begin(async (tx) => {
      const rows = await tx<ClaimRow[]>`
        select id,lease_run_id as "leaseRunId"
        from job_market_sources where status='active' and next_sync_at<=${now}
        and (lease_until is null or lease_until<${now}) order by next_sync_at,id for update skip locked limit ${limit}`;
      const claims: SyncClaim[] = [];
      for (const row of rows) {
        if (row.leaseRunId) {
          await tx`update job_market_sync_runs set status='failed',finished_at=greatest(started_at,${now}),error_code='lease_expired',error_summary='The source lease expired before completion.' where id=${row.leaseRunId} and status='running'`;
        }
        const [run] = await tx<
          Array<{ id: string }>
        >`insert into job_market_sync_runs(source_id,trigger,worker_id,request_id,started_at)
          values(${row.id},'scheduled',${workerId},${requestId},${now}) returning id`;
        await tx`update job_market_sources set lease_until=${new Date(now.getTime() + SOURCE_LEASE_MS)},leased_by=${workerId},lease_run_id=${run.id},last_attempt_at=${now} where id=${row.id}`;
        const [source] = await tx.unsafe<SourceRow[]>(
          `${selectSource} where source.id=$1`,
          [row.id],
        );
        claims.push({ source, runId: run.id, workerId });
      }
      return claims;
    });
  }
  async claimOne(
    sourceId: string,
    workerId: string,
    requestId: string,
    now: Date,
  ) {
    const claimed = await this.sql.begin(async (tx) => {
      const rows = await tx<ClaimRow[]>`
        select id,lease_run_id as "leaseRunId"
        from job_market_sources where id=${sourceId} and status='active'
        and (lease_until is null or lease_until<${now}) for update skip locked`;
      if (!rows.length) return [];
      const [row] = rows;
      if (row.leaseRunId) {
        await tx`update job_market_sync_runs set status='failed',finished_at=greatest(started_at,${now}),error_code='lease_expired',error_summary='The source lease expired before completion.' where id=${row.leaseRunId} and status='running'`;
      }
      const [run] = await tx<
        Array<{ id: string }>
      >`insert into job_market_sync_runs(source_id,trigger,worker_id,request_id,started_at)
        values(${sourceId},'admin',${workerId},${requestId},${now}) returning id`;
      await tx`update job_market_sources set lease_until=${new Date(now.getTime() + SOURCE_LEASE_MS)},leased_by=${workerId},lease_run_id=${run.id},last_attempt_at=${now} where id=${sourceId}`;
      const [source] = await tx.unsafe<SourceRow[]>(
        `${selectSource} where source.id=$1`,
        [sourceId],
      );
      return [{ source, runId: run.id, workerId } satisfies SyncClaim];
    });
    return claimed[0] ?? null;
  }
  async completeFailure(
    claim: SyncClaim,
    now: Date,
    retryAt: Date,
    result: SyncResult,
  ) {
    return this.sql.begin(async (tx) => {
      const owned = await tx<Array<{ id: string }>>`
        select id from job_market_sources
        where id=${claim.source.id} and status='active'
          and leased_by=${claim.workerId} and lease_run_id=${claim.runId}
        for update`;
      if (!owned.length) return false;
      const run = await tx<Array<{ id: string }>>`
        update job_market_sync_runs set status='failed',finished_at=greatest(started_at,${now}),
          discovered_count=${result.discovered},created_count=${result.created},
          updated_count=${result.updated},stale_count=${result.stale},
          closed_count=${result.closed},rejected_count=${result.rejected},
          error_code=${result.errorCode ?? null},error_summary=${result.errorSummary ?? null}
        where id=${claim.runId} and source_id=${claim.source.id}
          and worker_id=${claim.workerId} and status='running'
        returning id`;
      if (!run.length) return false;
      await tx`update job_market_sources set
        consecutive_failures=consecutive_failures+1,next_sync_at=${retryAt},
        lease_until=null,leased_by=null,lease_run_id=null,updated_at=${now}
        where id=${claim.source.id} and lease_run_id=${claim.runId}`;
      return true;
    });
  }

  async listSources() {
    return this.sql<Array<any>>`
      select source.id,jsonb_build_object('id',company.id,'name',company.canonical_name,'type',company.company_type,'industry',company.industry) as company,
        source.adapter::text,source.base_url as "baseUrl",source.status::text,source.next_sync_at as "nextSyncAt",source.last_attempt_at as "lastAttemptAt",
        source.last_success_at as "lastSuccessAt",source.consecutive_failures as "consecutiveFailures",
        case when run.id is null then null else jsonb_build_object('id',run.id,'sourceId',run.source_id,'trigger',run.trigger,'status',run.status,
          'startedAt',run.started_at,'finishedAt',run.finished_at,'counts',jsonb_build_object('discovered',run.discovered_count,'created',run.created_count,
          'updated',run.updated_count,'stale',run.stale_count,'closed',run.closed_count,'rejected',run.rejected_count),'errorCode',run.error_code,'errorSummary',run.error_summary) end as "latestRun"
      from job_market_sources source join job_market_companies company on company.id=source.company_id
      left join lateral(select r.* from job_market_sync_runs r where r.source_id=source.id order by r.started_at desc limit 1) run on true
      order by company.canonical_name,source.id`;
  }

  async createSource(input: {
    companyId: string;
    adapter: string;
    externalKey: string;
    baseUrl: string;
    allowedHosts: string[];
    countryCodes: string[];
    accessBasis: string;
    isOfficial: boolean;
    syncIntervalMinutes: number;
  }) {
    const [row] = await this.sql<
      Array<{ id: string }>
    >`insert into job_market_sources(company_id,adapter,external_key,base_url,allowed_hosts,country_codes,access_basis,is_official,sync_interval_minutes,status)
      values(${input.companyId},${input.adapter},${input.externalKey},${input.baseUrl},${input.allowedHosts},${input.countryCodes},${input.accessBasis},${input.isOfficial},${input.syncIntervalMinutes},'paused') returning id`;
    return row.id;
  }

  async updateSource(
    id: string,
    input: {
      status?: string;
      syncIntervalMinutes?: number;
      accessBasis?: string;
    },
  ) {
    return this.sql.begin(async (tx) => {
      const [current] = await tx<Array<{ leaseRunId: string | null }>>`
        select lease_run_id as "leaseRunId" from job_market_sources
        where id=${id} for update`;
      if (!current) return false;
      const disablesSource =
        input.status === "paused" || input.status === "revoked";
      if (disablesSource && current.leaseRunId) {
        await tx`update job_market_sync_runs set status='failed',finished_at=greatest(started_at,now()),
          error_code='source_disabled',error_summary='The source was disabled during synchronization.'
          where id=${current.leaseRunId} and status='running'`;
      }
      await tx`update job_market_sources set
        status=coalesce(${input.status ?? null}::job_market_source_status,status),sync_interval_minutes=coalesce(${input.syncIntervalMinutes ?? null}::integer,sync_interval_minutes),
        access_basis=coalesce(${input.accessBasis ?? null}::text,access_basis),next_sync_at=case when ${input.status ?? null}::text='active' then now() else next_sync_at end,
        lease_until=case when ${disablesSource} then null else lease_until end,
        leased_by=case when ${disablesSource} then null else leased_by end,
        lease_run_id=case when ${disablesSource} then null else lease_run_id end,
        updated_at=now() where id=${id}`;
      return true;
    });
  }

  async listRuns(sourceId: string | undefined, page: number, limit: number) {
    const where = this
      .sql`${sourceId ?? null}::text is null or source_id=${sourceId ?? null}::uuid`;
    const [count] = await this.sql<
      Array<{ total: number }>
    >`select count(*)::int as total from job_market_sync_runs where ${where}`;
    const items = await this.sql<
      Array<any>
    >`select id,source_id as "sourceId",trigger::text,status::text,started_at as "startedAt",finished_at as "finishedAt",
      jsonb_build_object('discovered',discovered_count,'created',created_count,'updated',updated_count,'stale',stale_count,'closed',closed_count,'rejected',rejected_count) counts,
      error_code as "errorCode",error_summary as "errorSummary" from job_market_sync_runs where ${where} order by started_at desc,id limit ${limit} offset ${(page - 1) * limit}`;
    return { items, page, limit, total: count.total };
  }
}
