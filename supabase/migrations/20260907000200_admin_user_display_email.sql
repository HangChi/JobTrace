drop index if exists public.users_admin_search_idx;

create index users_admin_search_idx on public.users using gin (
  (lower(coalesce(username, '') || ' ' || email || ' ' || coalesce(recovery_email, '')))
  extensions.gin_trgm_ops
);
