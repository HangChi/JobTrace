begin;select plan(1);select is((public.analytics_summary(current_date)->>'total')::bigint,0::bigint,'empty summary');select * from finish();rollback;
