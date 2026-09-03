-- Merge duplicate default:* companies that were created one per catalog
-- entry (e.g. social + campus sources of the same employer, or legacy
-- catalog + wechat-article rows sharing a company name). The campaign
-- listing groups by company, so duplicated rows rendered one card per
-- recruitment source instead of one per employer.

-- 1. Map every duplicate to the group's surviving company. row_number keeps
--    the mapping one-directional even when created_at ties inside the same
--    bootstrap transaction.
create temp table company_merge on commit drop as
with ranked as (
  select id, normalized_name,
    row_number() over (
      partition by normalized_name order by created_at, id
    ) as rn
  from public.job_market_companies
  where identity_key like 'default:%'
)
select duplicate.id as from_id, keeper.id as to_id
from ranked duplicate
join ranked keeper
  on keeper.normalized_name = duplicate.normalized_name
 and keeper.rn = 1
where duplicate.rn > 1;

-- 2. Sources: (company_id, adapter, external_key) stays unique because the
--    duplicated entries always carry distinct external keys.
update public.job_market_sources source
set company_id = merge.to_id, updated_at = now()
from company_merge merge
where source.company_id = merge.from_id;

-- 3. Campaigns with a clashing (company_id, campaign_key) collapse into the
--    keeper campaign so the unique constraint survives; their posts move to
--    the keeper campaign first.
update public.job_market_posts post
set campaign_id = keeper_campaign.id, updated_at = now()
from company_merge merge,
     public.job_market_campaigns duplicate_campaign,
     public.job_market_campaigns keeper_campaign
where duplicate_campaign.company_id = merge.from_id
  and keeper_campaign.company_id = merge.to_id
  and keeper_campaign.campaign_key = duplicate_campaign.campaign_key
  and post.campaign_id = duplicate_campaign.id;

delete from public.job_market_campaigns duplicate_campaign
using company_merge merge, public.job_market_campaigns keeper_campaign
where duplicate_campaign.company_id = merge.from_id
  and keeper_campaign.company_id = merge.to_id
  and keeper_campaign.campaign_key = duplicate_campaign.campaign_key;

update public.job_market_campaigns campaign
set company_id = merge.to_id, updated_at = now()
from company_merge merge
where campaign.company_id = merge.from_id;

-- 4. Posts and discovery candidates follow their company.
update public.job_market_posts post
set company_id = merge.to_id, updated_at = now()
from company_merge merge
where post.company_id = merge.from_id;

delete from public.job_market_source_candidates candidate
using company_merge merge, public.job_market_source_candidates clash
where candidate.company_id = merge.from_id
  and clash.company_id = merge.to_id
  and clash.entry_url = candidate.entry_url;

update public.job_market_source_candidates candidate
set company_id = merge.to_id
from company_merge merge
where candidate.company_id = merge.from_id;

-- 5. Drop the emptied duplicate company rows.
delete from public.job_market_companies duplicate
using company_merge merge
where duplicate.id = merge.from_id;
