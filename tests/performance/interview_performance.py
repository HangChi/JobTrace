from __future__ import annotations

import os
import statistics
import sys
import time
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from env import load_local_env


def percentile(values: list[float], percent: float = 0.95) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * percent))]


def measure(
    cursor: psycopg.Cursor,
    name: str,
    query: str,
    parameters: tuple[object, ...],
    threshold_ms: float = 1000,
) -> None:
    timings: list[float] = []
    for _ in range(25):
        started = time.perf_counter()
        cursor.execute(query, parameters)
        cursor.fetchall()
        timings.append((time.perf_counter() - started) * 1000)
    p95 = percentile(timings)
    print(f"interview {name}: p95={p95:.2f}ms median={statistics.median(timings):.2f}ms")
    if p95 > threshold_ms:
        raise SystemExit(f"interview {name} exceeds {threshold_ms:.0f}ms")


def main() -> None:
    load_local_env()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")
    connection = psycopg.connect(url)
    owner_id = "interview-performance-owner"
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                insert into users(id,display_name,email,email_verified,role,username,display_username)
                values (%s,'Interview Performance','interview-performance@example.test',true,'user','interview_performance','interview_performance')
                on conflict(id) do nothing
                """,
                (owner_id,),
            )
            cursor.execute(
                """
                insert into applications(
                  id,owner_id,company_name,position_name,applied_date,status,latest_date
                )
                select gen_random_uuid(),%s,'Interview Company ' || (n %% 500),
                  'Role ' || (n %% 100),date '2026-01-01' + (n %% 180),
                  'submitted',date '2026-01-01' + (n %% 180)
                from generate_series(1,10000) n
                """,
                (owner_id,),
            )
            cursor.execute(
                """
                insert into application_stage_occurrences(application_id,stage,occurred_on)
                select id,
                  (array['interview_1','interview_2','interview_3','hr_interview','final_interview']::recruitment_stage[])
                    [(row_number() over(order by id) %% 5)+1],
                  applied_date
                from applications where owner_id=%s
                """,
                (owner_id,),
            )
            cursor.execute(
                """
                insert into interview_reviews(
                  owner_id,application_id,stage_occurrence_id,stage_snapshot,
                  interviewed_on,status,round_result
                )
                select %s,a.id,s.id,s.stage,s.occurred_on,
                  case when row_number() over(order by a.id) %% 3=0
                    then 'completed'::review_status else 'pending_review'::review_status end,
                  case when row_number() over(order by a.id) %% 4=0
                    then 'passed'::round_result else 'pending'::round_result end
                from applications a
                join application_stage_occurrences s on s.application_id=a.id
                where a.owner_id=%s
                """,
                (owner_id, owner_id),
            )
            cursor.execute(
                """
                insert into interview_questions(
                  interview_review_id,sort_order,category,question,improved_answer
                )
                select id,0,'technical','Performance Question ' || row_number() over(order by id),
                  'Improved answer'
                from interview_reviews where owner_id=%s
                """,
                (owner_id,),
            )
            cursor.execute(
                """
                insert into interview_action_items(
                  interview_review_id,sort_order,content,completed
                )
                select id,0,'Performance action',false
                from interview_reviews where owner_id=%s
                """,
                (owner_id,),
            )
            cursor.execute(
                """
                update interview_reviews
                set visibility='public',author_mode='anonymous',published_at=now(),
                    like_count=mod(abs(hashtext(id::text)),80),
                    comment_count=mod(abs(hashtext(id::text)),30),
                    view_count=mod(abs(hashtext(id::text)),500)
                where owner_id=%s and status='completed'
                  and mod(abs(hashtext(id::text)),2)=0
                """,
                (owner_id,),
            )
            measure(
                cursor,
                "list",
                """select id from interview_reviews
                   where owner_id=%s order by interviewed_on desc,id desc limit 50""",
                (owner_id,),
            )
            measure(
                cursor,
                "filter",
                """select id from interview_reviews
                   where owner_id=%s and status='completed' and stage_snapshot='interview_1'
                   order by interviewed_on desc,id desc limit 50""",
                (owner_id,),
            )
            measure(
                cursor,
                "search",
                """select r.id from interview_reviews r
                   where r.owner_id=%s and exists(
                     select 1 from interview_questions q
                     where q.interview_review_id=r.id
                       and lower(q.question) like '%%question 42%%'
                   ) order by r.interviewed_on desc,r.id desc limit 50""",
                (owner_id,),
            )
            measure(
                cursor,
                "public list",
                """select r.id,a.company_name,a.position_name,r.published_at,
                         r.highlights,r.gaps,
                         coalesce((
                           select jsonb_agg(jsonb_build_object(
                             'category',q.category,'question',q.question,
                             'originalAnswer',q.original_answer,
                             'followUpNotes',q.follow_up_notes,
                             'improvedAnswer',q.improved_answer
                           ) order by q.sort_order)
                           from interview_questions q
                           where q.interview_review_id=r.id
                         ),'[]'::jsonb) questions
                   from interview_reviews r
                   join applications a on a.id=r.application_id
                   where r.visibility='public' and r.status='completed'
                     and r.published_at is not null
                   order by r.published_at desc,r.id desc limit 21""",
                (),
                threshold_ms=500,
            )
            measure(
                cursor,
                "public hot list",
                """select r.id,a.company_name,a.position_name,a.city,
                         r.hot_score,r.like_count,r.comment_count,r.view_count
                   from interview_reviews r join applications a on a.id=r.application_id
                   where r.visibility='public' and r.status='completed'
                     and r.published_at is not null
                   order by r.hot_score desc,r.published_at desc,r.id desc limit 21""",
                (),
                threshold_ms=500,
            )
            cursor.execute(
                """select id from interview_reviews
                   where visibility='public' and status='completed' limit 1"""
            )
            public_review_id = cursor.fetchone()[0]
            interaction_timings: list[float] = []
            for _ in range(25):
                started = time.perf_counter()
                cursor.execute(
                    "select * from toggle_public_interview_like(%s,%s)",
                    (owner_id, public_review_id),
                )
                cursor.fetchall()
                interaction_timings.append((time.perf_counter() - started) * 1000)
            interaction_p95 = percentile(interaction_timings)
            print(
                f"interview interaction: p95={interaction_p95:.2f}ms "
                f"median={statistics.median(interaction_timings):.2f}ms"
            )
            if interaction_p95 > 1000:
                raise SystemExit("interview interaction exceeds 1000ms")
            measure(
                cursor,
                "public detail",
                """select r.id,r.highlights,r.gaps,a.company_name,a.position_name,
                         q.category,q.question,q.original_answer,q.follow_up_notes,
                         q.improved_answer
                   from interview_reviews r
                   join applications a on a.id=r.application_id
                   join interview_questions q on q.interview_review_id=r.id
                   where r.id=%s and r.visibility='public' and r.status='completed'
                     and r.published_at is not null
                   order by q.sort_order""",
                (public_review_id,),
                threshold_ms=500,
            )

            cursor.execute(
                """select id,version from interview_reviews
                   where owner_id=%s and status='completed' and visibility='private'
                   limit 1""",
                (owner_id,),
            )
            publish_review_id, publish_version = cursor.fetchone()
            publish_timings: list[float] = []
            publish_payload = (
                '{"status":"completed","visibility":"public",'
                '"authorMode":"anonymous",'
                '"questions":[{"category":"technical",'
                '"question":"Performance publish"}],'
                '"actionItems":[{"content":"Performance action",'
                '"completed":false}]}'
            )
            for _ in range(25):
                started = time.perf_counter()
                cursor.execute(
                    "select update_interview_review_for_owner(%s,%s,%s,%s::jsonb)",
                    (owner_id, publish_review_id, publish_version, publish_payload),
                )
                cursor.fetchone()
                publish_timings.append((time.perf_counter() - started) * 1000)
                publish_version += 1
                cursor.execute(
                    """update interview_reviews
                       set visibility='private',author_mode='anonymous',published_at=null
                       where id=%s""",
                    (publish_review_id,),
                )
            publish_p95 = percentile(publish_timings)
            print(
                f"interview publish: p95={publish_p95:.2f}ms "
                f"median={statistics.median(publish_timings):.2f}ms"
            )
            if publish_p95 > 1000:
                raise SystemExit("interview publish exceeds 1000ms")

            cursor.execute(
                "select id,version from interview_reviews where owner_id=%s limit 1",
                (owner_id,),
            )
            review_id, version = cursor.fetchone()
            update_timings: list[float] = []
            for _ in range(25):
                payload = (
                    '{"status":"pending_review","roundResult":"pending",'
                    '"questions":[{"category":"technical","question":"Performance update"}],'
                    '"actionItems":[{"content":"Performance action","completed":false}]}'
                )
                started = time.perf_counter()
                cursor.execute(
                    "select update_interview_review_for_owner(%s,%s,%s,%s::jsonb)",
                    (owner_id, review_id, version, payload),
                )
                cursor.fetchone()
                update_timings.append((time.perf_counter() - started) * 1000)
                version += 1
            update_p95 = percentile(update_timings)
            print(
                f"interview update: p95={update_p95:.2f}ms "
                f"median={statistics.median(update_timings):.2f}ms"
            )
            if update_p95 > 1000:
                raise SystemExit("interview update exceeds 1000ms")
    finally:
        connection.rollback()
        connection.close()


if __name__ == "__main__":
    main()
