-- Give multi-source default employers a stable company identity independent
-- from each source's catalog identity. The previous bootstrap already merged
-- these curated pairs, so each update targets exactly one existing company.
update public.job_market_companies company
set identity_key='default:huawei-cn',updated_at=now()
where company.id=(
  select source.company_id
  from public.job_market_sources source
  where source.catalog_key in ('default:huawei-social-cn','default:huawei-campus-cn')
  order by source.created_at,source.id
  limit 1
)
and not exists(
  select 1 from public.job_market_companies existing
  where existing.identity_key='default:huawei-cn'
);

update public.job_market_companies company
set identity_key='default:mihoyo-cn',updated_at=now()
where company.id=(
  select source.company_id
  from public.job_market_sources source
  where source.catalog_key in ('default:mihoyo-social-cn','default:mihoyo-campus-cn')
  order by source.created_at,source.id
  limit 1
)
and not exists(
  select 1 from public.job_market_companies existing
  where existing.identity_key='default:mihoyo-cn'
);

-- Owner isolation is mandatory and applications.owner_id is NOT NULL. This
-- legacy unowned entry point cannot succeed and duplicated the complete rule
-- maintained by create_application_for_owner.
drop function if exists public.create_application(
  jsonb,
  public.application_event_type
);
