alter table public.job_market_sources
  add column if not exists lease_run_id uuid references public.job_market_sync_runs(id) on delete restrict;

update public.job_market_sync_runs
set status='failed',
  finished_at=greatest(now(),started_at),
  error_code='lease_reset',
  error_summary='The source lease was reset while synchronization fencing was enabled.'
where status='running';

update public.job_market_sources
set lease_until=null,leased_by=null,lease_run_id=null
where lease_until is not null or leased_by is not null or lease_run_id is not null;

alter table public.job_market_sources
  drop constraint if exists job_market_sources_lease_run_check;
alter table public.job_market_sources
  add constraint job_market_sources_lease_run_check check (
    (lease_until is null)=(lease_run_id is null)
  );

create or replace function public.complete_job_market_sync_success(
  p_source_id uuid,
  p_run_id uuid,
  p_worker_id text,
  p_jobs jsonb,
  p_completeness text,
  p_rejected_count integer,
  p_observed_at timestamptz,
  p_interval_minutes integer,
  p_status text,
  p_etag text,
  p_last_modified text
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
  v_result record;
  v_updated integer;
begin
  if p_status not in ('succeeded','partial') then
    raise exception using errcode='22023',message='invalid_sync_status';
  end if;

  perform 1
  from public.job_market_sources source
  where source.id=p_source_id
    and source.status='active'
    and source.leased_by=p_worker_id
    and source.lease_run_id=p_run_id
  for update;
  if not found then
    raise exception using errcode='55000',message='sync_lease_lost';
  end if;

  perform 1
  from public.job_market_sync_runs run
  where run.id=p_run_id
    and run.source_id=p_source_id
    and run.worker_id=p_worker_id
    and run.status='running'
  for update;
  if not found then
    raise exception using errcode='55000',message='sync_lease_lost';
  end if;

  select * into strict v_result
  from public.apply_job_market_batch(
    p_source_id,p_run_id,p_jobs,p_completeness,p_rejected_count,p_observed_at
  );

  update public.job_market_sync_runs set
    status=p_status::public.job_market_sync_status,
    finished_at=greatest(started_at,p_observed_at),
    discovered_count=v_result.discovered,
    created_count=v_result.created,
    updated_count=v_result.updated,
    stale_count=v_result.stale,
    closed_count=v_result.closed,
    rejected_count=v_result.rejected,
    error_code=null,
    error_summary=null
  where id=p_run_id and status='running';
  get diagnostics v_updated=row_count;
  if v_updated<>1 then
    raise exception using errcode='55000',message='sync_lease_lost';
  end if;

  update public.job_market_sources set
    last_success_at=p_observed_at,
    consecutive_failures=0,
    next_sync_at=p_observed_at+(p_interval_minutes * interval '1 minute'),
    lease_until=null,
    leased_by=null,
    lease_run_id=null,
    etag=coalesce(p_etag,etag),
    last_modified=coalesce(p_last_modified,last_modified),
    updated_at=p_observed_at
  where id=p_source_id and lease_run_id=p_run_id and leased_by=p_worker_id;
  get diagnostics v_updated=row_count;
  if v_updated<>1 then
    raise exception using errcode='55000',message='sync_lease_lost';
  end if;

  discovered:=v_result.discovered;
  created:=v_result.created;
  updated:=v_result.updated;
  stale:=v_result.stale;
  closed:=v_result.closed;
  rejected:=v_result.rejected;
  return next;
end;
$$;

comment on function public.complete_job_market_sync_success(uuid,uuid,text,jsonb,text,integer,timestamptz,integer,text,text,text) is
  'Fenced transaction that applies a source snapshot and completes its run and lease together.';
