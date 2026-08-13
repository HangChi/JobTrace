from __future__ import annotations

import hashlib
import os
from pathlib import Path

import psycopg


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")

    migrations = sorted(Path("supabase/migrations").glob("*.sql"))
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("create schema if not exists jobtrace_meta")
            cursor.execute(
                """
                create table if not exists jobtrace_meta.schema_migrations(
                  version text primary key,
                  checksum text not null,
                  applied_at timestamptz not null default now()
                )
                """
            )
            cursor.execute(
                "alter table jobtrace_meta.schema_migrations add column if not exists checksum text"
            )
        connection.commit()

        for path in migrations:
            version = path.stem
            sql = path.read_text(encoding="utf-8")
            checksum = hashlib.sha256(sql.encode()).hexdigest()
            with connection.cursor() as cursor:
                cursor.execute(
                    "select checksum from jobtrace_meta.schema_migrations where version=%s",
                    (version,),
                )
                existing = cursor.fetchone()
                if existing:
                    if existing[0] and existing[0] != checksum:
                        raise SystemExit(f"Migration drift detected: {version}")
                    if not existing[0]:
                        cursor.execute(
                            "update jobtrace_meta.schema_migrations set checksum=%s where version=%s",
                            (checksum, version),
                        )
                        connection.commit()
                    print(f"SKIP {version}")
                    continue
                try:
                    cursor.execute(sql)
                    cursor.execute(
                        "insert into jobtrace_meta.schema_migrations(version, checksum) values(%s,%s)",
                        (version, checksum),
                    )
                    connection.commit()
                    print(f"APPLIED {version}")
                except Exception:
                    connection.rollback()
                    raise


if __name__ == "__main__":
    main()
