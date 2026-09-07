create table public.job_market_company_read_models (
  company_id uuid not null references public.job_market_companies(id) on delete cascade,
  include_closed boolean not null,
  representative_campaign_id uuid not null references public.job_market_campaigns(id) on delete cascade,
  listing_kind text not null check (listing_kind in ('synced_jobs','recruitment_directory')),
  recruitment_type text,
  positions text[] not null default '{}',
  position_count integer not null default 0 check (position_count>=0),
  locations jsonb not null default '[]'::jsonb,
  status public.job_market_post_status not null,
  primary_apply_url text,
  source_name text,
  source_url text,
  published_at timestamptz,
  valid_through timestamptz,
  last_confirmed_at timestamptz,
  search_text text not null default '',
  location_text text not null default '',
  refreshed_at timestamptz not null default now(),
  primary key(company_id,include_closed)
);

create index job_market_company_read_model_browse_idx
  on public.job_market_company_read_models(include_closed,published_at desc,last_confirmed_at desc,company_id);
create index job_market_company_read_model_status_idx
  on public.job_market_company_read_models(include_closed,status,published_at desc,company_id);
create index job_market_company_read_model_search_idx
  on public.job_market_company_read_models using gin(search_text extensions.gin_trgm_ops);
create index job_market_company_read_model_location_idx
  on public.job_market_company_read_models using gin(location_text extensions.gin_trgm_ops);

create or replace function public.refresh_job_market_company_read_model(p_company_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_include_closed boolean;
begin
  delete from public.job_market_company_read_models where company_id=p_company_id;
  foreach v_include_closed in array array[false,true] loop
    insert into public.job_market_company_read_models(
      company_id,include_closed,representative_campaign_id,listing_kind,recruitment_type,
      positions,position_count,locations,status,primary_apply_url,source_name,source_url,
      published_at,valid_through,last_confirmed_at,search_text,location_text,refreshed_at
    )
    with company as (
      select * from public.job_market_companies where id=p_company_id
    ), visible_posts as materialized (
      select distinct post.*
      from public.job_market_posts post
      join public.job_market_source_records record on record.post_id=post.id
      join public.job_market_sources source on source.id=record.source_id and source.status='active'
      where post.company_id=p_company_id and (post.status<>'closed' or v_include_closed)
    ), directory as (
      select campaign.* from public.job_market_campaigns campaign
      where campaign.company_id=p_company_id
        and campaign.listing_kind='recruitment_directory'
        and (campaign.status<>'closed' or v_include_closed)
      order by case when campaign.recruitment_type='招聘官网' then 0 else 1 end,
        campaign.published_at desc nulls last,campaign.id
      limit 1
    ), representative as (
      select candidate.id,candidate.listing_kind,candidate.recruitment_type
      from (
        select campaign.id,campaign.listing_kind,campaign.recruitment_type,0 as priority,
          campaign.created_at
        from public.job_market_campaigns campaign
        where campaign.company_id=p_company_id and campaign.listing_kind='synced_jobs'
          and exists(select 1 from visible_posts post where post.campaign_id=campaign.id)
        union all
        select directory.id,directory.listing_kind,directory.recruitment_type,1,directory.created_at
        from directory
      ) candidate
      order by candidate.priority,candidate.created_at,candidate.id
      limit 1
    ), preferred_source as (
      select source.* from public.job_market_sources source
      where source.company_id=p_company_id and source.status='active'
      order by source.is_official desc,source.last_success_at desc nulls last,source.id
      limit 1
    ), location_rows as (
      select distinct location.display_name as name,location.is_remote
      from visible_posts post
      join public.job_market_post_locations relation on relation.post_id=post.id
      join public.job_market_locations location on location.id=relation.location_id
    ), aggregate_values as (
      select
        coalesce((select array_agg(distinct title order by title) from visible_posts),'{}') as positions,
        (select count(distinct normalized_title)::int from visible_posts) as position_count,
        coalesce((select jsonb_agg(jsonb_build_object('name',name,'isRemote',is_remote) order by name) from location_rows),'[]') as locations,
        coalesce((select string_agg(name,' ' order by name) from location_rows),'') as location_text,
        (select max(published_at) from visible_posts) as post_published_at,
        (select max(valid_through) from visible_posts) as valid_through,
        (select max(last_confirmed_at) from public.job_market_campaigns where company_id=p_company_id) as last_confirmed_at,
        exists(select 1 from public.job_market_posts post join public.job_market_source_records record on record.post_id=post.id join public.job_market_sources source on source.id=record.source_id and source.status='active' where post.company_id=p_company_id and post.status='open')
          or exists(select 1 from public.job_market_campaigns campaign where campaign.company_id=p_company_id and campaign.listing_kind='recruitment_directory' and campaign.status='open') as has_open,
        exists(select 1 from public.job_market_posts post join public.job_market_source_records record on record.post_id=post.id join public.job_market_sources source on source.id=record.source_id and source.status='active' where post.company_id=p_company_id and post.status='stale')
          or exists(select 1 from public.job_market_campaigns campaign where campaign.company_id=p_company_id and campaign.listing_kind='recruitment_directory' and campaign.status='stale') as has_stale
    )
    select company.id,v_include_closed,representative.id,representative.listing_kind,
      case when representative.listing_kind='synced_jobs' then null else directory.recruitment_type end,
      aggregate_values.positions,aggregate_values.position_count,aggregate_values.locations,
      case when aggregate_values.has_open then 'open'::public.job_market_post_status
        when aggregate_values.has_stale then 'stale'::public.job_market_post_status
        else 'closed'::public.job_market_post_status end,
      case when representative.listing_kind='synced_jobs' then coalesce(company.website_url,preferred_source.base_url) else directory.official_apply_url end,
      case when representative.listing_kind='synced_jobs' then preferred_source.adapter::text else directory.recruitment_type end,
      case when representative.listing_kind='synced_jobs' then coalesce(company.website_url,preferred_source.base_url) else directory.official_apply_url end,
      coalesce(aggregate_values.post_published_at,directory.published_at),aggregate_values.valid_through,
      aggregate_values.last_confirmed_at,
      lower(concat_ws(' ',company.canonical_name,array_to_string(aggregate_values.positions,' '))),
      lower(aggregate_values.location_text),now()
    from company
    join representative on true
    left join directory on true
    left join preferred_source on true
    cross join aggregate_values;
  end loop;
end;
$$;

create or replace function public.rebuild_job_market_company_read_models()
returns void language sql security definer set search_path=public,pg_temp as $$
  select public.refresh_job_market_company_read_model(id)
  from public.job_market_companies
  order by id;
$$;

create or replace function public.refresh_job_market_read_model_after_sync()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_company_id uuid;
begin
  if old.status='running' and new.status in ('succeeded','partial') then
    select company_id into v_company_id from public.job_market_sources where id=new.source_id;
    perform public.refresh_job_market_company_read_model(v_company_id);
  end if;
  return new;
end;
$$;

create trigger job_market_sync_refresh_company_read_model
after update of status on public.job_market_sync_runs
for each row execute function public.refresh_job_market_read_model_after_sync();

select public.rebuild_job_market_company_read_models();

alter table public.job_market_company_read_models enable row level security;

do $$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.job_market_company_read_models from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.job_market_company_read_models from authenticated;
  end if;
end $$;

revoke execute on function public.refresh_job_market_company_read_model(uuid) from public;
revoke execute on function public.rebuild_job_market_company_read_models() from public;
revoke execute on function public.refresh_job_market_read_model_after_sync() from public;

comment on table public.job_market_company_read_models is
  'Rebuildable public-only company browse projection; owner favorites are merged at query time.';
