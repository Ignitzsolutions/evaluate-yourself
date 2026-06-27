"""Tests for the presence service (Redis-backed heartbeats)."""

import importlib
import sys
import types
import time

import fakeredis
import pytest


@pytest.fixture
def presence(monkeypatch):
    fake = fakeredis.FakeRedis(decode_responses=True)
    stub = types.ModuleType("db.redis_client")
    stub.get_redis_client = lambda: fake
    stub.is_production_env = lambda: False
    monkeypatch.setitem(sys.modules, "db.redis_client", stub)
    from backend.services.presence import presence_service as ps
    importlib.reload(ps)
    yield ps
    fake.flushall()


def test_mark_and_list_active(presence):
    presence.mark_active("u1", email="u1@example.com", route="/practice")
    presence.mark_active("u2", email="u2@example.com", route="/admin")
    items = presence.list_active(window_seconds=30)
    ids = {i["user_id"] for i in items}
    assert ids == {"u1", "u2"}
    assert presence.count_active(window_seconds=30) == 2


def test_offline_removes_user(presence):
    presence.mark_active("u1")
    presence.mark_offline("u1")
    assert presence.count_active(window_seconds=30) == 0


def test_short_ttl_drops_from_active(presence):
    presence.mark_active("u1", ttl_seconds=1)
    time.sleep(1.2)
    # After TTL, the underlying key expires and zset is pruned on the next write.
    presence.mark_active("u2", ttl_seconds=30)
    items = presence.list_active(window_seconds=1)
    ids = {i["user_id"] for i in items}
    assert "u1" not in ids
    assert "u2" in ids
