import { createServerDatabase } from "@/shared/database";
import type {
  DiscoveryObservation,
  DiscoveryTarget,
} from "../application/source-discovery";
import type { SourceCandidate } from "../application/contracts";

export class PostgresSourceDiscoveryRepository {
  constructor(private readonly sql = createServerDatabase()) {}

  async listTargets(limit: number) {
    return this.sql<DiscoveryTarget[]>`
      select company.id as "companyId",company.canonical_name as "companyName",
        campaign.official_apply_url as "entryUrl"
      from job_market_campaigns campaign
      join job_market_companies company on company.id=campaign.company_id
      left join job_market_source_candidates candidate
        on candidate.company_id=company.id and candidate.entry_url=campaign.official_apply_url
      where campaign.listing_kind='recruitment_directory'
        and campaign.status='open'
        and campaign.official_apply_url is not null
        and campaign.official_apply_url not like 'https://mp.weixin.qq.com/%'
        and not exists(select 1 from job_market_sources source where source.company_id=company.id)
      order by candidate.last_checked_at asc nulls first,company.canonical_name,company.id
      limit ${limit}`;
  }

  async record(observation: DiscoveryObservation) {
    const { target, detected } = observation;
    const reviewStatus = detected ? "pending" : "unrecognized";
    await this.sql`
      insert into job_market_source_candidates(
        company_id,entry_url,adapter,external_key,base_url,allowed_hosts,confidence,
        evidence_code,review_status,health_status,diagnostic_code,diagnostic_summary,http_status,last_checked_at
      ) values(
        ${target.companyId},${target.entryUrl},${detected?.adapter ?? null},
        ${detected?.externalKey ?? null},${detected?.baseUrl ?? null},
        ${detected?.allowedHosts ?? []},${detected?.confidence ?? null},
        ${observation.evidenceCode},${reviewStatus},${observation.healthStatus},
        ${observation.diagnosticCode ?? null},${observation.diagnosticSummary ?? null},
        ${observation.httpStatus ?? null},now()
      ) on conflict(company_id,entry_url) do update set
        adapter=case when job_market_source_candidates.review_status='approved' then job_market_source_candidates.adapter else excluded.adapter end,
        external_key=case when job_market_source_candidates.review_status='approved' then job_market_source_candidates.external_key else excluded.external_key end,
        base_url=case when job_market_source_candidates.review_status='approved' then job_market_source_candidates.base_url else excluded.base_url end,
        allowed_hosts=case when job_market_source_candidates.review_status='approved' then job_market_source_candidates.allowed_hosts else excluded.allowed_hosts end,
        confidence=case when job_market_source_candidates.review_status='approved' then job_market_source_candidates.confidence else excluded.confidence end,
        evidence_code=excluded.evidence_code,health_status=excluded.health_status,
        diagnostic_code=excluded.diagnostic_code,diagnostic_summary=excluded.diagnostic_summary,
        http_status=excluded.http_status,last_checked_at=now(),updated_at=now(),
        review_status=case
          when job_market_source_candidates.review_status in ('approved','ignored')
            then job_market_source_candidates.review_status
          else excluded.review_status
        end`;
  }

  async list(status?: SourceCandidate["reviewStatus"]) {
    const items = await this.sql<SourceCandidate[]>`
      select candidate.id,candidate.company_id as "companyId",company.canonical_name as "companyName",
        company.company_type as "companyType",candidate.entry_url as "entryUrl",candidate.adapter::text,
        candidate.external_key as "externalKey",candidate.base_url as "baseUrl",
        candidate.allowed_hosts as "allowedHosts",candidate.confidence,
        candidate.evidence_code as "evidenceCode",candidate.review_status as "reviewStatus",
        candidate.health_status as "healthStatus",candidate.diagnostic_code as "diagnosticCode",
        candidate.diagnostic_summary as "diagnosticSummary",candidate.http_status as "httpStatus",
        candidate.approved_source_id as "approvedSourceId",candidate.last_checked_at as "lastCheckedAt"
      from job_market_source_candidates candidate
      join job_market_companies company on company.id=candidate.company_id
      where ${status ?? null}::text is null or candidate.review_status=${status ?? null}
      order by
        case candidate.review_status when 'pending' then 0 when 'unrecognized' then 1 when 'approved' then 2 else 3 end,
        candidate.last_checked_at desc,candidate.id
      limit 100`;
    const [summary] = await this.sql<
      Array<{
        directoryCompanies: number;
        automaticCompanies: number;
        scannableCompanies: number;
        reviewedCompanies: number;
        pendingCandidates: number;
      }>
    >`
      select
        (select count(distinct company_id)::int from job_market_campaigns where listing_kind='recruitment_directory' and status='open') as "directoryCompanies",
        (select count(distinct company_id)::int from job_market_sources where status<>'revoked') as "automaticCompanies",
        (select count(distinct company_id)::int from job_market_campaigns where listing_kind='recruitment_directory' and status='open'
          and official_apply_url not like 'https://mp.weixin.qq.com/%') as "scannableCompanies",
        (select count(distinct company_id)::int from job_market_source_candidates) as "reviewedCompanies",
        (select count(*)::int from job_market_source_candidates where review_status='pending') as "pendingCandidates"`;
    return { items, summary };
  }

  async ignore(id: string) {
    const rows = await this.sql<Array<{ id: string }>>`
      update job_market_source_candidates set review_status='ignored',reviewed_at=now(),updated_at=now()
      where id=${id} and review_status in ('pending','unrecognized') returning id`;
    return Boolean(rows[0]);
  }

  async approve(id: string) {
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as typeof this.sql;
      const [candidate] = await tx<
        Array<{
          id: string;
          companyId: string;
          adapter: string | null;
          externalKey: string | null;
          baseUrl: string | null;
          allowedHosts: string[];
          healthStatus: string;
          reviewStatus: string;
        }>
      >`
        select id,company_id as "companyId",adapter::text,external_key as "externalKey",
          base_url as "baseUrl",allowed_hosts as "allowedHosts",health_status as "healthStatus",
          review_status as "reviewStatus"
        from job_market_source_candidates where id=${id} for update`;
      if (!candidate) return { outcome: "not_found" as const };
      if (
        candidate.reviewStatus !== "pending" ||
        candidate.healthStatus !== "healthy" ||
        !candidate.adapter ||
        !candidate.externalKey ||
        !candidate.baseUrl ||
        !candidate.allowedHosts.length
      )
        return { outcome: "not_approvable" as const };

      let [source] = await tx<Array<{ id: string }>>`
        insert into job_market_sources(
          company_id,adapter,external_key,base_url,allowed_hosts,country_codes,
          access_basis,is_official,sync_interval_minutes,status,next_sync_at
        ) values(
          ${candidate.companyId},${candidate.adapter},${candidate.externalKey},${candidate.baseUrl},
          ${candidate.allowedHosts},${["cn"]},'public',true,360,'active',now()
        ) on conflict(company_id,adapter,external_key) do nothing returning id`;
      if (!source)
        [source] = await tx<Array<{ id: string }>>`
          select id from job_market_sources where company_id=${candidate.companyId}
            and adapter=${candidate.adapter} and external_key=${candidate.externalKey}`;
      if (!source) return { outcome: "conflict" as const };
      await tx`
        update job_market_source_candidates set review_status='approved',approved_source_id=${source.id},
          reviewed_at=now(),updated_at=now() where id=${id}`;
      return { outcome: "approved" as const, sourceId: source.id };
    });
  }
}
