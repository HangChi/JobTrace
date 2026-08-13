alter table public.import_batches
  add column if not exists file_name varchar(255) not null default 'import',
  add column if not exists format text not null default 'csv'
    check (format in ('csv', 'xlsx')),
  add column if not exists valid_rows integer not null default 0
    check (valid_rows >= 0 and valid_rows <= total_rows),
  add column if not exists invalid_rows integer not null default 0
    check (invalid_rows >= 0 and invalid_rows <= total_rows),
  add column if not exists duplicate_rows integer not null default 0
    check (duplicate_rows >= 0 and duplicate_rows <= valid_rows),
  add column if not exists completed_at timestamptz;

alter table public.import_rows
  add column if not exists decision text check (decision in ('import', 'skip'));

create index if not exists import_duplicate_candidates_idx
  on public.applications (lower(company_name), lower(position_name), applied_date);
