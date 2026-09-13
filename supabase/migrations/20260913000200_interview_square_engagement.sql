alter table public.interview_reviews
  add column like_count integer not null default 0 check (like_count >= 0),
  add column comment_count integer not null default 0 check (comment_count >= 0),
  add column view_count integer not null default 0 check (view_count >= 0),
  add column hot_score bigint generated always as (
    like_count::bigint * 3 + comment_count::bigint * 2 + view_count::bigint
  ) stored;

create table public.interview_review_likes (
  interview_review_id uuid not null references public.interview_reviews(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (interview_review_id, user_id)
);

create table public.interview_review_comments (
  id uuid primary key default gen_random_uuid(),
  interview_review_id uuid not null references public.interview_reviews(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.interview_review_views (
  interview_review_id uuid not null references public.interview_reviews(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (interview_review_id, user_id)
);

create index interview_review_comments_review_created_idx
  on public.interview_review_comments(interview_review_id, created_at desc, id desc);

create index interview_reviews_public_hot_idx
  on public.interview_reviews(hot_score desc, published_at desc, id desc)
  where visibility='public' and status='completed' and published_at is not null;

create or replace function public.sync_interview_engagement_count()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  target_id uuid := coalesce(new.interview_review_id, old.interview_review_id);
  counter_column text := tg_argv[0];
  delta integer := case when tg_op='INSERT' then 1 else -1 end;
begin
  execute format(
    'update public.interview_reviews set %I=greatest(%I + $1,0) where id=$2',
    counter_column,
    counter_column
  ) using delta,target_id;
  return coalesce(new,old);
end $$;

create trigger interview_review_likes_count_trigger
after insert or delete on public.interview_review_likes
for each row execute function public.sync_interview_engagement_count('like_count');

create trigger interview_review_comments_count_trigger
after insert or delete on public.interview_review_comments
for each row execute function public.sync_interview_engagement_count('comment_count');

create trigger interview_review_views_count_trigger
after insert or delete on public.interview_review_views
for each row execute function public.sync_interview_engagement_count('view_count');

create or replace function public.assert_public_interview(target_id uuid)
returns public.interview_reviews
language plpgsql security definer set search_path=public as $$
declare result public.interview_reviews;
begin
  select * into result from public.interview_reviews
  where id=target_id and visibility='public' and status='completed'
    and published_at is not null for update;
  if not found then
    raise exception using errcode='P0002',message='public_interview_not_found';
  end if;
  return result;
end $$;

create or replace function public.toggle_public_interview_like(actor_id text,target_id uuid)
returns table(liked boolean,like_count integer,comment_count integer,view_count integer)
language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_public_interview(target_id);
  if exists(select 1 from interview_review_likes where interview_review_id=target_id and user_id=actor_id) then
    delete from interview_review_likes where interview_review_id=target_id and user_id=actor_id;
    liked := false;
  else
    insert into interview_review_likes(interview_review_id,user_id) values(target_id,actor_id);
    liked := true;
  end if;
  return query select liked,r.like_count,r.comment_count,r.view_count
    from interview_reviews r where r.id=target_id;
end $$;

create or replace function public.add_public_interview_comment(actor_id text,target_id uuid,comment_content text)
returns public.interview_review_comments
language plpgsql security definer set search_path=public as $$
declare result public.interview_review_comments;
begin
  perform public.assert_public_interview(target_id);
  if char_length(trim(comment_content)) not between 1 and 1000 then
    raise exception using errcode='22023',message='invalid_interview_comment';
  end if;
  insert into interview_review_comments(interview_review_id,user_id,content)
  values(target_id,actor_id,trim(comment_content)) returning * into result;
  return result;
end $$;

create or replace function public.record_public_interview_view(actor_id text,target_id uuid)
returns table(like_count integer,comment_count integer,view_count integer)
language plpgsql security definer set search_path=public as $$
begin
  perform public.assert_public_interview(target_id);
  insert into interview_review_views(interview_review_id,user_id)
  values(target_id,actor_id) on conflict do nothing;
  return query select r.like_count,r.comment_count,r.view_count
    from interview_reviews r where r.id=target_id;
end $$;

revoke execute on function public.assert_public_interview(uuid) from public;
revoke execute on function public.toggle_public_interview_like(text,uuid) from public;
revoke execute on function public.add_public_interview_comment(text,uuid,text) from public;
revoke execute on function public.record_public_interview_view(text,uuid) from public;
