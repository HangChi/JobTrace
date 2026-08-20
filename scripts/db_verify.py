from __future__ import annotations

import os
import psycopg
from env import load_local_env


def main() -> None:
    load_local_env()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")
    checks: list[tuple[str, bool]] = []
    connection = psycopg.connect(url)
    try:
        with connection.cursor() as cursor:
            cursor.execute("insert into users(id,display_name,email) values ('db-verify','Database Verify','db-verify@example.test')")
            cursor.execute("select (public.create_application_for_owner('db-verify',%s::jsonb)).id", ('{"companyName":"数据库验证","positionName":"工程师","appliedDate":"2026-08-01"}',))
            app_id = cursor.fetchone()[0]
            cursor.execute("select count(*) from application_events where application_id=%s and type='created'", (app_id,))
            checks.append(("atomic event", cursor.fetchone()[0] == 1))
            cursor.execute("select public.add_stage_occurrence_for_owner('db-verify',%s,'screening','2026-08-05')", (app_id,))
            cursor.execute("select version,latest_date from applications where id=%s", (app_id,))
            version, latest = cursor.fetchone(); checks.append(("stage aggregate", version == 2 and str(latest) == "2026-08-05"))
            cursor.execute(
                "select (public.create_interview_review_for_owner('db-verify',%s,null,'interview_1','2026-08-06','{}'::jsonb)).id",
                (app_id,),
            )
            review_id = cursor.fetchone()[0]
            cursor.execute(
                """
                select public.update_interview_review_for_owner(
                  'db-verify',%s,1,
                  '{"status":"completed","roundResult":"passed","questions":[{"category":"technical","question":"数据库验证","improvedAnswer":"补充答案"}],"actionItems":[{"content":"补充案例","completed":false}]}'::jsonb
                )
                """,
                (review_id,),
            )
            cursor.execute(
                "select version,status::text from interview_reviews where id=%s",
                (review_id,),
            )
            review_version, review_status = cursor.fetchone()
            checks.append(
                (
                    "interview aggregate",
                    review_version == 2 and review_status == "completed",
                )
            )
            cursor.execute(
                "select stage_occurrence_id from interview_reviews where id=%s",
                (review_id,),
            )
            occurrence_id = cursor.fetchone()[0]
            cursor.execute(
                "select public.update_stage_occurrence_for_owner('db-verify',%s,%s,'interview_2','2026-08-07','2026-08-07')",
                (app_id, occurrence_id),
            )
            cursor.execute(
                "select count(*) from application_events where application_id=%s and type='stage_changed'",
                (app_id,),
            )
            checks.append(("stage changed event", cursor.fetchone()[0] == 1))
            cursor.execute("select count(*) from information_schema.columns where table_schema='public' and table_name in ('applications','import_batches') and column_name='owner_id' and is_nullable='NO'")
            checks.append(("owner constraints", cursor.fetchone()[0] == 2))
            cursor.execute("select public.analytics_summary(current_date)"); checks.append(("analytics", cursor.fetchone()[0] is not None))
    finally:
        connection.rollback(); connection.close()
    for name, passed in checks: print("PASS" if passed else "FAIL", name)
    if not all(passed for _, passed in checks): raise SystemExit(1)


if __name__ == "__main__": main()
