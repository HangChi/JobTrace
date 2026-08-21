from __future__ import annotations

import os
import statistics
import time

import psycopg
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from env import load_local_env


def percentile(values: list[float], percent: float = 0.95) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * percent))]


def main() -> None:
    load_local_env()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")
    connection = psycopg.connect(url)
    try:
        with connection.cursor() as cursor:
            owner_id = "performance-owner"
            cursor.execute("insert into users(id,display_name,email) values (%s,'Performance','performance@example.test') on conflict(id) do nothing", (owner_id,))
            cursor.execute(
                """
                insert into applications(owner_id,company_name, position_name, city, applied_date, status, latest_date)
                select %s, 'Perf Company ' || (n %% 500), 'Role ' || (n %% 100),
                  (array['上海','北京','深圳','杭州'])[(n %% 4)+1],
                  date '2026-01-01' + (n %% 200),
                  case when n %% 9 = 0 then 'refused'::application_status else 'submitted'::application_status end,
                  date '2026-01-01' + (n %% 200)
                from generate_series(1,10000) n
                """,
                (owner_id,),
            )
            cursor.execute(
                """
                insert into application_stage_occurrences(application_id,stage,occurred_on)
                select id,'screening',applied_date
                from applications where owner_id=%s
                """,
                (owner_id,),
            )
            benchmarks = {
                "list": "select id from applications where owner_id=%s order by latest_date desc,id limit 50",
                "filter": "select id from applications where owner_id=%s and status='submitted' and city='上海' and lower(company_name || ' ' || position_name) like '%%company 12%%' order by latest_date desc,id limit 50",
                "analytics": "select count(*)::int,count(*) filter(where status='submitted')::int from applications where owner_id=%s",
                "analytics_report": """
                    with cohort as (
                      select a.id,a.applied_date,a.status,
                        exists(select 1 from application_stage_occurrences s
                          where s.application_id=a.id and s.stage in (
                            'interview_1','interview_2','interview_3',
                            'hr_interview','final_interview'
                          )) interviewed,
                        (select min(s.occurred_on)
                          from application_stage_occurrences s
                          where s.application_id=a.id and s.stage in (
                            'interview_1','interview_2','interview_3',
                            'hr_interview','final_interview'
                          )) first_interview_on
                      from applications a
                      where a.owner_id=%s
                        and a.applied_date between date '2026-03-01' and date '2026-05-31'
                    )
                    select count(*)::int,
                      count(*) filter(where interviewed)::int,
                      count(*) filter(where status='offer')::int,
                      percentile_cont(0.5) within group(
                        order by first_interview_on-applied_date
                      ) filter(where first_interview_on is not null)
                    from cohort
                """,
                "analytics_report_trend": """
                    select date_trunc('week',a.applied_date)::date,
                      count(*)::int,
                      count(*) filter(where exists(
                        select 1 from application_stage_occurrences s
                        where s.application_id=a.id and s.stage in (
                          'interview_1','interview_2','interview_3',
                          'hr_interview','final_interview'
                        )
                      ))::int
                    from applications a
                    where a.owner_id=%s
                      and a.applied_date between date '2026-03-01' and date '2026-05-31'
                    group by 1 order by 1
                """,
            }
            for name, query in benchmarks.items():
                timings: list[float] = []
                for _ in range(25):
                    started = time.perf_counter()
                    cursor.execute(query, (owner_id,)); cursor.fetchall()
                    timings.append((time.perf_counter() - started) * 1000)
                p95 = percentile(timings)
                print(f"{name}: p95={p95:.2f}ms median={statistics.median(timings):.2f}ms")
                if p95 > 1000: raise SystemExit(f"{name} exceeds 1000ms")
    finally:
        connection.rollback(); connection.close()


if __name__ == "__main__": main()
