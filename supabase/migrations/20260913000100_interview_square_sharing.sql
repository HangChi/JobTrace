create type public.interview_visibility as enum ('private','public');
create type public.interview_author_mode as enum ('anonymous','attributed');

alter table public.interview_reviews
  add column visibility public.interview_visibility not null default 'private',
  add column author_mode public.interview_author_mode not null default 'anonymous',
  add column published_at timestamptz,
  add constraint interview_reviews_publication_state_check check (
    (visibility='private' and author_mode='anonymous' and published_at is null)
    or
    (visibility='public' and status='completed' and published_at is not null)
  );

create index interview_reviews_public_published_idx
  on public.interview_reviews(published_at desc,id desc)
  where visibility='public' and status='completed';

create or replace function public.update_interview_review_for_owner(
  actor_id text,target_id uuid,expected_version integer,payload jsonb
) returns public.interview_reviews
language plpgsql security definer set search_path=public as $$
declare
  old_row public.interview_reviews;
  result public.interview_reviews;
  requested_status public.review_status;
  requested_interview_date date;
  requested_visibility public.interview_visibility;
  requested_author_mode public.interview_author_mode;
  requested_published_at timestamptz;
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

  requested_visibility := coalesce(
    nullif(payload->>'visibility','')::interview_visibility,
    old_row.visibility
  );
  if requested_status <> 'completed' then
    if old_row.status <> 'completed' and payload->>'visibility'='public' then
      raise exception using errcode='23514',message='review_publish_incomplete';
    end if;
    requested_visibility := 'private';
  end if;
  if requested_visibility='public' then
    requested_author_mode := coalesce(
      nullif(payload->>'authorMode','')::interview_author_mode,
      case when old_row.visibility='public' then old_row.author_mode else 'anonymous'::interview_author_mode end
    );
    requested_published_at := case
      when old_row.visibility='public' then old_row.published_at
      else now()
    end;
  else
    requested_author_mode := 'anonymous';
    requested_published_at := null;
  end if;

  update interview_reviews set
    interviewed_on=requested_interview_date,
    format=case when payload ? 'format' then nullif(payload->>'format','')::interview_format else format end,
    duration_minutes=case when payload ? 'durationMinutes' then nullif(payload->>'durationMinutes','')::integer else duration_minutes end,
    interviewer_notes=case when payload ? 'interviewerNotes' then nullif(trim(payload->>'interviewerNotes'),'') else interviewer_notes end,
    round_result=coalesce(nullif(payload->>'roundResult','')::round_result,round_result),
    highlights=case when payload ? 'highlights' then nullif(trim(payload->>'highlights'),'') else highlights end,
    gaps=case when payload ? 'gaps' then nullif(trim(payload->>'gaps'),'') else gaps end,
    status=requested_status,
    visibility=requested_visibility,
    author_mode=requested_author_mode,
    published_at=requested_published_at,
    version=version+1,
    updated_at=now()
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

revoke execute on function public.update_interview_review_for_owner(text,uuid,integer,jsonb) from public;
