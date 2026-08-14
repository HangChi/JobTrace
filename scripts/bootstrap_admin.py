from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg
from env import load_local_env


def database_url() -> str | None:
    configured = os.environ.get("DATABASE_URL")
    if configured:
        return configured
    env_file = Path(".env.local")
    if not env_file.exists():
        return None
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("DATABASE_URL="):
            return line.removeprefix("DATABASE_URL=").strip()
    return None


def main() -> None:
    load_local_env()
    parser = argparse.ArgumentParser(description="Promote an existing JobTrace user to admin")
    parser.add_argument("email", help="Email of an already registered user")
    args = parser.parse_args()
    connection_url = database_url()
    if not connection_url:
        raise SystemExit("DATABASE_URL is required")

    with psycopg.connect(connection_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "update public.users set role='admin', updated_at=now() where lower(email)=lower(%s) returning id",
                (args.email,),
            )
            user = cursor.fetchone()
            if not user:
                raise SystemExit("User not found. Register the account first.")
        connection.commit()
    print(f"Admin granted to {args.email}")


if __name__ == "__main__":
    main()
