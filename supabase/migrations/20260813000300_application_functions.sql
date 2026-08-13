create or replace function public.create_application(payload jsonb, event_type public.application_event_type default 'created')
returns public.applications language plpgsql security definer set search_path = public as $$
declare result public.applications;
begin
  insert into applications(company_name, position_name, city, job_url, applied_date, status, notes, latest_date)
  values (trim(payload->>'companyName'), trim(payload->>'positionName'), nullif(trim(payload->>'city'),''), nullif(trim(payload->>'jobUrl'),''),
    (payload->>'appliedDate')::date, coalesce((payload->>'status')::application_status,'active'), nullif(payload->>'notes',''), (payload->>'appliedDate')::date)
  returning * into result;
  insert into application_events(application_id,type,occurred_on,after) values(result.id,event_type,result.applied_date,to_jsonb(result));
  return result;
end $$;

create or replace function public.update_application(target_id uuid, expected_version integer, change_date date, payload jsonb)
returns public.applications language plpgsql security definer set search_path = public as $$
declare old_row public.applications; result public.applications; event_kind application_event_type := 'details_changed';
begin
  select * into old_row from applications where id=target_id for update;
  if not found then raise exception using errcode='P0002', message='application_not_found'; end if;
  if old_row.version <> expected_version then raise exception using errcode='40001', message='application_version_conflict'; end if;
  if payload ? 'status' and (payload->>'status')::application_status <> old_row.status then event_kind := 'status_changed'; end if;
  update applications set company_name=coalesce(nullif(trim(payload->>'companyName'),''),company_name), position_name=coalesce(nullif(trim(payload->>'positionName'),''),position_name),
    city=case when payload ? 'city' then nullif(trim(payload->>'city'),'') else city end, job_url=case when payload ? 'jobUrl' then nullif(trim(payload->>'jobUrl'),'') else job_url end,
    applied_date=coalesce((payload->>'appliedDate')::date,applied_date), status=coalesce((payload->>'status')::application_status,status),
    notes=case when payload ? 'notes' then nullif(payload->>'notes','') else notes end, latest_date=greatest(latest_date,change_date), version=version+1, updated_at=now()
  where id=target_id returning * into result;
  insert into application_events(application_id,type,occurred_on,before,after) values(target_id,event_kind,change_date,to_jsonb(old_row),to_jsonb(result));
  return result;
end $$;

create or replace function public.add_stage_occurrence(target_id uuid, stage_code recruitment_stage, occurrence_date date)
returns application_stage_occurrences language plpgsql security definer set search_path=public as $$
declare result application_stage_occurrences;
begin
  insert into application_stage_occurrences(application_id,stage,occurred_on) values(target_id,stage_code,occurrence_date) returning * into result;
  update applications set latest_date=greatest(latest_date,occurrence_date),version=version+1,updated_at=now() where id=target_id;
  insert into application_events(application_id,type,occurred_on,after) values(target_id,'stage_added',occurrence_date,to_jsonb(result));
  return result;
end $$;

create or replace function public.remove_stage_occurrence(occurrence_id uuid, change_date date)
returns void language plpgsql security definer set search_path=public as $$
declare old_row application_stage_occurrences;
begin
  delete from application_stage_occurrences where id=occurrence_id returning * into old_row;
  if not found then raise exception using errcode='P0002',message='stage_not_found'; end if;
  update applications set latest_date=greatest(latest_date,change_date),version=version+1,updated_at=now() where id=old_row.application_id;
  insert into application_events(application_id,type,occurred_on,before,after) values(old_row.application_id,'stage_removed',change_date,to_jsonb(old_row),'{}');
end $$;
