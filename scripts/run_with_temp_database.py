from __future__ import annotations

import os
import subprocess
import sys
import uuid
import shutil
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

from env import load_local_env


def with_database(url: str, database: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, f"/{database}", parts.query, parts.fragment))


def main() -> None:
    load_local_env()
    url = os.environ.get("DATABASE_URL")
    command = sys.argv[1:]
    if not url or not command:
        raise SystemExit("usage: run_with_temp_database.py <command> [args...]")
    maintenance_url = with_database(url, "postgres")
    temporary = f"jobtrace_test_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(maintenance_url, autocommit=True) as admin:
        admin.execute(sql.SQL("create database {} encoding 'UTF8' template template0").format(sql.Identifier(temporary)))
    try:
        target = with_database(url, temporary)
        with psycopg.connect(target) as connection:
            for path in sorted(Path("supabase/migrations").glob("*.sql")):
                connection.execute(path.read_text(encoding="utf-8"))
            connection.commit()
        environment = os.environ.copy()
        environment["DATABASE_URL"] = target
        executable = shutil.which(command[0])
        if not executable:
            raise SystemExit(f"command not found: {command[0]}")
        result = subprocess.run([executable, *command[1:]], env=environment, check=False)
        raise SystemExit(result.returncode)
    finally:
        with psycopg.connect(maintenance_url, autocommit=True) as admin:
            admin.execute(sql.SQL("drop database if exists {} with (force)").format(sql.Identifier(temporary)))
            print("PASS isolated test database removed")


if __name__ == "__main__":
    main()
