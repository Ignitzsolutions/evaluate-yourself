"""Tests for communication-practice endpoints + feature flag + history rollup."""

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch, tmp_path):
    db = tmp_path / "cp.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db}")
    monkeypatch.setenv("DEV_AUTH_BYPASS", "true")
    monkeypatch.setenv("DEV_USER_EMAIL", "admin@local.dev")
    monkeypatch.setenv("COMMUNICATION_PRACTICE_ENABLED", "true")
    monkeypatch.setenv("DEMO_MODE", "true")

    from backend.db import database as _db
    importlib.reload(_db)
    _db.Base.metadata.create_all(bind=_db.engine)
    from backend import app as _app
    importlib.reload(_app)
    return TestClient(_app.app)


def test_packs_listing_shape(client):
    resp = client.get("/api/communication-practice/packs")
    assert resp.status_code == 200
    body = resp.json()
    assert "packs" in body and len(body["packs"]) > 0
    p0 = body["packs"][0]
    for k in ("id", "title"):
        assert k in p0


def test_evaluate_turn_scores_clean_input(client):
    packs = client.get("/api/communication-practice/packs").json()["packs"]
    pack_id = packs[0]["id"]
    nxt = client.post("/api/communication-practice/next-prompt", json={"pack_id": pack_id}).json()
    prompt = nxt.get("prompt") or nxt
    payload = {
        "pack_id": pack_id,
        "prompt_id": prompt.get("id", "demo-1"),
        "target_sentence": prompt.get("target_sentence", "Hello, how are you today?"),
        "spoken_text": "Hello, how are you today?",
        "duration_seconds": 3.2,
    }
    resp = client.post("/api/communication-practice/evaluate-turn", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert 0 <= body.get("score", -1) <= 100


def test_evaluate_turn_flags_sloppy_input(client):
    packs = client.get("/api/communication-practice/packs").json()["packs"]
    pack_id = packs[0]["id"]
    payload = {
        "pack_id": pack_id,
        "prompt_id": "demo-x",
        "target_sentence": "Could you please summarize the quarterly report?",
        "spoken_text": "uhh yeah um",
        "duration_seconds": 1.1,
    }
    resp = client.post("/api/communication-practice/evaluate-turn", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    flags = set(body.get("quality_flags") or [])
    # Expect at least one of these to fire on garbage input
    assert flags & {"TOO_SHORT", "LOW_PROMPT_COVERAGE", "STARTS_WITH_LOWERCASE", "MISSING_TERMINAL_PUNCTUATION"}


def test_history_endpoint_rollup(client):
    packs = client.get("/api/communication-practice/packs").json()["packs"]
    pack_id = packs[0]["id"]
    for spoken in ["Hello, how are you today?", "Yes I am fine.", "Thanks for asking."]:
        client.post("/api/communication-practice/evaluate-turn", json={
            "pack_id": pack_id, "prompt_id": "p1",
            "target_sentence": "Hello, how are you today?",
            "spoken_text": spoken, "duration_seconds": 2.0,
        })
    resp = client.get("/api/communication-practice/history?days=30")
    assert resp.status_code == 200
    body = resp.json()
    for key in ("attempts_total", "avg_score", "attempts_by_day", "top_quality_flags", "window_days"):
        assert key in body
    assert body["attempts_total"] >= 3


def test_flag_off_returns_404(monkeypatch, tmp_path):
    db = tmp_path / "cp_off.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db}")
    monkeypatch.setenv("DEV_AUTH_BYPASS", "true")
    monkeypatch.setenv("DEV_USER_EMAIL", "admin@local.dev")
    monkeypatch.setenv("COMMUNICATION_PRACTICE_ENABLED", "false")

    from backend.db import database as _db
    importlib.reload(_db)
    _db.Base.metadata.create_all(bind=_db.engine)
    from backend import app as _app
    importlib.reload(_app)
    c = TestClient(_app.app)
    assert c.get("/api/communication-practice/packs").status_code == 404
