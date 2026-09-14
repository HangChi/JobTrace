alter table public.interview_review_likes enable row level security;
alter table public.interview_review_comments enable row level security;
alter table public.interview_review_views enable row level security;

do $$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.interview_review_likes,
      public.interview_review_comments,
      public.interview_review_views from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.interview_review_likes,
      public.interview_review_comments,
      public.interview_review_views from authenticated;
  end if;
end $$;
