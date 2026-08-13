create or replace function public.analytics_summary(today date)
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object('total',count(*),'active',count(*) filter(where status='active'),'rejected',count(*) filter(where status='rejected'),'offers',count(*) filter(where status='offer'),'addedThisWeek',count(*) filter(where applied_date>=date_trunc('week',today)::date),'stageDistribution',coalesce((select jsonb_object_agg(stage,total) from(select stage,count(distinct application_id) total from application_stage_occurrences group by stage)s),'{}'::jsonb)) from applications;
$$;
