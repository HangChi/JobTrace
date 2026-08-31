import { createServerDatabase } from "@/shared/database";
import type { CampaignRepository, CampaignQuery } from "../application/ports";
import type { CampaignDetail, CampaignSummary } from "../domain/entities";
import {
  applyTargetForJobs,
  applyUnavailableReason,
} from "../domain/apply-target";

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
      (${query.campaignId ?? null}::text is null or campaign.id=${query.campaignId ?? null}::uuid)
      and exists(
        select 1 where campaign.listing_kind='recruitment_directory'
        union all
        select 1 from job_market_posts visible_post
          join job_market_source_records visible_record on visible_record.post_id=visible_post.id
          join job_market_sources visible_source on visible_source.id=visible_record.source_id
          where visible_post.campaign_id=campaign.id and visible_source.status='active'
      )
      and (${q ?? null}::text is null or lower(company.canonical_name) like ${q ? `%${q}%` : null}::text
        or exists(select 1 from job_market_posts p where p.campaign_id=campaign.id
          and (campaign.status='closed' or p.status<>'closed') and lower(p.title) like ${q ? `%${q}%` : null}))
      and (${query.company ?? null}::text is null or lower(company.canonical_name) like ${query.company ? `%${query.company.toLowerCase()}%` : null}::text)
      and (${query.location ?? null}::text is null or exists(select 1 from job_market_posts p join job_market_post_locations pl on pl.post_id=p.id
        join job_market_locations l on l.id=pl.location_id where p.campaign_id=campaign.id
          and (campaign.status='closed' or p.status<>'closed') and lower(l.display_name) like ${query.location ? `%${query.location.toLowerCase()}%` : null}::text))
      and (${query.recruitmentType ?? null}::text is null or campaign.recruitment_type=${query.recruitmentType ?? null}::text)
      and (${query.status ?? null}::text is null or campaign.status::text=${query.status ?? null}::text)
      and (${query.postedFrom ?? null}::text is null or campaign.published_at::date>=${query.postedFrom ?? null}::date)
      and (${query.favorite ?? null}::boolean is not true or exists(select 1 from job_market_campaign_favorites f where f.campaign_id=campaign.id and f.owner_id=${ownerId}))`;
  }
  async list(ownerId: string, query: CampaignQuery) {
    const filters = this.filters(ownerId, query);
    const [count] = await this.sql<
      Array<{ total: number }>
    >`select count(*)::int as total from job_market_campaigns campaign
      join job_market_companies company on company.id=campaign.company_id where ${filters}`;
    const rows = await this.sql<CampaignRow[]>`
      select campaign.id,campaign.listing_kind as "listingKind",jsonb_build_object('id',company.id,'name',company.canonical_name,'type',company.company_type,'industry',company.industry) as company,
        campaign.name as "campaignName",campaign.recruitment_type as "recruitmentType",campaign.batch_label as "batchLabel",
        coalesce((select array_agg(distinct p.title order by p.title) from job_market_posts p where p.campaign_id=campaign.id
          and (campaign.status='closed' or p.status<>'closed')),'{}') as positions,
        (select count(distinct p.normalized_title)::int from job_market_posts p where p.campaign_id=campaign.id
          and (campaign.status='closed' or p.status<>'closed')) as "positionCount",
        coalesce((select jsonb_agg(x order by x->>'name') from (select distinct jsonb_build_object('name',l.display_name,'isRemote',l.is_remote) x
          from job_market_posts p join job_market_post_locations pl on pl.post_id=p.id join job_market_locations l on l.id=pl.location_id
          where p.campaign_id=campaign.id and (campaign.status='closed' or p.status<>'closed')) locations),'[]') as locations,
        campaign.status::text as status,campaign.official_apply_url as "primaryApplyUrl",
        case when campaign.listing_kind='recruitment_directory' then campaign.recruitment_type else source.adapter::text end as "sourceName",
        case when campaign.listing_kind='recruitment_directory' then campaign.official_apply_url else source.base_url end as "sourceUrl",
        campaign.published_at as "publishedAt",campaign.valid_through as "validThrough",campaign.last_confirmed_at as "lastConfirmedAt",
        exists(select 1 from job_market_campaign_favorites f where f.campaign_id=campaign.id and f.owner_id=${ownerId}) as "isFavorite"
      from job_market_campaigns campaign join job_market_companies company on company.id=campaign.company_id
      left join lateral (select s.* from job_market_sources s where s.company_id=company.id and s.status='active' order by s.is_official desc,s.last_success_at desc nulls last limit 1) source on true
      where ${filters}
      order by case when campaign.listing_kind='synced_jobs' then 0 else 1 end,
        case when company.company_type='外企' then 1 else 0 end,
        campaign.last_confirmed_at desc nulls last,campaign.id
      limit ${query.limit} offset ${(query.page - 1) * query.limit}`;
    const items = await Promise.all(
      rows.map(async (row) => {
        const jobs = await this.jobs(ownerId, row.id);
        const target = applyTargetForJobs(jobs, row.primaryApplyUrl);
        return {
          ...row,
          source: { name: row.sourceName ?? "unknown", url: row.sourceUrl },
          applyMode: target.mode,
          primaryApplyUrl: target.primaryApplyUrl,
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
      }),
    );
    return { items, page: query.page, limit: query.limit, total: count.total };
  }
  private async jobs(ownerId: string, campaignId: string) {
    const rows = await this.sql<
      Array<any>
    >`select p.id,p.title,p.status::text as status,p.primary_apply_url as "applyUrl",p.published_at as "publishedAt",p.valid_through as "validThrough",
      source.adapter::text as "sourceName",source.base_url as "sourceUrl",link.application_id as "alreadyTrackedApplicationId",
      coalesce((select jsonb_agg(jsonb_build_object('name',l.display_name,'isRemote',l.is_remote) order by l.display_name) from job_market_post_locations pl join job_market_locations l on l.id=pl.location_id where pl.post_id=p.id),'[]') as locations
      from job_market_posts p left join lateral(select s.adapter,s.base_url from job_market_source_records r join job_market_sources s on s.id=r.source_id where r.post_id=p.id and s.status='active' order by s.is_official desc,r.last_seen_at desc limit 1) source on true
      left join application_job_market_links link on link.post_id=p.id and link.owner_id=${ownerId}
      where p.campaign_id=${campaignId} and source.adapter is not null order by p.title,p.id`;
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
    const page = await this.list(ownerId, { page: 1, limit: 1, campaignId });
    const summary = page.items[0] ?? null;
    if (!summary) return null;
    return { ...summary, jobs: await this.jobs(ownerId, campaignId) };
  }
  async setFavorite(ownerId: string, campaignId: string, favorite: boolean) {
    if (favorite)
      await this
        .sql`insert into job_market_campaign_favorites(owner_id,campaign_id) values(${ownerId},${campaignId}) on conflict do nothing`;
    else
      await this
        .sql`delete from job_market_campaign_favorites where owner_id=${ownerId} and campaign_id=${campaignId}`;
    return favorite;
  }
}
