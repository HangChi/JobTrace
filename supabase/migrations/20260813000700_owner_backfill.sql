alter table public.applications add column owner_id text references public.users(id) on delete restrict;
alter table public.import_batches add column owner_id text references public.users(id) on delete restrict;
create index applications_owner_filter_idx on public.applications(owner_id,status,latest_date desc,id);
create index import_batches_owner_expiry_idx on public.import_batches(owner_id,expires_at);

-- Existing rows are intentionally left nullable. Before enabling multi-user access,
-- assign each legacy row to an explicitly chosen registered user, then add NOT NULL.
