alter table public.job_market_campaigns
  add column listing_kind text not null default 'synced_jobs';

alter table public.job_market_campaigns
  add constraint job_market_campaigns_listing_kind_check
  check (listing_kind in ('synced_jobs','recruitment_directory'));

create index job_market_campaign_listing_kind_idx
  on public.job_market_campaigns(listing_kind,status,company_id);

comment on column public.job_market_campaigns.listing_kind is
  'Distinguishes synchronized job batches from company-level recruitment directory entries that do not contain collected jobs.';
