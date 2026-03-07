#!/usr/bin/env python3
"""Strict local startup smoke checks for backend API availability."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Iterable


def _request(base_url: str, path: str, max_bytes: int | None = 600) -> tuple[int, str]:
    url = f"{base_url.rstrip('/')}{path}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read() if max_bytes is None else resp.read(max_bytes)
            body = raw.decode("utf-8", "ignore")
            return int(resp.status), body
    except urllib.error.HTTPError as exc:
        raw = exc.read() if max_bytes is None else exc.read(max_bytes)
        body = raw.decode("utf-8", "ignore")
        return int(exc.code), body
    except Exception as exc:  # pragma: no cover - for local diagnostics
        return 0, f"{type(exc).__name__}: {exc}"


def _expect(base_url: str, path: str, allowed: Iterable[int]) -> bool:
    code, body = _request(base_url, path)
    allowed_set = set(allowed)
    if code in allowed_set:
        print(f"✅ {path} -> {code}")
        return True
    print(f"❌ {path} -> {code} (expected: {sorted(allowed_set)}) {body[:200]}")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Backend startup smoke check.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    checks_ok = all(
        [
            _expect(base_url, "/health", [200]),
            _expect(base_url, "/api/profile/status", [200, 401]),
            _expect(base_url, "/api/interview/skill-catalog", [200, 401]),
            _expect(base_url, "/openapi.json", [200]),
        ]
    )
    if not checks_ok:
        return 1

    code, body = _request(base_url, "/openapi.json", max_bytes=None)
    if code != 200:
        print(f"❌ /openapi.json -> {code}")
        return 1
    try:
        paths = (json.loads(body) or {}).get("paths", {})
    except Exception as exc:
        print(f"❌ Unable to parse OpenAPI JSON: {exc}")
        return 1

    required = [
        "/api/admin/dashboard/overview",
        "/api/admin/question-bank/tracks",
    ]
    missing = [path for path in required if path not in paths]
    if missing:
        print(f"❌ Missing admin routes in OpenAPI: {', '.join(missing)}")
        return 1

    print("✅ Startup smoke complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
