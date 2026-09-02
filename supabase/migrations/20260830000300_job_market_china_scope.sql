alter type public.job_market_source_adapter add value if not exists 'xiaomi';

alter table public.job_market_sources
  add column country_codes text[] not null default '{}';

alter table public.job_market_sources
  add constraint job_market_sources_country_codes_check
  check (
    cardinality(country_codes) <= 10
    and (
      cardinality(country_codes) = 0
      or array_to_string(country_codes, ',') ~ '^([a-z]{2})(,[a-z]{2})*$'
    )
  );

comment on column public.job_market_sources.country_codes is
  'Optional ISO 3166-1 alpha-2 location allowlist applied during ingestion.';
