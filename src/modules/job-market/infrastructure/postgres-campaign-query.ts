import { createServerDatabase } from "@/shared/database";
import type { CampaignRepository, CampaignQuery } from "../application/ports";
import type { CampaignDetail, CampaignSummary } from "../domain/entities";
import { applyUnavailableReason } from "../domain/apply-target";

type CampaignRow = Omit<
  CampaignSummary,
  "positions" | "locations" | "source" | "applyMode"
> & {
  positions: string[];
  locations: Array<{ name: string; isRemote: boolean }>;
  sourceName: string;
  sourceUrl: string;
};

export class PostgresCampaignQuery implements CampaignRepository {
  constructor(private readonly sql = createServerDatabase()) {}

  private filters(ownerId: string, query: CampaignQuery) {
    const q = query.q?.toLowerCase();
    return this.sql`
      (${query.campaignId ?? null}::text is null or exists(
        select 1 from job_market_campaigns requested
        where requested.company_id=company.id and requested.id=${query.campaignId ?? null}::uuid
      ))
      and (
        exists(
          select 1 from job_market_posts visible_post
          join job_market_source_records visible_record on visible_record.post_id=visible_post.id
          join job_market_sources visible_source on visible_source.id=visible_record.source_id and visible_source.status='active'
          where visible_post.company_id=company.id
        )
        or exists(
          select 1 from job_market_campaigns directory
          where directory.company_id=company.id and directory.listing_kind='recruitment_directory' and directory.status<>'closed'
        )
      )
      and (${q ?? null}::text is null
        or lower(company.canonical_name) like ${q ? `%${q}%` : null}::text
        or exists(
          select 1 from job_market_posts post
          join job_market_source_records record on record.post_id=post.id
          join job_market_sources source on source.id=record.source_id and source.status='active'
          where post.company_id=company.id and post.status<>'closed' and lower(post.title) like ${q ? `%${q}%` : null}
        )
      )
      and (${query.company ?? null}::text is null
        or lower(company.canonical_name) like ${query.company ? `%${query.company.toLowerCase()}%` : null}::text)
      and (${query.location ?? null}::text is null or exists(
        select 1 from job_market_posts post
        join job_market_source_records record on record.post_id=post.id
        join job_market_sources source on source.id=record.source_id and source.status='active'
        join job_market_post_locations relation on relation.post_id=post.id
        join job_market_locations location on location.id=relation.location_id
        where post.company_id=company.id and post.status<>'closed'
          and lower(location.display_name) like ${query.location ? `%${query.location.toLowerCase()}%` : null}::text
      ))
      and (${query.status ?? null}::text is null or ${query.status ?? null}::text=(
        case
          when exists(
            select 1 from job_market_posts post
            join job_market_source_records record on record.post_id=post.id
            join job_market_sources source on source.id=record.source_id and source.status='active'
            where post.company_id=company.id and post.status='open'
          ) or exists(
            select 1 from job_market_campaigns directory
            where directory.company_id=company.id and directory.listing_kind='recruitment_directory' and directory.status='open'
          ) then 'open'
          when exists(
            select 1 from job_market_posts post
            join job_market_source_records record on record.post_id=post.id
            join job_market_sources source on source.id=record.source_id and source.status='active'
            where post.company_id=company.id and post.status='stale'
          ) or exists(
            select 1 from job_market_campaigns directory
            where directory.company_id=company.id and directory.listing_kind='recruitment_directory' and directory.status='stale'
          ) then 'stale'
          else 'closed'
        end
      ))
      and (${query.postedFrom ?? null}::text is null or exists(
        select 1 from job_market_posts post
        join job_market_source_records record on record.post_id=post.id
        join job_market_sources source on source.id=record.source_id and source.status='active'
        where post.company_id=company.id and post.published_at::date>=${query.postedFrom ?? null}::date
        union all
        select 1 from job_market_campaigns directory
        where directory.company_id=company.id and directory.listing_kind='recruitment_directory'
          and directory.published_at::date>=${query.postedFrom ?? null}::date
      ))
      and (${query.favorite ?? null}::boolean is not true or exists(
        select 1 from job_market_campaign_favorites favorite
        join job_market_campaigns campaign on campaign.id=favorite.campaign_id
        where campaign.company_id=company.id and favorite.owner_id=${ownerId}
      ))`;
  }

  async list(ownerId: string, query: CampaignQuery) {
    const filters = this.filters(ownerId, query);
    const [count] = await this.sql<Array<{ total: number }>>`
      select count(*)::int as total
      from job_market_companies company
      where ${filters}`;
    const rows = await this.sql<CampaignRow[]>`
      select representative.id,
        case when sync_state.has_synced then 'synced_jobs' else 'recruitment_directory' end as "listingKind",
        jsonb_build_object(
          'id',company.id,'name',company.canonical_name,'type',company.company_type,'industry',company.industry
        ) as company,
        null::text as "campaignName",
        case when sync_state.has_synced then null else directory.recruitment_type end as "recruitmentType",
        null::text as "batchLabel",
        coalesce((
          select array_agg(distinct post.title order by post.title)
          from job_market_posts post
          join job_market_source_records record on record.post_id=post.id
          join job_market_sources post_source on post_source.id=record.source_id and post_source.status='active'
          where post.company_id=company.id and post.status<>'closed'
        ),'{}') as positions,
        (
          select count(distinct post.normalized_title)::int
          from job_market_posts post
          join job_market_source_records record on record.post_id=post.id
          join job_market_sources post_source on post_source.id=record.source_id and post_source.status='active'
          where post.company_id=company.id and post.status<>'closed'
        ) as "positionCount",
        coalesce((
          select jsonb_agg(location_row order by location_row->>'name')
          from (
            select distinct jsonb_build_object('name',location.display_name,'isRemote',location.is_remote) location_row
            from job_market_posts post
            join job_market_source_records record on record.post_id=post.id
            join job_market_sources post_source on post_source.id=record.source_id and post_source.status='active'
            join job_market_post_locations relation on relation.post_id=post.id
            join job_market_locations location on location.id=relation.location_id
            where post.company_id=company.id and post.status<>'closed'
          ) locations
        ),'[]') as locations,
        case
          when company_state.has_open then 'open'
          when company_state.has_stale then 'stale'
          else 'closed'
        end as status,
        case when sync_state.has_synced
          then coalesce(company.website_url,source.base_url)
          else directory.official_apply_url
        end as "primaryApplyUrl",
        case when sync_state.has_synced then source.adapter::text else directory.recruitment_type end as "sourceName",
        case when sync_state.has_synced
          then coalesce(company.website_url,source.base_url)
          else directory.official_apply_url
        end as "sourceUrl",
        coalesce(post_dates.published_at,directory.published_at) as "publishedAt",
        post_dates.valid_through as "validThrough",
        campaign_dates.last_confirmed_at as "lastConfirmedAt",
        exists(
          select 1 from job_market_campaign_favorites favorite
          join job_market_campaigns campaign on campaign.id=favorite.campaign_id
          where campaign.company_id=company.id and favorite.owner_id=${ownerId}
        ) as "isFavorite"
      from job_market_companies company
      join lateral (
        select campaign.id
        from job_market_campaigns campaign
        where campaign.company_id=company.id and (
          (campaign.listing_kind='recruitment_directory' and campaign.status<>'closed')
          or (campaign.listing_kind='synced_jobs' and exists(
            select 1 from job_market_posts post
            join job_market_source_records record on record.post_id=post.id
            join job_market_sources post_source on post_source.id=record.source_id and post_source.status='active'
            where post.campaign_id=campaign.id
          ))
        )
        order by case when campaign.listing_kind='synced_jobs' then 0 else 1 end,campaign.created_at,campaign.id
        limit 1
      ) representative on true
      left join lateral (
        select exists(
          select 1 from job_market_posts post
          join job_market_source_records record on record.post_id=post.id
          join job_market_sources post_source on post_source.id=record.source_id and post_source.status='active'
          where post.company_id=company.id
        ) as has_synced
      ) sync_state on true
      left join lateral (
        select source.* from job_market_sources source
        where source.company_id=company.id and source.status='active'
        order by source.is_official desc,source.last_success_at desc nulls last,source.id
        limit 1
      ) source on true
      left join lateral (
        select campaign.* from job_market_campaigns campaign
        where campaign.company_id=company.id and campaign.listing_kind='recruitment_directory' and campaign.status<>'closed'
        order by case when campaign.recruitment_type='招聘官网' then 0 else 1 end,
          campaign.published_at desc nulls last,campaign.id
        limit 1
      ) directory on true
      left join lateral (
        select
          exists(
            select 1 from job_market_posts post
            join job_market_source_records record on record.post_id=post.id
            join job_market_sources post_source on post_source.id=record.source_id and post_source.status='active'
            where post.company_id=company.id and post.status='open'
          ) or exists(
            select 1 from job_market_campaigns campaign
            where campaign.company_id=company.id and campaign.listing_kind='recruitment_directory' and campaign.status='open'
          ) as has_open,
          exists(
            select 1 from job_market_posts post
            join job_market_source_records record on record.post_id=post.id
            join job_market_sources post_source on post_source.id=record.source_id and post_source.status='active'
            where post.company_id=company.id and post.status='stale'
          ) or exists(
            select 1 from job_market_campaigns campaign
            where campaign.company_id=company.id and campaign.listing_kind='recruitment_directory' and campaign.status='stale'
          ) as has_stale
      ) company_state on true
      left join lateral (
        select max(post.published_at) as published_at,max(post.valid_through) as valid_through
        from job_market_posts post
        join job_market_source_records record on record.post_id=post.id
        join job_market_sources post_source on post_source.id=record.source_id and post_source.status='active'
        where post.company_id=company.id and post.status<>'closed'
      ) post_dates on true
      left join lateral (
        select max(campaign.last_confirmed_at) as last_confirmed_at
        from job_market_campaigns campaign where campaign.company_id=company.id
      ) campaign_dates on true
      where ${filters}
      order by coalesce(post_dates.published_at,directory.published_at) desc nulls last,
        campaign_dates.last_confirmed_at desc nulls last,company.id
      limit ${query.limit} offset ${(query.page - 1) * query.limit}`;
    const items = rows.map(
      (row) =>
        ({
          ...row,
          source: { name: row.sourceName ?? "unknown", url: row.sourceUrl },
          applyMode: row.primaryApplyUrl ? "single" : "unavailable",
          publishedAt: row.publishedAt
            ? new Date(row.publishedAt).toISOString()
            : null,
          validThrough: row.validThrough
            ? new Date(row.validThrough).toISOString()
            : null,
          lastConfirmedAt: row.lastConfirmedAt
            ? new Date(row.lastConfirmedAt).toISOString()
            : null,
        }) as CampaignSummary,
    );
    return { items, page: query.page, limit: query.limit, total: count.total };
  }

  private async jobs(ownerId: string, companyId: string) {
    const rows = await this.sql<Array<any>>`
      select post.id,post.title,post.status::text as status,post.primary_apply_url as "applyUrl",
        post.published_at as "publishedAt",post.valid_through as "validThrough",
        source.adapter::text as "sourceName",company.website_url as "sourceUrl",
        link.application_id as "alreadyTrackedApplicationId",
        coalesce((
          select jsonb_agg(jsonb_build_object('name',location.display_name,'isRemote',location.is_remote) order by location.display_name)
          from job_market_post_locations relation
          join job_market_locations location on location.id=relation.location_id
          where relation.post_id=post.id
        ),'[]') as locations
      from job_market_posts post
      join job_market_companies company on company.id=post.company_id
      left join lateral(
        select job_source.adapter
        from job_market_source_records record
        join job_market_sources job_source on job_source.id=record.source_id
        where record.post_id=post.id and job_source.status='active'
        order by job_source.is_official desc,record.last_seen_at desc
        limit 1
      ) source on true
      left join application_job_market_links link on link.post_id=post.id and link.owner_id=${ownerId}
      where post.company_id=${companyId} and source.adapter is not null and post.status<>'closed'
      order by post.published_at desc nulls last,post.title,post.id`;
    return rows.map((row) => ({
      ...row,
      publishedAt: row.publishedAt
        ? new Date(row.publishedAt).toISOString()
        : null,
      validThrough: row.validThrough
        ? new Date(row.validThrough).toISOString()
        : null,
      applyUnavailableReason: applyUnavailableReason(row.status, row.applyUrl),
    }));
  }

  async get(
    ownerId: string,
    campaignId: string,
  ): Promise<CampaignDetail | null> {
    const [target] = await this.sql<Array<{ companyId: string }>>`
      select company_id as "companyId" from job_market_campaigns where id=${campaignId}`;
    if (!target) return null;
    const page = await this.list(ownerId, {
      page: 1,
      limit: 1,
      campaignId,
    });
    const summary = page.items[0] ?? null;
    if (!summary) return null;
    return { ...summary, jobs: await this.jobs(ownerId, target.companyId) };
  }

  async setFavorite(ownerId: string, campaignId: string, favorite: boolean) {
    if (favorite)
      await this.sql`
        insert into job_market_campaign_favorites(owner_id,campaign_id)
        values(${ownerId},${campaignId}) on conflict do nothing`;
    else
      await this.sql`
        delete from job_market_campaign_favorites favorite
        using job_market_campaigns selected,job_market_campaigns campaign
        where selected.id=${campaignId} and campaign.company_id=selected.company_id
          and favorite.campaign_id=campaign.id and favorite.owner_id=${ownerId}`;
    return favorite;
  }
}
