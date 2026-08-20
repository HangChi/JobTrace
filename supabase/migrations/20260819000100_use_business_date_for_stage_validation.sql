-- Keep all product date validation in the Asia/Shanghai business timezone.
-- PostgreSQL sessions may run in UTC, where current_date can lag the UI date
-- shortly after midnight in China.

create or replace function public.update_stage_occurrence_for_owner(
  actor_id text,
  occurrence_id uuid,
  stage_code public.recruitment_stage,
  occurrence_date date,
  change_date date
) returns public.application_stage_occurrences
language plpgsql security definer set search_path=public as $$
declare old_row public.application_stage_occurrences; result public.application_stage_occurrences; app public.applications; business_date date := (now() at time zone 'Asia/Shanghai')::date;
begin
  select s.* into old_row from application_stage_occurrences s join applications a on a.id=s.application_id
    where s.id=occurrence_id and a.owner_id=actor_id for update of s;
  if not found then raise exception using errcode='P0002',message='stage_not_found'; end if;
  select * into app from applications where id=old_row.application_id and owner_id=actor_id;
  if occurrence_date < app.applied_date or occurrence_date > business_date then
    raise exception using errcode='22023',message='invalid_stage_date';
  end if;
  update application_stage_occurrences set stage=stage_code,occurred_on=occurrence_date
    where id=occurrence_id returning * into result;
  update applications set latest_date=greatest(latest_date,change_date),version=version+1,updated_at=now()
    where id=old_row.application_id and owner_id=actor_id;
  insert into application_events(application_id,type,occurred_on,before,after)
    values(old_row.application_id,'details_changed',change_date,to_jsonb(old_row),to_jsonb(result));
  return result;
end $$;

revoke execute on function public.update_stage_occurrence_for_owner(text,uuid,recruitment_stage,date,date) from public;

create or replace function public.add_stage_occurrence_for_owner(
  actor_id text, target_id uuid, stage_code recruitment_stage, occurrence_date date
) returns application_stage_occurrences language plpgsql security definer set search_path=public as $$
declare
  result application_stage_occurrences;
  app public.applications;
  business_date date := (now() at time zone 'Asia/Shanghai')::date;
begin
  select * into app from applications
    where id=target_id and owner_id=actor_id for update;
  if not found then
    raise exception using errcode='P0002',message='application_not_found';
  end if;
  if app.status in ('offer', 'refused') then
    raise exception using errcode='22023',message='terminal_application';
  end if;
  if occurrence_date < app.applied_date or occurrence_date > business_date then
    raise exception using errcode='22023',message='invalid_stage_date';
  end if;
  insert into application_stage_occurrences(application_id,stage,occurred_on)
    values(target_id,stage_code,occurrence_date) returning * into result;
  update applications set latest_date=greatest(latest_date,occurrence_date),version=version+1,updated_at=now()
    where id=target_id and owner_id=actor_id;
  insert into application_events(application_id,type,occurred_on,after)
    values(target_id,'stage_added',occurrence_date,to_jsonb(result));
  return result;
end $$;

create or replace function public.create_interview_review_for_owner(
  actor_id text,
  target_application_id uuid,
  target_stage_occurrence_id uuid default null,
  stage_code public.recruitment_stage default null,
  interview_date date default null,
  payload jsonb default '{}'::jsonb
) returns public.interview_reviews
language plpgsql security definer set search_path=public as $$
declare
  app public.applications;
  occurrence public.application_stage_occurrences;
  result public.interview_reviews;
  business_date date := (now() at time zone 'Asia/Shanghai')::date;
begin
  select * into app from applications
    where id=target_application_id and owner_id=actor_id for update;
  if not found then
    raise exception using errcode='P0002',message='application_not_found';
  end if;
  if app.status in ('offer', 'refused') then
    raise exception using errcode='22023',message='terminal_application';
  end if;

  if target_stage_occurrence_id is not null then
    select s.* into occurrence from application_stage_occurrences s
      where s.id=target_stage_occurrence_id and s.application_id=app.id;
    if not found then raise exception using errcode='P0002',message='stage_not_found'; end if;
  else
    if stage_code is null or interview_date is null then
      raise exception using errcode='22023',message='stage_or_occurrence_required';
    end if;
    if interview_date < app.applied_date or interview_date > business_date then
      raise exception using errcode='22023',message='invalid_interview_date';
    end if;
    insert into application_stage_occurrences(application_id,stage,occurred_on)
      values(app.id,stage_code,interview_date) returning * into occurrence;
    update applications set latest_date=greatest(latest_date,interview_date),version=version+1,updated_at=now()
      where id=app.id and owner_id=actor_id;
    insert into application_events(application_id,type,occurred_on,after)
      values(app.id,'stage_added',interview_date,to_jsonb(occurrence));
  end if;

  if occurrence.stage not in ('interview_1','interview_2','interview_3','hr_interview','final_interview') then
    raise exception using errcode='22023',message='stage_not_interview';
  end if;
  insert into interview_reviews(
    owner_id,application_id,stage_occurrence_id,stage_snapshot,interviewed_on,
    format,duration_minutes,interviewer_notes,round_result
  ) values(
    actor_id,app.id,occurrence.id,occurrence.stage,occurrence.occurred_on,
    nullif(payload->>'format','')::interview_format,
    nullif(payload->>'durationMinutes','')::integer,
    nullif(trim(payload->>'interviewerNotes'),''),
    coalesce(nullif(payload->>'roundResult','')::round_result,'pending')
  ) returning * into result;
  return result;
end $$;
