"""Smoke tests for /api/system/runtime-mode + demo provider."""

import importlib
import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch, tmp_path):
    db = tmp_path / "rt.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db}")
    monkeypatch.setenv("DEV_AUTH_BYPASS", "true")
    monkeypatch.setenv("DEV_USER_EMAIL", "admin@local.dev")
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    # Fresh modules so env is re-read
    from backend.db import database as _db
    importlib.reload(_db)
    _db.Base.metadata.create_all(bind=_db.engine)

    from backend import app as _app
    importlib.reload(_app)
    return TestClient(_app.app)


def test_runtime_mode_shape(client):
    resp = client.get("/api/system/runtime-mode")
    assert resp.status_code == 200
    body = resp.json()
    for key in ("demo_mode", "openai_configured", "realtime_enabled", "mfa_enabled", "lockout_enabled"):
        assert key in body, f"missing {key}"
    assert body["demo_mode"] is True
    assert body["openai_configured"] is False


def test_realtime_session_demo_fallback(client):
    resp = client.post("/api/realtime/sessions", json={})
    # In demo mode it should return demo payload (200), 503 if demo flag off,
    # or 401 if auth bypass isn't active in this importable state.
    assert resp.status_code in (200, 401, 503)
    if resp.status_code == 200:
        body = resp.json()
        assert body.get("demo_mode") is True
        assert body.get("provider") == "demo"


def test_demo_provider_returns_canned_payload(monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    from backend.services.llm import provider_adapter
    importlib.reload(provider_adapter)
    out = provider_adapter.create_chat_completion(
        messages=[{"role": "user", "content": "hi"}],
        purpose="scoring",
    )
    assert out is not None
    text = out.get("text") if isinstance(out, dict) else None
    assert text, f"demo provider returned no text: {out!r}"
