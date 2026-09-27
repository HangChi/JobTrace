create table public.job_market_admin_jobs (
  id uuid primary key,
  kind text not null check(kind in(
    'wechat_collect','ats_site_scan','company_research','source_discovery','catalog_bootstrap'
  )),
  status text not null check(status in('running','succeeded','failed')),
  started_at timestamptz not null,
  finished_at timestamptz,
  lease_expires_at timestamptz,
  progress jsonb not null,
  result jsonb,
  error text,
  check(
    (status='running' and finished_at is null and lease_expires_at is not null)
    or
    (status<>'running' and finished_at is not null and lease_expires_at is null)
  )
);

create unique index job_market_admin_jobs_running_kind_unique
  on public.job_market_admin_jobs(kind) where status='running';
create index job_market_admin_jobs_finished_idx
  on public.job_market_admin_jobs(finished_at) where status<>'running';

alter table public.job_market_admin_jobs enable row level security;

do $$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.job_market_admin_jobs from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.job_market_admin_jobs from authenticated;
  end if;
end $$;

comment on table public.job_market_admin_jobs is
  'Persistent, leased execution state for administrator-triggered job-market operations.';
