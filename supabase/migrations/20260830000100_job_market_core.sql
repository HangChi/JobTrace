create type public.job_market_source_adapter as enum ('greenhouse','lever','ashby','smartrecruiters','schema_org');
create type public.job_market_source_status as enum ('active','paused','revoked');
create type public.job_market_post_status as enum ('open','stale','closed');
create type public.job_market_sync_trigger as enum ('scheduled','admin');
create type public.job_market_sync_status as enum ('running','succeeded','partial','failed');
create type public.job_market_record_status as enum ('observed','missing','closed','rejected');
create type public.job_market_event_type as enum ('created','updated','stale','closed','reopened','merged','primary_changed','rejected');

create table public.job_market_companies (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (char_length(trim(canonical_name)) between 1 and 200),
  normalized_name text not null check (char_length(trim(normalized_name)) between 1 and 200),
  aliases text[] not null default '{}',
  company_type text check (company_type is null or char_length(company_type)<=100),
  industry text check (industry is null or char_length(industry)<=200),
  website_url text check (website_url is null or website_url ~ '^https://'),
  identity_key text not null unique check (char_length(identity_key) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_market_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.job_market_companies(id) on delete restrict,
  adapter public.job_market_source_adapter not null,
  external_key text not null check (char_length(external_key) between 1 and 200),
  base_url text not null check (char_length(base_url)<=2048 and base_url ~ '^https://'),
  allowed_hosts text[] not null check (cardinality(allowed_hosts)>0),
  is_official boolean not null default true,
  access_basis text not null check (access_basis in ('public','authorized')),
  status public.job_market_source_status not null default 'paused',
  sync_interval_minutes integer not null default 360 check (sync_interval_minutes between 60 and 1440),
  next_sync_at timestamptz not null default now(),
  lease_until timestamptz,
  leased_by text check (leased_by is null or char_length(leased_by)<=100),
  consecutive_failures integer not null default 0 check (consecutive_failures>=0),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  etag text check (etag is null or char_length(etag)<=500),
  last_modified text check (last_modified is null or char_length(last_modified)<=500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,adapter,external_key),
  check ((lease_until is null)=(leased_by is null))
);

create table public.job_market_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.job_market_companies(id) on delete restrict,
  campaign_key text not null check (char_length(campaign_key) between 1 and 500),
  name text check (name is null or char_length(name)<=300),
  recruitment_type text check (recruitment_type is null or char_length(recruitment_type)<=100),
  batch_label text check (batch_label is null or char_length(batch_label)<=200),
  status public.job_market_post_status not null default 'open',
  official_apply_url text check (official_apply_url is null or official_apply_url ~ '^https://'),
  published_at timestamptz,
  valid_through timestamptz,
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,campaign_key),
  check (published_at is null or valid_through is null or valid_through>=published_at)
);

create table public.job_market_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.job_market_companies(id) on delete restrict,
  campaign_id uuid not null references public.job_market_campaigns(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 300),
  normalized_title text not null check (char_length(normalized_title) between 1 and 300),
  description_text text check (description_text is null or char_length(description_text)<=50000),
  recruitment_type text check (recruitment_type is null or char_length(recruitment_type)<=100),
  target text check (target is null or char_length(target)<=300),
  education text check (education is null or char_length(education)<=200),
  status public.job_market_post_status not null default 'open',
  primary_apply_url text check (primary_apply_url is null or primary_apply_url ~ '^https://'),
  published_at timestamptz,
  valid_through timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  missing_since timestamptz,
  last_missing_success_at timestamptz,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (published_at is null or valid_through is null or valid_through>=published_at)
);

create table public.job_market_locations (
  id uuid primary key default gen_random_uuid(),
  normalized_key text not null unique check (char_length(normalized_key) between 1 and 300),
  display_name text not null check (char_length(trim(display_name)) between 1 and 300),
  country text, region text, city text,
  is_remote boolean not null default false
);

create table public.job_market_post_locations (
  post_id uuid not null references public.job_market_posts(id) on delete cascade,
  location_id uuid not null references public.job_market_locations(id) on delete restrict,
  primary key(post_id,location_id)
);

create table public.job_market_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.job_market_sources(id) on delete restrict,
  trigger public.job_market_sync_trigger not null,
  status public.job_market_sync_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  discovered_count integer not null default 0 check(discovered_count>=0),
  created_count integer not null default 0 check(created_count>=0),
  updated_count integer not null default 0 check(updated_count>=0),
  stale_count integer not null default 0 check(stale_count>=0),
  closed_count integer not null default 0 check(closed_count>=0),
  rejected_count integer not null default 0 check(rejected_count>=0),
  error_code text check(error_code is null or char_length(error_code)<=100),
  error_summary text check(error_summary is null or char_length(error_summary)<=500),
  request_id text not null check(char_length(request_id)<=200),
  worker_id text not null check(char_length(worker_id)<=100),
  check(finished_at is null or finished_at>=started_at)
);

create table public.job_market_source_records (
  source_id uuid not null references public.job_market_sources(id) on delete restrict,
  external_job_id text not null check(char_length(external_job_id) between 1 and 500),
  post_id uuid not null references public.job_market_posts(id) on delete restrict,
  external_detail_url text check(external_detail_url is null or external_detail_url ~ '^https://'),
  external_apply_url text check(external_apply_url is null or external_apply_url ~ '^https://'),
  payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
  normalized_snapshot jsonb not null default '{}',
  status public.job_market_record_status not null default 'observed',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_seen_run_id uuid references public.job_market_sync_runs(id) on delete set null,
  primary key(source_id,external_job_id)
);

create table public.job_market_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.job_market_posts(id) on delete restrict,
  campaign_id uuid references public.job_market_campaigns(id) on delete restrict,
  source_id uuid references public.job_market_sources(id) on delete restrict,
  sync_run_id uuid references public.job_market_sync_runs(id) on delete restrict,
  event_type public.job_market_event_type not null,
  reason_code text not null check(char_length(reason_code)<=100),
  change_summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index job_market_source_claim_idx on public.job_market_sources(next_sync_at,lease_until) where status='active';
create index job_market_campaign_browse_idx on public.job_market_campaigns(status,last_confirmed_at desc,id);
create index job_market_campaign_company_idx on public.job_market_campaigns(company_id,campaign_key);
create index job_market_post_campaign_idx on public.job_market_posts(campaign_id,status);
create index job_market_post_company_title_idx on public.job_market_posts(company_id,normalized_title);
create index job_market_post_published_idx on public.job_market_posts(published_at desc);
create index job_market_location_posts_idx on public.job_market_post_locations(location_id,post_id);
create index job_market_source_record_post_idx on public.job_market_source_records(post_id);
create index job_market_run_source_idx on public.job_market_sync_runs(source_id,started_at desc);
create index job_market_event_post_idx on public.job_market_events(post_id,created_at desc);
create index job_market_company_search_idx on public.job_market_companies using gin(normalized_name extensions.gin_trgm_ops);
create index job_market_post_search_idx on public.job_market_posts using gin(normalized_title extensions.gin_trgm_ops);

alter table public.job_market_companies enable row level security;
alter table public.job_market_sources enable row level security;
alter table public.job_market_campaigns enable row level security;
alter table public.job_market_posts enable row level security;
alter table public.job_market_locations enable row level security;
alter table public.job_market_post_locations enable row level security;
alter table public.job_market_sync_runs enable row level security;
alter table public.job_market_source_records enable row level security;
alter table public.job_market_events enable row level security;

do $$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.job_market_companies,public.job_market_sources,public.job_market_campaigns,public.job_market_posts,public.job_market_locations,public.job_market_post_locations,public.job_market_sync_runs,public.job_market_source_records,public.job_market_events from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.job_market_companies,public.job_market_sources,public.job_market_campaigns,public.job_market_posts,public.job_market_locations,public.job_market_post_locations,public.job_market_sync_runs,public.job_market_source_records,public.job_market_events from authenticated;
  end if;
end $$;
