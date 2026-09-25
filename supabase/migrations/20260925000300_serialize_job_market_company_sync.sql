alter function public.apply_job_market_batch(uuid,uuid,jsonb,text,integer,timestamptz)
  rename to apply_job_market_batch_without_company_lock;

create function public.apply_job_market_batch(
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
  select source.company_id into strict v_company_id
  from public.job_market_sources source
  where source.id=p_source_id;

  -- URL matching is intentionally conservative and happens before insertion. Keep
  -- all batches for one verified company in a single transaction order so two
  -- sources cannot both decide that the same canonical URL is new.
  perform pg_advisory_xact_lock(
    hashtextextended('job-market-company:' || v_company_id::text,0)
  );

  return query
  select result.discovered,result.created,result.updated,result.stale,
    result.closed,result.rejected
  from public.apply_job_market_batch_without_company_lock(
    p_source_id,p_run_id,p_jobs,p_completeness,p_rejected_count,p_observed_at
  ) result;
end;
$$;

revoke execute on function public.apply_job_market_batch_without_company_lock(
  uuid,uuid,jsonb,text,integer,timestamptz
) from public;

comment on function public.apply_job_market_batch(uuid,uuid,jsonb,text,integer,timestamptz) is
  'Serializes normalized source snapshots per company before atomically applying campaign, post, provenance, location, event, and lifecycle updates.';

alter function public.refresh_job_market_company_read_model(uuid)
  rename to refresh_job_market_company_read_model_without_company_lock;

create function public.refresh_job_market_company_read_model(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- The projection is rebuilt with DELETE + INSERT. Take the same company lock
  -- as batch application before either statement obtains its snapshot.
  perform pg_advisory_xact_lock(
    hashtextextended('job-market-company:' || p_company_id::text,0)
  );
  perform public.refresh_job_market_company_read_model_without_company_lock(
    p_company_id
  );
end;
$$;

revoke execute on function public.refresh_job_market_company_read_model_without_company_lock(uuid)
  from public;
revoke execute on function public.refresh_job_market_company_read_model(uuid)
  from public;

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

revoke execute on function public.rebuild_job_market_company_read_models() from public;
revoke execute on function public.refresh_job_market_read_model_after_sync() from public;
