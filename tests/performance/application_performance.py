from __future__ import annotations

import os
import statistics
import time

import psycopg


def percentile(values: list[float], percent: float = 0.95) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * percent))]


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")
    connection = psycopg.connect(url)
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                insert into applications(company_name, position_name, city, applied_date, status, latest_date)
                select 'Perf Company ' || (n % 500), 'Role ' || (n % 100),
                  (array['上海','北京','深圳','杭州'])[(n % 4)+1],
                  date '2026-01-01' + (n % 200),
                  case when n % 9 = 0 then 'refused'::application_status else 'submitted'::application_status end,
                  date '2026-01-01' + (n % 200)
                from generate_series(1,10000) n
                """
            )
            benchmarks = {
                "list": "select id from applications order by latest_date desc,id limit 50",
                "filter": "select id from applications where status='submitted' and city='上海' and lower(company_name || ' ' || position_name) like '%company 12%' order by latest_date desc,id limit 50",
                "analytics": "select analytics_summary(current_date)",
            }
            for name, query in benchmarks.items():
                timings: list[float] = []
                for _ in range(25):
                    started = time.perf_counter()
                    cursor.execute(query); cursor.fetchall()
                    timings.append((time.perf_counter() - started) * 1000)
                p95 = percentile(timings)
                print(f"{name}: p95={p95:.2f}ms median={statistics.median(timings):.2f}ms")
                if p95 > 1000: raise SystemExit(f"{name} exceeds 1000ms")
    finally:
        connection.rollback(); connection.close()


if __name__ == "__main__": main()
