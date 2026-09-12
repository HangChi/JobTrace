create table public.job_market_company_candidates (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 2 and 60),
  normalized_name text not null,
  article_url text not null check (article_url ~ '^https://'),
  article_title text not null check (char_length(article_title) between 4 and 300),
  snippet text check (snippet is null or char_length(snippet) <= 500),
  published_at timestamptz,
  source_engine text not null check (source_engine in ('sogou','bing','site_scan')),
  article_count integer not null default 1 check (article_count >= 1),
  detected_adapter public.job_market_source_adapter,
  detected_external_key text check (detected_external_key is null or char_length(detected_external_key) between 1 and 200),
  detected_base_url text check (detected_base_url is null or detected_base_url ~ '^https://'),
  detected_allowed_hosts text[] not null default '{}',
  detected_confidence text check (detected_confidence in ('high','medium')),
  review_status text not null default 'pending'
    check (review_status in ('pending','approved','ignored')),
  created_company_id uuid references public.job_market_companies(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (detected_adapter is null and detected_external_key is null
      and detected_base_url is null and cardinality(detected_allowed_hosts) = 0)
    or (detected_adapter is not null and detected_external_key is not null
      and detected_base_url is not null and cardinality(detected_allowed_hosts) > 0)
  ),
  check (review_status <> 'approved' or created_company_id is not null)
);

create unique index job_market_company_candidate_name_idx
  on public.job_market_company_candidates(normalized_name);
create index job_market_company_candidate_review_idx
  on public.job_market_company_candidates(review_status, created_at desc, id);

comment on table public.job_market_company_candidates is
  'WeChat recruitment articles collected from public search engines; approving a candidate creates the company and its WeChat directory entry.';
