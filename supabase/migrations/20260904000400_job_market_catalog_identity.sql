alter table public.job_market_sources
  add column catalog_key text;

alter table public.job_market_sources
  add constraint job_market_sources_catalog_key_check
  check (catalog_key is null or char_length(catalog_key) between 1 and 200);

create unique index job_market_sources_catalog_key_idx
  on public.job_market_sources(catalog_key)
  where catalog_key is not null;
