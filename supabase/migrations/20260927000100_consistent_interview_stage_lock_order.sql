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
  -- Review creation locks the parent application before it references the stage.
  -- Use the same parent-to-child order for stage mutations to avoid deadlocks.
  select * into app
  from public.applications
  where id=target_application_id and owner_id=actor_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='stage_not_found';
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

create or replace function public.remove_stage_occurrence_for_owner(
  actor_id text,
  target_id uuid,
  occurrence_id uuid,
  change_date date
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  app public.applications;
  old_row public.application_stage_occurrences;
begin
  select * into app
  from public.applications
  where id=target_id and owner_id=actor_id
  for update;
  if not found then
    raise exception using errcode='P0002',message='stage_not_found';
  end if;

  delete from public.application_stage_occurrences
  where id=occurrence_id and application_id=app.id
  returning * into old_row;
  if not found then
    raise exception using errcode='P0002',message='stage_not_found';
  end if;

  update public.applications
  set latest_date=greatest(latest_date,change_date),
      version=version+1,
      updated_at=now()
  where id=app.id;

  insert into public.application_events(
    application_id,type,occurred_on,before,after
  ) values(
    app.id,'stage_removed',change_date,to_jsonb(old_row),'{}'::jsonb
  );
end $$;

revoke execute on function public.update_stage_occurrence_for_owner(
  text,uuid,uuid,recruitment_stage,date,date
) from public;
revoke execute on function public.remove_stage_occurrence_for_owner(
  text,uuid,uuid,date
) from public;

comment on function public.update_stage_occurrence_for_owner(
  text,uuid,uuid,recruitment_stage,date,date
) is
  'Updates a stage occurrence using the canonical parent-application then child-stage lock order.';
comment on function public.remove_stage_occurrence_for_owner(
  text,uuid,uuid,date
) is
  'Removes a stage occurrence using the canonical parent-application then child-stage lock order.';
