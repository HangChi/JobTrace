import { createServerDatabase } from "@/shared/database";
import type { SyncRepository, SyncResult } from "../application/ports";
import type { JobMarketSource, SyncTrigger } from "../domain/entities";

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

export class PostgresSyncRepository implements SyncRepository {
  constructor(private readonly sql = createServerDatabase()) {}
  async claimDue(limit: number, workerId: string, now: Date) {
    return this.sql.begin(async (tx) => {
      const ids = await tx<
        Array<{ id: string }>
      >`select id from job_market_sources where status='active' and next_sync_at<=${now}
        and (lease_until is null or lease_until<${now}) order by next_sync_at,id for update skip locked limit ${limit}`;
      if (!ids.length) return [];
      const values = ids.map((row) => row.id);
      await tx`update job_market_sources set lease_until=${new Date(now.getTime() + SOURCE_LEASE_MS)},leased_by=${workerId},last_attempt_at=${now} where id=any(${values})`;
      return tx.unsafe<SourceRow[]>(
        `${selectSource} where source.id = any($1)`,
        [values],
      );
    }) as Promise<JobMarketSource[]>;
  }
  async claimOne(sourceId: string, workerId: string, now: Date) {
    const claimed = await this.sql.begin(async (tx) => {
      const rows = await tx<
        Array<{ id: string }>
      >`select id from job_market_sources where id=${sourceId} and status='active'
        and (lease_until is null or lease_until<${now}) for update skip locked`;
      if (!rows.length) return [];
      await tx`update job_market_sources set lease_until=${new Date(now.getTime() + SOURCE_LEASE_MS)},leased_by=${workerId},last_attempt_at=${now} where id=${sourceId}`;
      return tx.unsafe<SourceRow[]>(`${selectSource} where source.id=$1`, [
        sourceId,
      ]);
    });
    return (claimed as JobMarketSource[])[0] ?? null;
  }
  async beginRun(
    sourceId: string,
    trigger: SyncTrigger,
    workerId: string,
    requestId: string,
  ) {
    const [row] = await this.sql<
      Array<{ id: string }>
    >`insert into job_market_sync_runs(source_id,trigger,worker_id,request_id)
      values(${sourceId},${trigger},${workerId},${requestId}) returning id`;
    return row.id;
  }
  async completeRun(
    runId: string,
    status: "succeeded" | "partial" | "failed",
    result: SyncResult,
  ) {
    await this
      .sql`update job_market_sync_runs set status=${status},finished_at=now(),discovered_count=${result.discovered},created_count=${result.created},
      updated_count=${result.updated},stale_count=${result.stale},closed_count=${result.closed},rejected_count=${result.rejected},
      error_code=${result.errorCode ?? null},error_summary=${result.errorSummary ?? null} where id=${runId}`;
  }
  async markSourceSuccess(
    sourceId: string,
    now: Date,
    intervalMinutes: number,
    metadata: { etag?: string; lastModified?: string },
  ) {
    await this
      .sql`update job_market_sources set last_success_at=${now},consecutive_failures=0,next_sync_at=${new Date(now.getTime() + intervalMinutes * 60_000)},
      lease_until=null,leased_by=null,etag=coalesce(${metadata.etag ?? null},etag),last_modified=coalesce(${metadata.lastModified ?? null},last_modified),updated_at=now() where id=${sourceId}`;
  }
  async markSourceFailure(sourceId: string, now: Date, retryAt: Date) {
    await this
      .sql`update job_market_sources set consecutive_failures=consecutive_failures+1,next_sync_at=${retryAt},lease_until=null,leased_by=null,updated_at=${now} where id=${sourceId}`;
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
    const rows = await this.sql<
      Array<{ id: string }>
    >`update job_market_sources set
      status=coalesce(${input.status ?? null}::job_market_source_status,status),sync_interval_minutes=coalesce(${input.syncIntervalMinutes ?? null}::integer,sync_interval_minutes),
      access_basis=coalesce(${input.accessBasis ?? null}::text,access_basis),next_sync_at=case when ${input.status ?? null}::text='active' then now() else next_sync_at end,
      lease_until=case when ${input.status ?? null}::text in ('paused','revoked') then null else lease_until end,
      leased_by=case when ${input.status ?? null}::text in ('paused','revoked') then null else leased_by end,updated_at=now() where id=${id} returning id`;
    return Boolean(rows[0]);
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
