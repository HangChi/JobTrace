import { createServerDatabase } from "@/shared/database";
import { normalizeText } from "../domain/normalization";
import type {
  CompanyCandidate,
  CompanyCandidateList,
} from "../application/contracts";

type Sql = ReturnType<typeof createServerDatabase>;

export type CompanyCandidateIntake = {
  companyName: string;
  articleUrl: string;
  articleTitle: string;
  snippet: string | null;
  publishedAt: string | null;
  sourceEngine: "sogou" | "bing";
};

export type SiteScanIntake = {
  companyName: string;
  boardUrl: string;
  articleTitle: string;
  detected: {
    adapter: string;
    externalKey: string;
    baseUrl: string;
    allowedHosts: string[];
    confidence: "high" | "medium";
  };
};

export type CompanyApprovalOverrides = {
  companyName?: string;
  companyType?: string;
  industry?: string;
};

export class PostgresCompanyCandidateRepository {
  constructor(private readonly sql: Sql = createServerDatabase()) {}

  async enqueue(intake: CompanyCandidateIntake[]) {
    if (!intake.length) return { known: 0, queued: 0 };
    const payload = intake.map((item) => ({
      company_name: item.companyName,
      normalized_name: normalizeText(item.companyName),
      article_url: item.articleUrl,
      article_title: item.articleTitle.slice(0, 300),
      snippet: item.snippet,
      published_at: item.publishedAt,
      source_engine: item.sourceEngine,
    }));
    const [known] = await this.sql<Array<{ count: number }>>`
      with input as (
        select * from jsonb_to_recordset(${this.sql.json(payload as never)}::jsonb) as value(
          normalized_name text
        ))
      select count(*)::int count from job_market_companies company
      join input on input.normalized_name=company.normalized_name`;
    const [queued] = await this.sql<Array<{ count: number }>>`
      with input as (
        select * from jsonb_to_recordset(${this.sql.json(payload as never)}::jsonb) as value(
          company_name text,normalized_name text,article_url text,article_title text,
          snippet text,published_at timestamptz,source_engine text
        )),
      inserted as (
        insert into job_market_company_candidates(
          company_name,normalized_name,article_url,article_title,snippet,published_at,source_engine
        )
        select company_name,normalized_name,article_url,article_title,snippet,published_at,
          source_engine::text from input
        where normalized_name not in (select normalized_name from job_market_companies)
        on conflict (normalized_name) do update set
          article_url=excluded.article_url,
          article_title=excluded.article_title,
          snippet=excluded.snippet,
          published_at=excluded.published_at,
          article_count=job_market_company_candidates.article_count+1,
          source_engine=excluded.source_engine,
          updated_at=now()
        where job_market_company_candidates.review_status='pending'
        returning id)
      select count(*)::int count from inserted`;
    return { known: known?.count ?? 0, queued: queued?.count ?? 0 };
  }

  // A 方案 site: 枚举产出：已知公司的板子直接进 source_candidates，
  // 新公司进本候选队列（带 ATS 检测结果，批准后自动转来源候选）。
  // 单语句 set-based：计数均按去重后的公司/板块计，批内重复不会报
  // "cannot affect row a second time"，且整批原子提交。
  async enqueueSiteScan(intake: SiteScanIntake[]) {
    if (!intake.length) return { known: 0, queued: 0, existingSources: 0 };
    const payload = intake.map((item) => ({
      company_name: item.companyName,
      normalized_name: normalizeText(item.companyName),
      board_url: item.boardUrl,
      article_title: item.articleTitle.slice(0, 300),
      adapter: item.detected.adapter,
      external_key: item.detected.externalKey,
      base_url: item.detected.baseUrl,
      allowed_hosts: item.detected.allowedHosts,
      confidence: item.detected.confidence,
    }));
    const [result] = await this.sql<
      Array<{ known: number; queued: number; existingSources: number }>
    >`
      with input as (
        select * from jsonb_to_recordset(${this.sql.json(payload as never)}::jsonb) as value(
          company_name text,normalized_name text,board_url text,article_title text,
          adapter text,external_key text,base_url text,allowed_hosts text[],confidence text
        )),
      known_boards as (
        select distinct on (company.id, input.board_url)
          company.id as company_id, input.normalized_name,
          input.board_url, input.adapter, input.external_key,
          input.base_url, input.allowed_hosts, input.confidence
        from input
        join job_market_companies company
          on company.normalized_name = input.normalized_name
      ),
      source_upsert as (
        insert into job_market_source_candidates(
          company_id,entry_url,adapter,external_key,base_url,allowed_hosts,
          confidence,evidence_code,review_status,health_status,last_checked_at
        )
        select company_id,board_url,adapter::job_market_source_adapter,external_key,
          base_url,allowed_hosts,confidence,'ats_site_scan','pending','healthy',now()
        from known_boards
        on conflict (company_id,entry_url) do update set
          last_checked_at=now(),updated_at=now()
        returning company_id
      ),
      duplicate_sources as (
        select distinct input.normalized_name from input
        where not exists (
            select 1 from known_boards
            where known_boards.normalized_name = input.normalized_name)
          and exists (
            select 1 from job_market_sources source
            where source.adapter = input.adapter::job_market_source_adapter
              and source.external_key = input.external_key)
      ),
      candidate_upsert as (
        insert into job_market_company_candidates(
          company_name,normalized_name,article_url,article_title,source_engine,
          detected_adapter,detected_external_key,detected_base_url,
          detected_allowed_hosts,detected_confidence
        )
        select distinct on (input.normalized_name)
          input.company_name,input.normalized_name,input.board_url,input.article_title,
          'site_scan',input.adapter::job_market_source_adapter,input.external_key,
          input.base_url,input.allowed_hosts,input.confidence
        from input
        where not exists (
            select 1 from known_boards
            where known_boards.normalized_name = input.normalized_name)
          and not exists (
            select 1 from duplicate_sources
            where duplicate_sources.normalized_name = input.normalized_name)
        on conflict (normalized_name) do update set
          article_url=excluded.article_url,article_title=excluded.article_title,
          detected_adapter=excluded.detected_adapter,
          detected_external_key=excluded.detected_external_key,
          detected_base_url=excluded.detected_base_url,
          detected_allowed_hosts=excluded.detected_allowed_hosts,
          detected_confidence=excluded.detected_confidence,
          article_count=job_market_company_candidates.article_count+1,
          updated_at=now()
        where job_market_company_candidates.review_status='pending'
        returning id
      )
      select
        (select count(*)::int from known_boards) as known,
        (select count(*)::int from candidate_upsert) as queued,
        (select count(*)::int from duplicate_sources) as existing_sources`;
    return {
      known: result?.known ?? 0,
      queued: result?.queued ?? 0,
      existingSources: result?.existingSources ?? 0,
    };
  }

  async list(status?: CompanyCandidate["reviewStatus"]) {
    const items = await this.sql<CompanyCandidate[]>`
      select candidate.id,candidate.company_name as "companyName",
        candidate.article_url as "articleUrl",candidate.article_title as "articleTitle",
        candidate.snippet,candidate.published_at as "publishedAt",
        candidate.source_engine::text as "sourceEngine",candidate.article_count as "articleCount",
        candidate.detected_adapter::text as "detectedAdapter",
        candidate.detected_confidence::text as "detectedConfidence",
        candidate.review_status::text as "reviewStatus",
        candidate.created_company_id as "createdCompanyId",
        candidate.created_at as "createdAt"
      from job_market_company_candidates candidate
      where ${status ?? null}::text is null or candidate.review_status=${status ?? null}
      order by case candidate.review_status when 'pending' then 0 when 'approved' then 1 else 2 end,
        candidate.article_count desc,candidate.created_at desc
      limit 100`;
    const [summary] = await this.sql<
      Array<{ pending: number; approved: number; ignored: number }>
    >`
      select
        count(*) filter(where review_status='pending')::int as pending,
        count(*) filter(where review_status='approved')::int as approved,
        count(*) filter(where review_status='ignored')::int as ignored
      from job_market_company_candidates`;
    return {
      items,
      summary: summary ?? { pending: 0, approved: 0, ignored: 0 },
    };
  }

  async ignore(id: string) {
    const rows = await this.sql<Array<{ id: string }>>`
      update job_market_company_candidates set review_status='ignored',reviewed_at=now(),updated_at=now()
      where id=${id} and review_status='pending' returning id`;
    return Boolean(rows[0]);
  }

  async approve(id: string, overrides: CompanyApprovalOverrides = {}) {
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      const [candidate] = await tx<
        Array<{
          id: string;
          companyName: string;
          articleUrl: string;
          articleTitle: string;
          publishedAt: string | null;
          reviewStatus: string;
          detectedAdapter: string | null;
          detectedExternalKey: string | null;
          detectedBaseUrl: string | null;
          detectedAllowedHosts: string[];
          detectedConfidence: string | null;
        }>
      >`
        select id,company_name as "companyName",article_url as "articleUrl",
          article_title as "articleTitle",published_at as "publishedAt",
          review_status::text as "reviewStatus",
          detected_adapter::text as "detectedAdapter",
          detected_external_key as "detectedExternalKey",
          detected_base_url as "detectedBaseUrl",
          detected_allowed_hosts as "detectedAllowedHosts",
          detected_confidence::text as "detectedConfidence"
        from job_market_company_candidates where id=${id} for update`;
      if (!candidate) return { outcome: "not_found" as const };
      if (candidate.reviewStatus !== "pending")
        return { outcome: "not_pending" as const };

      const companyName = overrides.companyName ?? candidate.companyName;
      const companyType = overrides.companyType ?? "企业";
      const industry = overrides.industry ?? "综合行业";
      const identityKey = `runtime:intake:${normalizeText(companyName)}`;
      const isWechatLink =
        /^https:\/\/(mp\.weixin\.qq\.com|weixin\.sogou\.com\/wechat)/.test(
          candidate.articleUrl,
        );

      let [company] = await tx<Array<{ id: string }>>`
        select id from job_market_companies where normalized_name=${normalizeText(companyName)} limit 1`;
      if (!company) {
        [company] = await tx<Array<{ id: string }>>`
          insert into job_market_companies(
            canonical_name,normalized_name,company_type,industry,website_url,identity_key
          ) values(
            ${companyName},${normalizeText(companyName)},${companyType},${industry},
            ${candidate.articleUrl},${identityKey})
          returning id`;
        await tx`
          insert into job_market_campaigns(
            company_id,campaign_key,name,recruitment_type,status,official_apply_url,
            listing_kind,published_at
          ) values(
            ${company.id},
            ${isWechatLink ? "directory:wechat" : "directory:official_site"},
            ${isWechatLink ? "公众号招聘原文" : "官方招聘网站"},
            ${isWechatLink ? "公众号" : "招聘官网"},'open',
            ${candidate.articleUrl},'recruitment_directory',${candidate.publishedAt})`;
      }

      // site: 枚举带来的 ATS 检测结果转为待审核来源候选，走既有批准流。
      if (candidate.detectedAdapter && candidate.detectedExternalKey) {
        await tx`
          insert into job_market_source_candidates(
            company_id,entry_url,adapter,external_key,base_url,allowed_hosts,
            confidence,evidence_code,review_status,health_status,last_checked_at
          ) values(
            ${company.id},${candidate.articleUrl},
            ${candidate.detectedAdapter as never},${candidate.detectedExternalKey},
            ${candidate.detectedBaseUrl},${candidate.detectedAllowedHosts},
            ${candidate.detectedConfidence as never},
            'ats_site_scan','pending','healthy',now())
          on conflict (company_id,entry_url) do update set
            last_checked_at=now(),updated_at=now()`;
      }

      await tx`
        update job_market_company_candidates set review_status='approved',reviewed_at=now(),
          created_company_id=${company.id},company_name=${companyName},updated_at=now()
        where id=${id}`;
      await tx`select public.refresh_job_market_company_read_model(${company.id})`;
      return { outcome: "approved" as const, companyId: company.id };
    });
  }
}
