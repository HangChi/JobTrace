from __future__ import annotations

import os
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

from migrate_legacy_owner import backfill
from env import load_local_env


def with_database(url: str, database: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, f"/{database}", parts.query, parts.fragment))


def main() -> None:
    load_local_env()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")
    maintenance_url = with_database(url, "postgres")
    temporary = f"jobtrace_owner_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(maintenance_url, autocommit=True) as admin:
        admin.execute(sql.SQL("create database {} encoding 'UTF8' template template0").format(sql.Identifier(temporary)))
    try:
        target = with_database(url, temporary)
        with psycopg.connect(target) as connection:
            migrations = sorted(Path("supabase/migrations").glob("*.sql"))
            for path in migrations:
                if path.name > "20260813000700_owner_backfill.sql":
                    break
                connection.execute(path.read_text(encoding="utf-8"))
            connection.execute("insert into users(id,display_name,email) values ('owner-a','Owner A','a@example.test')")
            connection.execute("insert into applications(company_name,position_name,applied_date,latest_date) values ('Legacy','Role',current_date,current_date)")
            connection.execute("insert into import_batches(total_rows) values (0)")
            try:
                backfill(connection, "")
                raise AssertionError("missing owner must fail")
            except ValueError:
                pass
            try:
                backfill(connection, "missing-user")
                raise AssertionError("invalid owner must fail")
            except ValueError:
                pass
            assert backfill(connection, "owner-a") == (1, 1)
            for path in migrations:
                if path.name > "20260813000700_owner_backfill.sql":
                    connection.execute(path.read_text(encoding="utf-8"))
            nullable = connection.execute(
                "select count(*) from information_schema.columns where table_schema='public' and table_name in ('applications','import_batches') and column_name='owner_id' and is_nullable='YES'"
            ).fetchone()[0]
            assert nullable == 0
            connection.commit()
            print("PASS owner migration: missing, invalid, orphan backfill and NOT NULL enforcement")
    finally:
        with psycopg.connect(maintenance_url, autocommit=True) as admin:
            admin.execute(sql.SQL("drop database if exists {} with (force)").format(sql.Identifier(temporary)))


if __name__ == "__main__":
    main()
