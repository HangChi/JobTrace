create index applications_owner_applied_date_idx
  on public.applications (owner_id, applied_date desc, id);
