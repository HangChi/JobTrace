alter type public.application_event_type add value if not exists 'stage_changed';

-- Interview reviews identify a concrete occurrence. The same round may happen
-- again on another date, so keep only the original date-aware table constraint.
drop index if exists public.application_stage_occurrences_unique_stage;

create or replace function public.update_stage_occurrence_for_owner(
  actor_id text,
  target_application_id uuid,
  occurrence_id uuid,
  stage_code public.recruitment_stage,
  occurrence_date date,
  change_date date
) returns public.application_stage_occurrences
language plpgsql security definer set search_path=public as $$
declare
  old_row public.application_stage_occurrences;
  result public.application_stage_occurrences;
  app public.applications;
  business_date date := (now() at time zone 'Asia/Shanghai')::date;
begin
  select s.* into old_row
  from application_stage_occurrences s
  join applications a on a.id=s.application_id
  where s.id=occurrence_id
    and s.application_id=target_application_id
    and a.owner_id=actor_id
  for update of s;
  if not found then
    raise exception using errcode='P0002',message='stage_not_found';
  end if;

  select * into app
  from applications
  where id=target_application_id and owner_id=actor_id;
  if occurrence_date < app.applied_date or occurrence_date > business_date then
    raise exception using errcode='22023',message='invalid_stage_date';
  end if;

  update application_stage_occurrences
  set stage=stage_code,occurred_on=occurrence_date
  where id=occurrence_id
  returning * into result;

  update applications
  set latest_date=greatest(latest_date,change_date),
      version=version+1,
      updated_at=now()
  where id=target_application_id and owner_id=actor_id;

  insert into application_events(application_id,type,occurred_on,before,after)
  values(target_application_id,'stage_changed',change_date,to_jsonb(old_row),to_jsonb(result));
  return result;
end $$;

revoke execute on function public.update_stage_occurrence_for_owner(
  text,uuid,uuid,recruitment_stage,date,date
) from public;
