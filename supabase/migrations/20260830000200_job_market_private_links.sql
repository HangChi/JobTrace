create table public.job_market_campaign_favorites (
  owner_id text not null references public.users(id) on delete cascade,
  campaign_id uuid not null references public.job_market_campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id,campaign_id)
);

create table public.application_job_market_links (
  application_id uuid primary key references public.applications(id) on delete cascade,
  owner_id text not null references public.users(id) on delete cascade,
  post_id uuid not null references public.job_market_posts(id) on delete restrict,
  source_id uuid,
  external_job_id text,
  job_title_snapshot text not null check(char_length(job_title_snapshot) between 1 and 300),
  company_name_snapshot text not null check(char_length(company_name_snapshot) between 1 and 200),
  location_snapshot text,
  apply_url_snapshot text check(apply_url_snapshot is null or apply_url_snapshot ~ '^https://'),
  created_at timestamptz not null default now(),
  unique(owner_id,post_id),
  foreign key(source_id,external_job_id) references public.job_market_source_records(source_id,external_job_id) on delete set null
);

create index job_market_favorite_owner_idx on public.job_market_campaign_favorites(owner_id,created_at desc);
create index application_job_market_owner_idx on public.application_job_market_links(owner_id,post_id);

alter table public.job_market_campaign_favorites enable row level security;
alter table public.application_job_market_links enable row level security;

create policy job_market_favorites_owner_select on public.job_market_campaign_favorites for select using(owner_id=current_setting('app.current_user_id',true));
create policy job_market_favorites_owner_insert on public.job_market_campaign_favorites for insert with check(owner_id=current_setting('app.current_user_id',true));
create policy job_market_favorites_owner_delete on public.job_market_campaign_favorites for delete using(owner_id=current_setting('app.current_user_id',true));
create policy application_job_market_owner_select on public.application_job_market_links for select using(owner_id=current_setting('app.current_user_id',true));
create policy application_job_market_owner_insert on public.application_job_market_links for insert with check(owner_id=current_setting('app.current_user_id',true));

create or replace function public.enforce_application_job_market_owner() returns trigger
language plpgsql set search_path=public as $$ begin
  if not exists(select 1 from applications where id=new.application_id and owner_id=new.owner_id) then
    raise exception using errcode='23514',message='application_job_market_owner_mismatch';
  end if;
  return new;
end $$;

create trigger application_job_market_owner_guard before insert or update on public.application_job_market_links
for each row execute function public.enforce_application_job_market_owner();

do $$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.job_market_campaign_favorites,public.application_job_market_links from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.job_market_campaign_favorites,public.application_job_market_links from authenticated;
  end if;
end $$;
