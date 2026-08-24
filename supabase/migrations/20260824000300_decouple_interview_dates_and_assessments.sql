alter table public.interview_reviews
  drop constraint if exists interview_reviews_stage_snapshot_check;

alter table public.interview_reviews
  add constraint interview_reviews_stage_snapshot_check
  check (stage_snapshot in (
    'assessment','interview_1','interview_2','interview_3','hr_interview','final_interview'
  ));

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
  occurrence_date date;
  resolved_interview_date date;
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
    if not found then
      raise exception using errcode='P0002',message='stage_not_found';
    end if;
    resolved_interview_date := coalesce(interview_date, occurrence.occurred_on);
  else
    if stage_code is null or interview_date is null then
      raise exception using errcode='22023',message='stage_or_occurrence_required';
    end if;
    occurrence_date := coalesce(
      nullif(payload->>'stageOccurredOn','')::date,
      interview_date
    );
    if occurrence_date < app.applied_date or occurrence_date > business_date then
      raise exception using errcode='22023',message='invalid_stage_date';
    end if;
    insert into application_stage_occurrences(application_id,stage,occurred_on)
      values(app.id,stage_code,occurrence_date) returning * into occurrence;
    update applications
      set latest_date=greatest(latest_date,occurrence_date),version=version+1,updated_at=now()
      where id=app.id and owner_id=actor_id;
    insert into application_events(application_id,type,occurred_on,after)
      values(app.id,'stage_added',occurrence_date,to_jsonb(occurrence));
    resolved_interview_date := interview_date;
  end if;

  if occurrence.stage not in (
    'assessment','interview_1','interview_2','interview_3','hr_interview','final_interview'
  ) then
    raise exception using errcode='22023',message='stage_not_interview';
  end if;
  if resolved_interview_date < app.applied_date or resolved_interview_date > business_date then
    raise exception using errcode='22023',message='invalid_interview_date';
  end if;

  insert into interview_reviews(
    owner_id,application_id,stage_occurrence_id,stage_snapshot,interviewed_on,
    format,duration_minutes,interviewer_notes,round_result
  ) values(
    actor_id,app.id,occurrence.id,occurrence.stage,resolved_interview_date,
    nullif(payload->>'format','')::interview_format,
    nullif(payload->>'durationMinutes','')::integer,
    nullif(trim(payload->>'interviewerNotes'),''),
    coalesce(nullif(payload->>'roundResult','')::round_result,'pending')
  ) returning * into result;
  return result;
end $$;

create or replace function public.update_interview_review_for_owner(
  actor_id text,target_id uuid,expected_version integer,payload jsonb
) returns public.interview_reviews
language plpgsql security definer set search_path=public as $$
declare
  old_row public.interview_reviews;
  result public.interview_reviews;
  requested_status public.review_status;
  requested_interview_date date;
  application_applied_date date;
  has_content boolean;
  business_date date := (now() at time zone 'Asia/Shanghai')::date;
begin
  select * into old_row from interview_reviews
    where id=target_id and owner_id=actor_id for update;
  if not found then
    raise exception using errcode='P0002',message='interview_not_found';
  end if;
  if old_row.version <> expected_version then
    raise exception using errcode='40001',message='interview_version_conflict';
  end if;

  select applied_date into application_applied_date
    from applications where id=old_row.application_id and owner_id=actor_id;
  requested_interview_date := coalesce(
    nullif(payload->>'interviewedOn','')::date,
    old_row.interviewed_on
  );
  if requested_interview_date < application_applied_date
    or requested_interview_date > business_date then
    raise exception using errcode='22023',message='invalid_interview_date';
  end if;

  requested_status := coalesce(
    nullif(payload->>'status','')::review_status,
    old_row.status
  );
  has_content := exists(
    select 1
    from jsonb_array_elements(coalesce(payload->'questions','[]'::jsonb)) question
    where nullif(trim(question->>'question'),'') is not null
  );
  if requested_status='completed' and not has_content then
    raise exception using errcode='23514',message='review_content_required';
  end if;

  update interview_reviews set
    interviewed_on=requested_interview_date,
    format=case when payload ? 'format' then nullif(payload->>'format','')::interview_format else format end,
    duration_minutes=case when payload ? 'durationMinutes' then nullif(payload->>'durationMinutes','')::integer else duration_minutes end,
    interviewer_notes=case when payload ? 'interviewerNotes' then nullif(trim(payload->>'interviewerNotes'),'') else interviewer_notes end,
    round_result=coalesce(nullif(payload->>'roundResult','')::round_result,round_result),
    highlights=case when payload ? 'highlights' then nullif(trim(payload->>'highlights'),'') else highlights end,
    gaps=case when payload ? 'gaps' then nullif(trim(payload->>'gaps'),'') else gaps end,
    status=requested_status,version=version+1,updated_at=now()
    where id=target_id returning * into result;

  delete from interview_questions where interview_review_id=target_id;
  insert into interview_questions(id,interview_review_id,sort_order,category,question,original_answer,follow_up_notes,improved_answer,self_rating)
  select coalesce(nullif(item->>'id','')::uuid,gen_random_uuid()),target_id,ordinality-1,
    coalesce(nullif(item->>'category','')::question_category,'other'),trim(item->>'question'),
    nullif(trim(item->>'originalAnswer'),''),nullif(trim(item->>'followUpNotes'),''),
    nullif(trim(item->>'improvedAnswer'),''),nullif(item->>'selfRating','')::integer
  from jsonb_array_elements(coalesce(payload->'questions','[]'::jsonb))
    with ordinality as value(item,ordinality);

  delete from interview_action_items where interview_review_id=target_id;
  insert into interview_action_items(id,interview_review_id,sort_order,content,completed)
  select coalesce(nullif(item->>'id','')::uuid,gen_random_uuid()),target_id,ordinality-1,
    trim(item->>'content'),coalesce((item->>'completed')::boolean,false)
  from jsonb_array_elements(coalesce(payload->'actionItems','[]'::jsonb))
    with ordinality as value(item,ordinality);
  return result;
end $$;

revoke execute on function public.create_interview_review_for_owner(text,uuid,uuid,recruitment_stage,date,jsonb) from public;
revoke execute on function public.update_interview_review_for_owner(text,uuid,integer,jsonb) from public;
