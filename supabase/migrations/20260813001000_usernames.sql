alter table public.users add column username text unique;
alter table public.users add column display_username text;
create index users_username_idx on public.users(username);
