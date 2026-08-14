do $$
begin
  if exists (select 1 from public.applications where owner_id is null)
     or exists (select 1 from public.import_batches where owner_id is null) then
    raise exception using
      errcode = '23502',
      message = 'legacy_owner_backfill_required',
      hint = 'Run pnpm db:owner:migrate with MIGRATION_OWNER_ID before applying this migration.';
  end if;
end
$$;

alter table public.applications alter column owner_id set not null;
alter table public.import_batches alter column owner_id set not null;

create or replace function public.update_application_for_owner(
  actor_id text, target_id uuid, expected_version integer, change_date date, payload jsonb
) returns public.applications language plpgsql security definer set search_path = public as $$
declare old_row public.applications; result public.applications; event_kind application_event_type := 'details_changed';
begin
  select * into old_row from applications where id=target_id and owner_id=actor_id for update;
  if not found then raise exception using errcode='P0002', message='application_not_found'; end if;
  if old_row.version <> expected_version then raise exception using errcode='40001', message='application_version_conflict'; end if;
  if payload ? 'status' and (payload->>'status')::application_status <> old_row.status then event_kind := 'status_changed'; end if;
  update applications set company_name=coalesce(nullif(trim(payload->>'companyName'),''),company_name), position_name=coalesce(nullif(trim(payload->>'positionName'),''),position_name),
    city=case when payload ? 'city' then nullif(trim(payload->>'city'),'') else city end, job_url=case when payload ? 'jobUrl' then nullif(trim(payload->>'jobUrl'),'') else job_url end,
    applied_date=coalesce((payload->>'appliedDate')::date,applied_date), status=coalesce((payload->>'status')::application_status,status),
    notes=case when payload ? 'notes' then nullif(payload->>'notes','') else notes end, latest_date=greatest(latest_date,change_date), version=version+1, updated_at=now()
  where id=target_id and owner_id=actor_id returning * into result;
  insert into application_events(application_id,type,occurred_on,before,after) values(target_id,event_kind,change_date,to_jsonb(old_row),to_jsonb(result));
  return result;
end $$;

create or replace function public.add_stage_occurrence_for_owner(
  actor_id text, target_id uuid, stage_code recruitment_stage, occurrence_date date
) returns application_stage_occurrences language plpgsql security definer set search_path=public as $$
declare result application_stage_occurrences;
begin
  if not exists(select 1 from applications where id=target_id and owner_id=actor_id) then
    raise exception using errcode='P0002',message='application_not_found';
  end if;
  insert into application_stage_occurrences(application_id,stage,occurred_on) values(target_id,stage_code,occurrence_date) returning * into result;
  update applications set latest_date=greatest(latest_date,occurrence_date),version=version+1,updated_at=now() where id=target_id and owner_id=actor_id;
  insert into application_events(application_id,type,occurred_on,after) values(target_id,'stage_added',occurrence_date,to_jsonb(result));
  return result;
end $$;

create or replace function public.remove_stage_occurrence_for_owner(
  actor_id text, occurrence_id uuid, change_date date
) returns void language plpgsql security definer set search_path=public as $$
declare old_row application_stage_occurrences;
begin
  delete from application_stage_occurrences s
    using applications a
    where s.id=occurrence_id and a.id=s.application_id and a.owner_id=actor_id
    returning s.* into old_row;
  if not found then raise exception using errcode='P0002',message='stage_not_found'; end if;
  update applications set latest_date=greatest(latest_date,change_date),version=version+1,updated_at=now()
    where id=old_row.application_id and owner_id=actor_id;
  insert into application_events(application_id,type,occurred_on,before,after) values(old_row.application_id,'stage_removed',change_date,to_jsonb(old_row),'{}');
end $$;

revoke execute on function public.create_application(jsonb, public.application_event_type) from public;
revoke execute on function public.update_application(uuid, integer, date, jsonb) from public;
revoke execute on function public.add_stage_occurrence(uuid, recruitment_stage, date) from public;
revoke execute on function public.remove_stage_occurrence(uuid, date) from public;
