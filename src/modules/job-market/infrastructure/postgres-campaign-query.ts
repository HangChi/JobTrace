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

  async list(ownerId: string, query: CampaignQuery) {
    const includeClosed = query.favorite === true || query.status === "closed";
    const q = query.q?.toLowerCase();
    const company = query.company?.toLowerCase();
    const location = query.location?.toLowerCase();
    const rows = await this.sql<Array<CampaignRow & { total: number }>>`
      with eligible as materialized (
        select model.company_id,model.published_at,model.last_confirmed_at
        from job_market_company_read_models model
        join job_market_companies company on company.id=model.company_id
        where model.include_closed=${includeClosed}
          and (${query.campaignId ?? null}::text is null or exists(
            select 1 from job_market_campaigns requested
            where requested.company_id=model.company_id
              and requested.id=${query.campaignId ?? null}::uuid
          ))
          and (${q ?? null}::text is null or model.search_text like ${q ? `%${q}%` : null}::text)
          and (${company ?? null}::text is null or lower(company.canonical_name) like ${company ? `%${company}%` : null}::text)
          and (${location ?? null}::text is null or model.location_text like ${location ? `%${location}%` : null}::text)
          and (${query.status ?? null}::text is null or model.status::text=${query.status ?? null}::text)
          and (${query.postedFrom ?? null}::text is null or model.published_at::date>=${query.postedFrom ?? null}::date)
          and (${query.favorite ?? null}::boolean is not true or exists(
            select 1 from job_market_campaign_favorites favorite
            join job_market_campaigns campaign on campaign.id=favorite.campaign_id
            where campaign.company_id=model.company_id and favorite.owner_id=${ownerId}
          ))
      ), totals as (
        select count(*)::int as total from eligible
      ), selected as (
        select *
        from eligible
        order by published_at desc nulls last,last_confirmed_at desc nulls last,company_id
        limit ${query.limit} offset ${(query.page - 1) * query.limit}
      )
      select model.representative_campaign_id as id,model.listing_kind as "listingKind",
        jsonb_build_object(
          'id',company.id,'name',company.canonical_name,
          'type',company.company_type,'industry',company.industry
        ) as company,
        null::text as "campaignName",model.recruitment_type as "recruitmentType",
        null::text as "batchLabel",
        case when ${query.campaignId ?? null}::text is null then model.positions[1:50] else model.positions end as positions,
        model.position_count as "positionCount",model.locations,
        model.status::text,model.primary_apply_url as "primaryApplyUrl",model.source_name as "sourceName",
        model.source_url as "sourceUrl",model.published_at as "publishedAt",model.valid_through as "validThrough",
        model.last_confirmed_at as "lastConfirmedAt",exists(
          select 1 from job_market_campaign_favorites favorite
          join job_market_campaigns campaign on campaign.id=favorite.campaign_id
          where campaign.company_id=model.company_id and favorite.owner_id=${ownerId}
        ) as "isFavorite",totals.total
      from totals
      left join selected on true
      left join job_market_company_read_models model
        on model.company_id=selected.company_id and model.include_closed=${includeClosed}
      left join job_market_companies company on company.id=model.company_id
      order by model.published_at desc nulls last,model.last_confirmed_at desc nulls last,model.company_id`;

    const dataRows = rows.filter((row) => row.id);
    const items = dataRows.map(({ total: _total, ...row }) => {
      void _total;
      return {
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
      } as CampaignSummary;
    });
    return {
      items,
      page: query.page,
      limit: query.limit,
      total: rows[0]?.total ?? 0,
    };
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
    const [result] = favorite
      ? await this.sql<Array<{ campaignExists: boolean }>>`
          with target as (
            select id from job_market_campaigns where id=${campaignId}
          ), inserted as (
            insert into job_market_campaign_favorites(owner_id,campaign_id)
            select ${ownerId},id from target on conflict do nothing
          )
          select exists(select 1 from target) as "campaignExists"`
      : await this.sql<Array<{ campaignExists: boolean }>>`
          with target as (
            select company_id from job_market_campaigns where id=${campaignId}
          ), deleted as (
            delete from job_market_campaign_favorites favorite
            using target,job_market_campaigns campaign
            where campaign.company_id=target.company_id
              and favorite.campaign_id=campaign.id and favorite.owner_id=${ownerId}
          )
          select exists(select 1 from target) as "campaignExists"`;
    return result.campaignExists ? favorite : null;
  }
}
