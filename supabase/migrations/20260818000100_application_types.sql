-- Classify applications without changing existing user data. PostgreSQL fills
-- every existing row with the non-null default when the column is introduced.
create type public.application_type as enum (
  'summer_internship',
  'daily_internship',
  'campus_recruitment',
  'social_recruitment'
);

alter table public.applications
  add column type public.application_type not null default 'campus_recruitment';

create index applications_type_filter_idx
  on public.applications (owner_id, type, latest_date desc, id);

create or replace function public.create_application(
  payload jsonb,
  event_type public.application_event_type default 'created'
)
returns public.applications language plpgsql security definer set search_path = public as $$
declare result public.applications;
begin
  insert into applications(company_name, position_name, city, job_url, applied_date, type, status, notes, latest_date)
  values (
    trim(payload->>'companyName'),
    trim(payload->>'positionName'),
    nullif(trim(payload->>'city'),''),
    nullif(trim(payload->>'jobUrl'),''),
    (payload->>'appliedDate')::date,
    coalesce((payload->>'type')::application_type,'campus_recruitment'),
    coalesce((payload->>'status')::application_status,'submitted'),
    nullif(payload->>'notes',''),
    (payload->>'appliedDate')::date
  )
  returning * into result;

  insert into application_stage_occurrences(application_id, stage, occurred_on)
  values(result.id, 'screening', result.applied_date);
  insert into application_events(application_id,type,occurred_on,after)
  values(result.id,event_type,result.applied_date,to_jsonb(result));
  return result;
end $$;

create or replace function public.create_application_for_owner(
  actor_id text,
  payload jsonb,
  event_type public.application_event_type default 'created'
)
returns public.applications language plpgsql security definer set search_path = public as $$
declare result public.applications;
begin
  if actor_id is null or not exists(select 1 from users where id=actor_id and disabled=false) then
    raise exception using errcode='42501',message='valid_actor_required';
  end if;

  insert into applications(owner_id, company_name, position_name, city, job_url, applied_date, type, status, notes, latest_date)
  values(
    actor_id,
    trim(payload->>'companyName'),
    trim(payload->>'positionName'),
    nullif(trim(payload->>'city'),''),
    nullif(trim(payload->>'jobUrl'),''),
    (payload->>'appliedDate')::date,
    coalesce((payload->>'type')::application_type,'campus_recruitment'),
    coalesce((payload->>'status')::application_status,'submitted'),
    nullif(payload->>'notes',''),
    (payload->>'appliedDate')::date
  )
  returning * into result;

  insert into application_stage_occurrences(application_id, stage, occurred_on)
  values(result.id, 'screening', result.applied_date);
  insert into application_events(application_id,type,occurred_on,after)
  values(result.id,event_type,result.applied_date,to_jsonb(result));
  return result;
end $$;

create or replace function public.update_application(
  target_id uuid, expected_version integer, change_date date, payload jsonb
)
returns public.applications language plpgsql security definer set search_path = public as $$
declare old_row public.applications; result public.applications; event_kind application_event_type := 'details_changed';
begin
  select * into old_row from applications where id=target_id for update;
  if not found then raise exception using errcode='P0002', message='application_not_found'; end if;
  if old_row.version <> expected_version then raise exception using errcode='40001', message='application_version_conflict'; end if;
  if payload ? 'status' and (payload->>'status')::application_status <> old_row.status then event_kind := 'status_changed'; end if;
  update applications set
    company_name=coalesce(nullif(trim(payload->>'companyName'),''),company_name),
    position_name=coalesce(nullif(trim(payload->>'positionName'),''),position_name),
    city=case when payload ? 'city' then nullif(trim(payload->>'city'),'') else city end,
    job_url=case when payload ? 'jobUrl' then nullif(trim(payload->>'jobUrl'),'') else job_url end,
    applied_date=coalesce((payload->>'appliedDate')::date,applied_date),
    type=coalesce((payload->>'type')::application_type,type),
    status=coalesce((payload->>'status')::application_status,status),
    notes=case when payload ? 'notes' then nullif(payload->>'notes','') else notes end,
    latest_date=greatest(latest_date,change_date), version=version+1, updated_at=now()
  where id=target_id returning * into result;
  insert into application_events(application_id,type,occurred_on,before,after)
  values(target_id,event_kind,change_date,to_jsonb(old_row),to_jsonb(result));
  return result;
end $$;

create or replace function public.update_application_for_owner(
  actor_id text, target_id uuid, expected_version integer, change_date date, payload jsonb
)
returns public.applications language plpgsql security definer set search_path = public as $$
declare old_row public.applications; result public.applications; event_kind application_event_type := 'details_changed';
begin
  select * into old_row from applications where id=target_id and owner_id=actor_id for update;
  if not found then raise exception using errcode='P0002', message='application_not_found'; end if;
  if old_row.version <> expected_version then raise exception using errcode='40001', message='application_version_conflict'; end if;
  if payload ? 'status' and (payload->>'status')::application_status <> old_row.status then event_kind := 'status_changed'; end if;
  update applications set
    company_name=coalesce(nullif(trim(payload->>'companyName'),''),company_name),
    position_name=coalesce(nullif(trim(payload->>'positionName'),''),position_name),
    city=case when payload ? 'city' then nullif(trim(payload->>'city'),'') else city end,
    job_url=case when payload ? 'jobUrl' then nullif(trim(payload->>'jobUrl'),'') else job_url end,
    applied_date=coalesce((payload->>'appliedDate')::date,applied_date),
    type=coalesce((payload->>'type')::application_type,type),
    status=coalesce((payload->>'status')::application_status,status),
    notes=case when payload ? 'notes' then nullif(payload->>'notes','') else notes end,
    latest_date=greatest(latest_date,change_date), version=version+1, updated_at=now()
  where id=target_id and owner_id=actor_id returning * into result;
  insert into application_events(application_id,type,occurred_on,before,after)
  values(target_id,event_kind,change_date,to_jsonb(old_row),to_jsonb(result));
  return result;
end $$;
