create or replace function public.update_interview_review_for_owner(
  actor_id text,target_id uuid,expected_version integer,payload jsonb
) returns public.interview_reviews
language plpgsql security definer set search_path=public as $$
declare
  old_row public.interview_reviews;
  result public.interview_reviews;
  requested_status public.review_status;
  has_content boolean;
begin
  select * into old_row from interview_reviews where id=target_id and owner_id=actor_id for update;
  if not found then raise exception using errcode='P0002',message='interview_not_found'; end if;
  if old_row.version <> expected_version then raise exception using errcode='40001',message='interview_version_conflict'; end if;

  requested_status := coalesce(nullif(payload->>'status','')::review_status,old_row.status);
  has_content := exists(
    select 1
    from jsonb_array_elements(coalesce(payload->'questions','[]'::jsonb)) question
    where nullif(trim(question->>'question'),'') is not null
  );
  if requested_status='completed' and not has_content then
    raise exception using errcode='23514',message='review_content_required';
  end if;

  update interview_reviews set
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
  from jsonb_array_elements(coalesce(payload->'questions','[]'::jsonb)) with ordinality as value(item,ordinality);

  delete from interview_action_items where interview_review_id=target_id;
  insert into interview_action_items(id,interview_review_id,sort_order,content,completed)
  select coalesce(nullif(item->>'id','')::uuid,gen_random_uuid()),target_id,ordinality-1,
    trim(item->>'content'),coalesce((item->>'completed')::boolean,false)
  from jsonb_array_elements(coalesce(payload->'actionItems','[]'::jsonb)) with ordinality as value(item,ordinality);
  return result;
end $$;

revoke execute on function public.update_interview_review_for_owner(text,uuid,integer,jsonb) from public;
