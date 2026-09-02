create table public.job_market_source_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.job_market_companies(id) on delete cascade,
  entry_url text not null check (entry_url ~ '^https://'),
  adapter public.job_market_source_adapter,
  external_key text check (external_key is null or char_length(external_key) between 1 and 200),
  base_url text check (base_url is null or base_url ~ '^https://'),
  allowed_hosts text[] not null default '{}',
  confidence text check (confidence in ('high','medium')),
  evidence_code text not null check (char_length(evidence_code) between 1 and 100),
  review_status text not null default 'unrecognized'
    check (review_status in ('unrecognized','pending','approved','ignored')),
  health_status text not null
    check (health_status in ('healthy','unreachable','unsupported')),
  diagnostic_code text check (diagnostic_code is null or char_length(diagnostic_code) <= 100),
  diagnostic_summary text check (diagnostic_summary is null or char_length(diagnostic_summary) <= 500),
  http_status integer check (http_status is null or http_status between 100 and 599),
  approved_source_id uuid references public.job_market_sources(id) on delete set null,
  last_checked_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((adapter is null and external_key is null and base_url is null and cardinality(allowed_hosts) = 0)
    or (adapter is not null and external_key is not null and base_url is not null and cardinality(allowed_hosts) > 0)),
  check (review_status <> 'approved' or approved_source_id is not null)
);

create unique index job_market_source_candidate_entry_idx
  on public.job_market_source_candidates(company_id, entry_url);
create index job_market_source_candidate_review_idx
  on public.job_market_source_candidates(review_status, last_checked_at desc, id);

comment on table public.job_market_source_candidates is
  'Safe directory health observations and detected source candidates; discovery never enables a source without administrator approval.';
