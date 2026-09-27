drop function if exists public.update_stage_occurrence_for_owner(
  text,uuid,uuid,recruitment_stage,date,date
);

create function public.update_stage_occurrence_for_owner(
  actor_id text,
  target_application_id uuid,
  occurrence_id uuid,
  expected_version integer,
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
  select * into app
  from public.applications
  where id=target_application_id and owner_id=actor_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='stage_not_found';
  end if;
  if app.version <> expected_version then
    raise exception using errcode='40001',message='application_version_conflict';
  end if;

  select * into old_row
  from public.application_stage_occurrences
  where id=occurrence_id and application_id=app.id
  for update;
  if not found then
    raise exception using errcode='P0002',message='stage_not_found';
  end if;

  if occurrence_date < app.applied_date or occurrence_date > business_date then
    raise exception using errcode='22023',message='invalid_stage_date';
  end if;

  update public.application_stage_occurrences
  set stage=stage_code,occurred_on=occurrence_date
  where id=occurrence_id
  returning * into result;

  update public.applications
  set latest_date=greatest(latest_date,change_date),
      version=version+1,
      updated_at=now()
  where id=app.id;

  insert into public.application_events(
    application_id,type,occurred_on,before,after
  ) values(
    app.id,'stage_changed',change_date,to_jsonb(old_row),to_jsonb(result)
  );
  return result;
end $$;

revoke execute on function public.update_stage_occurrence_for_owner(
  text,uuid,uuid,integer,recruitment_stage,date,date
) from public;

comment on function public.update_stage_occurrence_for_owner(
  text,uuid,uuid,integer,recruitment_stage,date,date
) is
  'Updates a stage occurrence after locking the parent application and validating its expected version.';
