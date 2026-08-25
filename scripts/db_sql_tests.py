from __future__ import annotations

import os
from pathlib import Path

import psycopg

from env import load_local_env


def main() -> None:
    load_local_env()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")

    failures: list[str] = []
    with psycopg.connect(database_url, autocommit=True) as connection:
        connection.execute("create extension if not exists pgtap with schema public")
        for path in sorted(Path("supabase/tests").glob("*.sql")):
            messages: list[str] = []
            with connection.cursor() as cursor:
                cursor.execute(path.read_text(encoding="utf-8"), prepare=False)
                while True:
                    if cursor.description:
                        messages.extend(
                            str(value)
                            for row in cursor.fetchall()
                            for value in row
                            if value is not None
                        )
                    if not cursor.nextset():
                        break
            failed = [message for message in messages if message.startswith("not ok")]
            if failed:
                failures.extend(f"{path.name}: {message}" for message in failed)
                print(f"FAIL {path.name}")
            else:
                print(f"PASS {path.name}")

    if failures:
        raise SystemExit("\n".join(failures))


if __name__ == "__main__":
    main()
