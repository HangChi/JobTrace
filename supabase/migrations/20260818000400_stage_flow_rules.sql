-- A recruitment stage is a milestone, not a repeatable event for one application.
-- Keep the earliest record when older data contains accidental duplicates.
with ranked as (
  select id,
    row_number() over (
      partition by application_id, stage
      order by occurred_on, created_at, id
    ) as position
  from public.application_stage_occurrences
)
delete from public.application_stage_occurrences occurrences
using ranked
where occurrences.id = ranked.id
  and ranked.position > 1;

create unique index if not exists application_stage_occurrences_unique_stage
  on public.application_stage_occurrences (application_id, stage);

create or replace function public.add_stage_occurrence_for_owner(
  actor_id text, target_id uuid, stage_code recruitment_stage, occurrence_date date
) returns application_stage_occurrences language plpgsql security definer set search_path=public as $$
declare
  result application_stage_occurrences;
  app public.applications;
begin
  select * into app from applications
    where id=target_id and owner_id=actor_id for update;
  if not found then
    raise exception using errcode='P0002',message='application_not_found';
  end if;
  if app.status in ('offer', 'refused') then
    raise exception using errcode='22023',message='terminal_application';
  end if;
  if occurrence_date < app.applied_date or occurrence_date > current_date then
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
    if interview_date < app.applied_date or interview_date > current_date then
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
