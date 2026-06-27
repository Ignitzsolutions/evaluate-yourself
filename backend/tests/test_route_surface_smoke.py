from __future__ import annotations

import re
from typing import Iterable

from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from backend import app as app_module


SKIP_PATH_PREFIXES = (
    "/openapi.json",
    "/docs",
    "/redoc",
    "/static",
    "/assets",
    "/backend-static",
)

SKIP_EXACT_PATHS = {
    "/",
    "/favicon.ico",
}


def _iter_http_route_cases() -> Iterable[tuple[str, str]]:
    for route in app_module.app.routes:
        if not isinstance(route, APIRoute):
            continue

        path = route.path
        if path in SKIP_EXACT_PATHS or path.startswith(SKIP_PATH_PREFIXES):
            continue

        methods = sorted((route.methods or set()) - {"HEAD", "OPTIONS"})
        for method in methods:
            yield (method, path)


def _build_url(path: str) -> str:
    # Replace path params with harmless placeholders.
    # Example: /api/items/{item_id} -> /api/items/test
    return re.sub(r"\{[^}]+\}", "test", path)


def test_all_http_routes_respond_without_unhandled_server_errors():
    client = TestClient(app_module.app)
    cases = list(_iter_http_route_cases())
    # Guard so this test catches accidental router unregistering.
    assert len(cases) > 25

    failures: list[str] = []
    for method, path in cases:
        url = _build_url(path)
        kwargs = {"follow_redirects": False}
        if method in {"POST", "PUT", "PATCH"}:
            kwargs["json"] = {}

        response = client.request(method, url, **kwargs)
        if path == "/health" and response.status_code in {200, 503}:
            continue
        if response.status_code >= 500:
            failures.append(f"{method} {path} -> {response.status_code}")

    assert not failures, "Routes returning 5xx:\n" + "\n".join(failures)
