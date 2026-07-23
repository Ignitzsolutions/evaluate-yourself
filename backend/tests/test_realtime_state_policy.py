from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend import app as app_module


def test_runtime_session_load_fails_fast_when_redis_unavailable_in_production(monkeypatch):
    monkeypatch.setattr(app_module, "is_production", True)

    def fail_redis():
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(app_module, "get_redis_client", fail_redis)

    with pytest.raises(HTTPException) as exc:
        app_module._load_runtime_session("session-1")

    assert exc.value.status_code == 500
    assert "Failed to load runtime session" in str(exc.value.detail)


def test_runtime_session_load_returns_empty_when_redis_unavailable_in_development(monkeypatch):
    monkeypatch.setattr(app_module, "is_production", False)

    def fail_redis():
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(app_module, "get_redis_client", fail_redis)

    assert app_module._load_runtime_session("session-1") == {}
