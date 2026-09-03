-- Match the expressions used by the public browse query. The original trigram
-- indexes target normalized columns, while the query intentionally searches
-- the user-facing values with lower(...), so PostgreSQL cannot reuse them.
create index if not exists job_market_company_canonical_search_idx
  on public.job_market_companies
  using gin ((lower(canonical_name)) extensions.gin_trgm_ops);

create index if not exists job_market_post_title_search_idx
  on public.job_market_posts
  using gin ((lower(title)) extensions.gin_trgm_ops);

create index if not exists job_market_location_display_search_idx
  on public.job_market_locations
  using gin ((lower(display_name)) extensions.gin_trgm_ops);

-- Support the repeated company/status lookups and lateral ordering used to
-- assemble one public recruitment card per company.
create index if not exists job_market_post_company_status_date_idx
  on public.job_market_posts(company_id,status,published_at desc,id);

create index if not exists job_market_campaign_company_listing_status_idx
  on public.job_market_campaigns(company_id,listing_kind,status,published_at desc,id);

create index if not exists job_market_source_company_status_success_idx
  on public.job_market_sources(company_id,status,is_official desc,last_success_at desc,id);
