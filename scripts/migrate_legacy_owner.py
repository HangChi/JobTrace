from __future__ import annotations

import os

import psycopg
from env import load_local_env


def backfill(connection: psycopg.Connection, owner_id: str) -> tuple[int, int]:
    if not owner_id.strip():
        raise ValueError("MIGRATION_OWNER_ID is required")
    with connection.cursor() as cursor:
        cursor.execute(
            "select exists(select 1 from public.users where id=%s and disabled=false)",
            (owner_id,),
        )
        if not cursor.fetchone()[0]:
            raise ValueError("MIGRATION_OWNER_ID must identify an enabled user")
        cursor.execute(
            """
            select
              (select count(*) from public.applications where owner_id is null),
              (select count(*) from public.import_batches where owner_id is null)
            """
        )
        applications, batches = cursor.fetchone()
        cursor.execute("update public.applications set owner_id=%s where owner_id is null", (owner_id,))
        cursor.execute("update public.import_batches set owner_id=%s where owner_id is null", (owner_id,))
    return applications, batches


def main() -> None:
    load_local_env()
    url = os.environ.get("DATABASE_URL")
    owner_id = os.environ.get("MIGRATION_OWNER_ID", "").strip()
    if not url:
        raise SystemExit("DATABASE_URL is required")
    try:
        with psycopg.connect(url) as connection:
            applications, batches = backfill(connection, owner_id)
            connection.commit()
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print(f"PASS owner backfill: applications={applications}, import_batches={batches}, owner={owner_id}")


if __name__ == "__main__":
    main()
