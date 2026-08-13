create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.application_status as enum ('planned','active','rejected','offer','accepted','withdrawn','no_response');
create type public.recruitment_stage as enum ('screening','assessment','written_test','interview_1','interview_2','interview_3','hr_interview','final_interview');
create type public.application_event_type as enum ('created','details_changed','status_changed','stage_added','stage_removed','imported');

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(trim(company_name)) between 1 and 200),
  position_name text not null check (char_length(trim(position_name)) between 1 and 200),
  city text check (city is null or char_length(city) <= 100),
  job_url text check (job_url is null or char_length(job_url) <= 2048),
  applied_date date not null,
  status public.application_status not null default 'active',
  notes text check (notes is null or char_length(notes) <= 10000),
  latest_date date not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latest_date >= applied_date)
);

create table public.application_stage_occurrences (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  stage public.recruitment_stage not null,
  occurred_on date not null,
  created_at timestamptz not null default now(),
  unique (application_id, stage, occurred_on)
);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  type public.application_event_type not null,
  occurred_on date not null,
  before jsonb,
  after jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index applications_search_idx on public.applications using gin ((lower(company_name || ' ' || position_name)) extensions.gin_trgm_ops);
create index applications_filter_idx on public.applications (status, applied_date desc, id);
create index applications_latest_idx on public.applications (latest_date desc, id);
create index stage_occurrences_lookup_idx on public.application_stage_occurrences (application_id, occurred_on desc);
create index application_events_lookup_idx on public.application_events (application_id, occurred_on desc, created_at desc);

alter table public.applications enable row level security;
alter table public.application_stage_occurrences enable row level security;
alter table public.application_events enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.applications, public.application_stage_occurrences, public.application_events from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.applications, public.application_stage_occurrences, public.application_events from authenticated;
  end if;
end
$$;
