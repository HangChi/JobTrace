create or replace function public.apply_job_market_batch(
  p_source_id uuid,
  p_run_id uuid,
  p_jobs jsonb,
  p_completeness text,
  p_rejected_count integer,
  p_observed_at timestamptz
)
returns table(
  discovered integer,
  created integer,
  updated integer,
  stale integer,
  closed integer,
  rejected integer
)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into strict v_company_id
  from public.job_market_sources
  where id = p_source_id;

  drop table if exists pg_temp.job_market_batch_input;
  drop table if exists pg_temp.job_market_batch_matches;

  create temporary table job_market_batch_input on commit drop as
  select *
  from jsonb_to_recordset(coalesce(p_jobs, '[]'::jsonb)) as input(
    ordinal integer,
    proposed_post_id uuid,
    external_job_id text,
    title text,
    normalized_title text,
    description_text text,
    recruitment_type text,
    target text,
    education text,
    source_status text,
    detail_url text,
    apply_url text,
    published_at timestamptz,
    valid_through timestamptz,
    content_hash text,
    campaign_key text,
    campaign_name text,
    batch_label text,
    locations jsonb
  );

  insert into public.job_market_campaigns(
    company_id,campaign_key,name,recruitment_type,batch_label,status,
    published_at,valid_through,last_confirmed_at
  )
  select distinct on (campaign_key)
    v_company_id,campaign_key,campaign_name,recruitment_type,batch_label,
    'open'::public.job_market_post_status,published_at,valid_through,p_observed_at
  from pg_temp.job_market_batch_input
  order by campaign_key,ordinal
  on conflict(company_id,campaign_key) do update set
    name=coalesce(excluded.name,public.job_market_campaigns.name),
    recruitment_type=coalesce(excluded.recruitment_type,public.job_market_campaigns.recruitment_type),
    batch_label=coalesce(excluded.batch_label,public.job_market_campaigns.batch_label),
    last_confirmed_at=excluded.last_confirmed_at,
    updated_at=now();

  create temporary table job_market_batch_matches on commit drop as
  select
    input.*,
    campaign.id campaign_id,
    coalesce(source_match.post_id,url_match.post_id,input.proposed_post_id) post_id,
    coalesce(source_match.content_hash,url_match.content_hash) prior_content_hash,
    coalesce(source_match.status,url_match.status) prior_status,
    case
      when coalesce(source_match.post_id,url_match.post_id) is null then 'created'
      when coalesce(source_match.content_hash,url_match.content_hash)=input.content_hash
        and coalesce(source_match.status,url_match.status)=
          case when input.source_status='closed' then 'closed' else 'open' end
        then 'unchanged'
      else 'updated'
    end change_kind
  from pg_temp.job_market_batch_input input
  join public.job_market_campaigns campaign
    on campaign.company_id=v_company_id and campaign.campaign_key=input.campaign_key
  left join lateral (
    select record.post_id,post.content_hash,post.status::text
    from public.job_market_source_records record
    join public.job_market_posts post on post.id=record.post_id
    where record.source_id=p_source_id
      and record.external_job_id=input.external_job_id
    limit 1
  ) source_match on true
  left join lateral (
    select post.id post_id,post.content_hash,post.status::text
    from public.job_market_posts post
    join public.job_market_source_records record on record.post_id=post.id
    where source_match.post_id is null
      and post.company_id=v_company_id
      and (
        (input.detail_url is not null and record.external_detail_url=input.detail_url)
        or (input.apply_url is not null and record.external_apply_url=input.apply_url)
      )
    order by record.last_seen_at desc,post.id
    limit 1
  ) url_match on true;

  insert into public.job_market_posts(
    id,company_id,campaign_id,title,normalized_title,description_text,
    recruitment_type,target,education,status,primary_apply_url,published_at,
    valid_through,first_seen_at,last_seen_at,content_hash
  )
  select distinct on (post_id)
    post_id,v_company_id,campaign_id,title,normalized_title,description_text,
    recruitment_type,target,education,
    case when source_status='closed' then 'closed' else 'open' end::public.job_market_post_status,
    apply_url,published_at,valid_through,p_observed_at,p_observed_at,content_hash
  from pg_temp.job_market_batch_matches
  where change_kind='created'
  order by post_id,ordinal;

  update public.job_market_posts post set
    campaign_id=case when matched.change_kind='updated' then matched.campaign_id else post.campaign_id end,
    title=case when matched.change_kind='updated' then matched.title else post.title end,
    normalized_title=case when matched.change_kind='updated' then matched.normalized_title else post.normalized_title end,
    description_text=case when matched.change_kind='updated' then matched.description_text else post.description_text end,
    recruitment_type=case when matched.change_kind='updated' then matched.recruitment_type else post.recruitment_type end,
    target=case when matched.change_kind='updated' then matched.target else post.target end,
    education=case when matched.change_kind='updated' then matched.education else post.education end,
    status=case when matched.change_kind='updated'
      then (case when matched.source_status='closed' then 'closed' else 'open' end)::public.job_market_post_status
      else post.status end,
    primary_apply_url=case when matched.change_kind='updated' then coalesce(matched.apply_url,post.primary_apply_url) else post.primary_apply_url end,
    published_at=case when matched.change_kind='updated' then matched.published_at else post.published_at end,
    valid_through=case when matched.change_kind='updated' then matched.valid_through else post.valid_through end,
    last_seen_at=p_observed_at,
    missing_since=null,
    last_missing_success_at=null,
    content_hash=case when matched.change_kind='updated' then matched.content_hash else post.content_hash end,
    updated_at=case when matched.change_kind='updated' then now() else post.updated_at end
  from (
    select distinct on (post_id) *
    from pg_temp.job_market_batch_matches
    where change_kind in ('updated','unchanged')
    order by post_id,ordinal
  ) matched
  where post.id=matched.post_id;

  insert into public.job_market_source_records(
    source_id,external_job_id,post_id,external_detail_url,external_apply_url,
    payload_hash,normalized_snapshot,status,first_seen_at,last_seen_at,last_seen_run_id
  )
  select
    p_source_id,external_job_id,post_id,detail_url,apply_url,content_hash,
    jsonb_build_object(
      'title',title,
      'locations',coalesce((select jsonb_agg(location->>'name') from jsonb_array_elements(locations) location),'[]'::jsonb)
    ),
    case when source_status='closed' then 'closed' else 'observed' end::public.job_market_record_status,
    p_observed_at,p_observed_at,p_run_id
  from pg_temp.job_market_batch_matches
  on conflict(source_id,external_job_id) do update set
    post_id=excluded.post_id,
    external_detail_url=excluded.external_detail_url,
    external_apply_url=excluded.external_apply_url,
    payload_hash=excluded.payload_hash,
    normalized_snapshot=excluded.normalized_snapshot,
    status=excluded.status,
    last_seen_at=excluded.last_seen_at,
    last_seen_run_id=excluded.last_seen_run_id;

  insert into public.job_market_locations(normalized_key,display_name,is_remote)
  select distinct
    location->>'normalizedKey',location->>'name',coalesce((location->>'isRemote')::boolean,false)
  from pg_temp.job_market_batch_matches matched
  cross join lateral jsonb_array_elements(matched.locations) location
  where matched.change_kind<>'unchanged'
    and nullif(location->>'normalizedKey','') is not null
  on conflict(normalized_key) do update set display_name=excluded.display_name;

  delete from public.job_market_post_locations relation
  using pg_temp.job_market_batch_matches matched
  where matched.change_kind<>'unchanged' and relation.post_id=matched.post_id;

  insert into public.job_market_post_locations(post_id,location_id)
  select distinct matched.post_id,location_row.id
  from pg_temp.job_market_batch_matches matched
  cross join lateral jsonb_array_elements(matched.locations) location
  join public.job_market_locations location_row
    on location_row.normalized_key=location->>'normalizedKey'
  where matched.change_kind<>'unchanged'
  on conflict do nothing;

  insert into public.job_market_events(
    post_id,campaign_id,source_id,sync_run_id,event_type,reason_code,change_summary
  )
  select distinct on (post_id)
    post_id,campaign_id,p_source_id,p_run_id,
    case
      when change_kind='created' then 'created'
      when prior_status is not null and prior_status<>'open' and source_status<>'closed' then 'reopened'
      else 'updated'
    end::public.job_market_event_type,
    case
      when change_kind='created' then 'first_observation'
      when prior_status is not null and prior_status<>'open' and source_status<>'closed' then 'source_reappeared'
      else 'content_changed'
    end,
    jsonb_build_object('title',title)
  from pg_temp.job_market_batch_matches
  where change_kind<>'unchanged'
  order by post_id,ordinal;

  stale := 0;
  closed := 0;
  if p_completeness='complete' then
    with missing as (
      update public.job_market_posts post set
        status=case
          when post.status='open' then 'stale'::public.job_market_post_status
          when post.status='stale' and post.last_missing_success_at <= p_observed_at - interval '6 hours'
            then 'closed'::public.job_market_post_status
          else post.status
        end,
        missing_since=coalesce(post.missing_since,p_observed_at),
        last_missing_success_at=coalesce(post.last_missing_success_at,p_observed_at),
        updated_at=now()
      from public.job_market_source_records record
      where record.post_id=post.id and record.source_id=p_source_id
        and not exists(
          select 1 from pg_temp.job_market_batch_input observed
          where observed.external_job_id=record.external_job_id
        )
        and post.status<>'closed'
        and (
          post.status='open'
          or (post.status='stale' and post.last_missing_success_at <= p_observed_at - interval '6 hours')
        )
      returning post.id,post.campaign_id,post.status::text next_status
    ), event_rows as (
      insert into public.job_market_events(
        post_id,campaign_id,source_id,sync_run_id,event_type,reason_code
      )
      select id,campaign_id,p_source_id,p_run_id,next_status::public.job_market_event_type,
        'successful_snapshot_absence'
      from missing
      returning event_type::text
    )
    select
      count(*) filter(where event_type='stale')::integer,
      count(*) filter(where event_type='closed')::integer
    into stale,closed
    from event_rows;

    update public.job_market_source_records record set
      status=case when post.status='closed' then 'closed'::public.job_market_record_status else 'missing'::public.job_market_record_status end
    from public.job_market_posts post
    where post.id=record.post_id and record.source_id=p_source_id
      and not exists(
        select 1 from pg_temp.job_market_batch_input observed
        where observed.external_job_id=record.external_job_id
      );
  end if;

  update public.job_market_campaigns campaign set
    status=case
      when exists(select 1 from public.job_market_posts post where post.campaign_id=campaign.id and post.status='open')
        then 'open'::public.job_market_post_status
      when exists(select 1 from public.job_market_posts post where post.campaign_id=campaign.id and post.status='stale')
        then 'stale'::public.job_market_post_status
      else 'closed'::public.job_market_post_status
    end,
    last_confirmed_at=p_observed_at,
    updated_at=now()
  where campaign.company_id=v_company_id;

  discovered := (select count(*)::integer from pg_temp.job_market_batch_input);
  created := (select count(*)::integer from pg_temp.job_market_batch_matches where change_kind='created');
  updated := (select count(*)::integer from pg_temp.job_market_batch_matches where change_kind='updated');
  rejected := greatest(coalesce(p_rejected_count,0),0);
  return next;
end;
$$;

comment on function public.apply_job_market_batch(uuid,uuid,jsonb,text,integer,timestamptz) is
  'Atomically applies a normalized job source snapshot with set-based campaign, post, provenance, location, event, and lifecycle updates.';
