from __future__ import annotations

import os
import argparse
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql
from env import load_local_env
from db_types import read_schema, write_types


def with_database(url: str, database: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, f"/{database}", parts.query, parts.fragment))


def main() -> None:
    load_local_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-types", action="store_true")
    args = parser.parse_args()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")
    maintenance_url = with_database(url, "postgres")
    temporary = f"jobtrace_verify_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(maintenance_url, autocommit=True) as admin:
        admin.execute(sql.SQL("create database {} encoding 'UTF8' template template0").format(sql.Identifier(temporary)))
    try:
        with psycopg.connect(with_database(url, temporary)) as connection:
            with connection.cursor() as cursor:
                for path in sorted(Path("supabase/migrations").glob("*.sql")):
                    cursor.execute(path.read_text(encoding="utf-8"))
                cursor.execute(Path("supabase/seed.sql").read_text(encoding="utf-8"))
                cursor.execute("select count(*) from applications")
                count = cursor.fetchone()[0]
                cursor.execute("select count(*) from application_events where type='created'")
                events = cursor.fetchone()[0]
                if count < 1 or events < 1:
                    raise SystemExit("seed verification failed")
                if args.write_types:
                    write_types(read_schema(cursor))
                    print("PASS generated database types from clean schema")
                print(f"PASS empty database replay: applications={count}, events={events}")
            connection.commit()
    finally:
        with psycopg.connect(maintenance_url, autocommit=True) as admin:
            admin.execute(sql.SQL("drop database if exists {} with (force)").format(sql.Identifier(temporary)))
            print("PASS temporary database removed")


if __name__ == "__main__": main()
