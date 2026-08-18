create type public.interview_format as enum ('online','offline','phone');
create type public.round_result as enum ('pending','passed','failed');
create type public.review_status as enum ('draft','pending_review','completed');
create type public.question_category as enum ('technical','project','behavioral','system_design','other');

create table public.interview_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  stage_occurrence_id uuid references public.application_stage_occurrences(id) on delete set null,
  stage_snapshot public.recruitment_stage not null,
  interviewed_on date not null,
  format public.interview_format,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 600),
  interviewer_notes text check (interviewer_notes is null or char_length(interviewer_notes) <= 2000),
  round_result public.round_result not null default 'pending',
  highlights text check (highlights is null or char_length(highlights) <= 10000),
  gaps text check (gaps is null or char_length(gaps) <= 10000),
  status public.review_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stage_snapshot in ('interview_1','interview_2','interview_3','hr_interview','final_interview')),
  unique(stage_occurrence_id)
);

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  interview_review_id uuid not null references public.interview_reviews(id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  category public.question_category not null default 'other',
  question text not null check (char_length(trim(question)) between 1 and 4000),
  original_answer text check (original_answer is null or char_length(original_answer) <= 10000),
  follow_up_notes text check (follow_up_notes is null or char_length(follow_up_notes) <= 10000),
  improved_answer text check (improved_answer is null or char_length(improved_answer) <= 10000),
  self_rating integer check (self_rating is null or self_rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(interview_review_id, sort_order)
);

create table public.interview_action_items (
  id uuid primary key default gen_random_uuid(),
  interview_review_id uuid not null references public.interview_reviews(id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  content text not null check (char_length(trim(content)) between 1 and 1000),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(interview_review_id, sort_order)
);

create index interview_reviews_owner_date_idx on public.interview_reviews(owner_id, interviewed_on desc, id desc);
create index interview_reviews_owner_status_idx on public.interview_reviews(owner_id, status, interviewed_on desc, id desc);
create index interview_reviews_owner_stage_idx on public.interview_reviews(owner_id, stage_snapshot, interviewed_on desc, id desc);
create index interview_reviews_application_idx on public.interview_reviews(application_id, interviewed_on desc, id desc);
create index interview_questions_review_idx on public.interview_questions(interview_review_id, sort_order);
create index interview_questions_search_idx on public.interview_questions using gin (lower(question) extensions.gin_trgm_ops);
create index interview_action_items_review_idx on public.interview_action_items(interview_review_id, sort_order);

alter table public.interview_reviews enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interview_action_items enable row level security;

do $$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.interview_reviews, public.interview_questions, public.interview_action_items from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.interview_reviews, public.interview_questions, public.interview_action_items from authenticated;
  end if;
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
  select * into app from applications where id=target_application_id and owner_id=actor_id for update;
  if not found then raise exception using errcode='P0002',message='application_not_found'; end if;

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

create or replace function public.update_interview_review_for_owner(
  actor_id text,target_id uuid,expected_version integer,payload jsonb
) returns public.interview_reviews
language plpgsql security definer set search_path=public as $$
declare
  old_row public.interview_reviews;
  result public.interview_reviews;
  requested_status public.review_status;
  has_improvement boolean;
begin
  select * into old_row from interview_reviews where id=target_id and owner_id=actor_id for update;
  if not found then raise exception using errcode='P0002',message='interview_not_found'; end if;
  if old_row.version <> expected_version then raise exception using errcode='40001',message='interview_version_conflict'; end if;

  requested_status := coalesce(nullif(payload->>'status','')::review_status,old_row.status);
  has_improvement := nullif(trim(payload->>'gaps'),'') is not null
    or jsonb_array_length(coalesce(payload->'actionItems','[]'::jsonb)) > 0
    or exists(select 1 from jsonb_array_elements(coalesce(payload->'questions','[]'::jsonb)) q
      where nullif(trim(q->>'improvedAnswer'),'') is not null);
  if requested_status='completed' and (
    jsonb_array_length(coalesce(payload->'questions','[]'::jsonb))=0 or not has_improvement
  ) then raise exception using errcode='23514',message='review_incomplete'; end if;

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

revoke execute on function public.create_interview_review_for_owner(text,uuid,uuid,recruitment_stage,date,jsonb) from public;
revoke execute on function public.update_interview_review_for_owner(text,uuid,integer,jsonb) from public;
