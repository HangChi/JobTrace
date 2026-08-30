import { createServerDatabase } from "@/shared/database";
import type { JobMarketRepository, SyncResult } from "../application/ports";
import type {
  JobMarketSource,
  NormalizedJob,
  NormalizedSourceBatch,
} from "../domain/entities";

type Sql = ReturnType<typeof createServerDatabase>;

export class PostgresJobMarketRepository implements JobMarketRepository {
  constructor(private readonly sql: Sql = createServerDatabase()) {}

  async applyBatch(
    source: JobMarketSource,
    runId: string,
    batch: NormalizedSourceBatch,
    now: Date,
  ) {
    return this.sql.begin(async (tx) => {
      const result: SyncResult = {
        discovered: batch.jobs.length,
        created: 0,
        updated: 0,
        stale: 0,
        closed: 0,
        rejected: batch.rejected.length,
      };
      const observedIds: string[] = [];
      for (const job of batch.jobs) {
        const change = await this.upsertJob(
          tx as unknown as Sql,
          source,
          runId,
          job,
          now,
        );
        observedIds.push(job.externalJobId);
        if (change !== "unchanged") result[change] += 1;
      }
      if (batch.completeness === "complete") {
        const missing = await (tx as unknown as Sql)<
          Array<{ postId: string; prior: string }>
        >`
          update job_market_posts post set
            status=case
              when post.status='open' then 'stale'::job_market_post_status
              when post.status='stale' and post.last_missing_success_at <= ${new Date(now.getTime() - 6 * 60 * 60 * 1000)} then 'closed'::job_market_post_status
              else post.status end,
            missing_since=coalesce(post.missing_since,${now}),
            last_missing_success_at=coalesce(post.last_missing_success_at,${now}),updated_at=now()
          from job_market_source_records record
          where record.post_id=post.id and record.source_id=${source.id}
            and not (record.external_job_id = any(${observedIds.length ? observedIds : ["__none__"]}))
            and post.status<>'closed'
            and (post.status='open' or (post.status='stale' and post.last_missing_success_at <= ${new Date(now.getTime() - 6 * 60 * 60 * 1000)}))
          returning post.id as "postId",post.status::text as prior`;
        for (const row of missing) {
          if (row.prior === "stale") result.stale += 1;
          if (row.prior === "closed") result.closed += 1;
          await (tx as unknown as Sql)`insert into job_market_events(post_id,source_id,sync_run_id,event_type,reason_code)
            values(${row.postId},${source.id},${runId},${row.prior}::job_market_event_type,'successful_snapshot_absence')`;
        }
        await (tx as unknown as Sql)`update job_market_source_records record set
          status=case when post.status='closed' then 'closed'::job_market_record_status else 'missing'::job_market_record_status end
          from job_market_posts post where post.id=record.post_id and record.source_id=${source.id}
            and not (record.external_job_id = any(${observedIds.length ? observedIds : ["__none__"]}))`;
      }
      await (tx as unknown as Sql)`
        update job_market_campaigns campaign set
          status=case
            when exists(select 1 from job_market_posts p where p.campaign_id=campaign.id and p.status='open') then 'open'::job_market_post_status
            when exists(select 1 from job_market_posts p where p.campaign_id=campaign.id and p.status='stale') then 'stale'::job_market_post_status
            else 'closed'::job_market_post_status end,
          last_confirmed_at=${now},updated_at=now()
        where campaign.company_id=${source.companyId}`;
      return result;
    }) as Promise<SyncResult>;
  }

  private async upsertJob(
    sql: Sql,
    source: JobMarketSource,
    runId: string,
    job: NormalizedJob,
    now: Date,
  ) {
    const [campaign] = await sql<Array<{ id: string }>>`
      insert into job_market_campaigns(company_id,campaign_key,name,recruitment_type,batch_label,status,published_at,valid_through,last_confirmed_at)
      values(${source.companyId},${job.campaignKey},${job.campaignName},${job.recruitmentType},${job.batchLabel},'open',${job.publishedAt},${job.validThrough},${now})
      on conflict(company_id,campaign_key) do update set
        name=coalesce(excluded.name,job_market_campaigns.name),recruitment_type=coalesce(excluded.recruitment_type,job_market_campaigns.recruitment_type),
        batch_label=coalesce(excluded.batch_label,job_market_campaigns.batch_label),last_confirmed_at=excluded.last_confirmed_at,updated_at=now()
      returning id`;
    const [existing] = await sql<
      Array<{ postId: string; contentHash: string; status: string }>
    >`
      select record.post_id as "postId",post.content_hash as "contentHash",post.status::text
      from job_market_source_records record join job_market_posts post on post.id=record.post_id
      where record.source_id=${source.id} and record.external_job_id=${job.externalJobId}`;
    let postId = existing?.postId;
    let priorContentHash = existing?.contentHash;
    let priorStatus = existing?.status;
    let change: "created" | "updated" | "unchanged" = "updated";
    if (!postId) {
      const [byUrl] = await sql<
        Array<{ id: string; contentHash: string; status: string }>
      >`
        select post.id,post.content_hash as "contentHash",post.status::text from job_market_posts post
        join job_market_source_records record on record.post_id=post.id
        where post.company_id=${source.companyId}
          and (coalesce(record.external_detail_url,'')=${job.detailUrl ?? ""}
            or coalesce(record.external_apply_url,'')=${job.applyUrl ?? ""})
        limit 1`;
      postId = byUrl?.id;
      priorContentHash = byUrl?.contentHash;
      priorStatus = byUrl?.status;
    }
    if (!postId) {
      const [created] = await sql<Array<{ id: string }>>`
        insert into job_market_posts(company_id,campaign_id,title,normalized_title,description_text,recruitment_type,target,education,status,primary_apply_url,published_at,valid_through,first_seen_at,last_seen_at,content_hash)
        values(${source.companyId},${campaign.id},${job.title},${job.normalizedTitle},${job.descriptionText},${job.recruitmentType},${job.target},${job.education},${job.sourceStatus === "closed" ? "closed" : "open"},${job.applyUrl},${job.publishedAt},${job.validThrough},${now},${now},${job.contentHash}) returning id`;
      postId = created.id;
      change = "created";
    } else {
      const nextStatus = job.sourceStatus === "closed" ? "closed" : "open";
      change =
        priorContentHash === job.contentHash && priorStatus === nextStatus
          ? "unchanged"
          : "updated";
      if (change === "unchanged") {
        await sql`update job_market_posts set last_seen_at=${now},missing_since=null,last_missing_success_at=null where id=${postId}`;
      } else {
        await sql`update job_market_posts set campaign_id=${campaign.id},title=${job.title},normalized_title=${job.normalizedTitle},
          description_text=${job.descriptionText},recruitment_type=${job.recruitmentType},target=${job.target},education=${job.education},
          status=${nextStatus},primary_apply_url=coalesce(${job.applyUrl},primary_apply_url),published_at=${job.publishedAt},
          valid_through=${job.validThrough},last_seen_at=${now},missing_since=null,last_missing_success_at=null,content_hash=${job.contentHash},updated_at=now()
          where id=${postId}`;
      }
    }
    await sql`insert into job_market_source_records(source_id,external_job_id,post_id,external_detail_url,external_apply_url,payload_hash,normalized_snapshot,status,first_seen_at,last_seen_at,last_seen_run_id)
      values(${source.id},${job.externalJobId},${postId},${job.detailUrl},${job.applyUrl},${job.contentHash},${sql.json({ title: job.title, locations: job.locations.map((l) => l.name) })},${job.sourceStatus === "closed" ? "closed" : "observed"},${now},${now},${runId})
      on conflict(source_id,external_job_id) do update set post_id=excluded.post_id,external_detail_url=excluded.external_detail_url,
      external_apply_url=excluded.external_apply_url,payload_hash=excluded.payload_hash,normalized_snapshot=excluded.normalized_snapshot,status=excluded.status,last_seen_at=excluded.last_seen_at,last_seen_run_id=excluded.last_seen_run_id`;
    if (change !== "unchanged") {
      await sql`delete from job_market_post_locations where post_id=${postId}`;
      for (const location of job.locations) {
        const [row] = await sql<
          Array<{ id: string }>
        >`insert into job_market_locations(normalized_key,display_name,is_remote)
          values(${location.normalizedKey},${location.name},${location.isRemote}) on conflict(normalized_key) do update set display_name=excluded.display_name returning id`;
        await sql`insert into job_market_post_locations(post_id,location_id) values(${postId},${row.id}) on conflict do nothing`;
      }
    }
    if (change !== "unchanged") {
      const eventType =
        change === "updated" &&
        priorStatus &&
        priorStatus !== "open" &&
        job.sourceStatus !== "closed"
          ? "reopened"
          : change;
      await sql`insert into job_market_events(post_id,campaign_id,source_id,sync_run_id,event_type,reason_code,change_summary)
        values(${postId},${campaign.id},${source.id},${runId},${eventType}::job_market_event_type,${eventType === "created" ? "first_observation" : eventType === "reopened" ? "source_reappeared" : "content_changed"},${sql.json({ title: job.title })})`;
    }
    return change;
  }
}
