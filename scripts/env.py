from __future__ import annotations

import os
from pathlib import Path


def load_local_env() -> None:
    path = Path(".env.local")
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        key = key.strip()
        if not os.environ.get(key):
            os.environ[key] = value
