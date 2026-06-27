"""Tests for the login lockout service. Uses fakeredis as a stand-in."""

import importlib
import sys
import types

import fakeredis
import pytest


@pytest.fixture
def lockout(monkeypatch):
    fake = fakeredis.FakeRedis(decode_responses=True)

    # Stub db.redis_client.get_redis_client → fake redis.
    stub = types.ModuleType("db.redis_client")
    stub.get_redis_client = lambda: fake
    stub.is_production_env = lambda: False
    monkeypatch.setitem(sys.modules, "db.redis_client", stub)

    # Re-import lockout_service so it picks up the stub if it cached anything.
    from backend.services.auth import lockout_service as ls
    importlib.reload(ls)
    yield ls
    fake.flushall()


def test_not_locked_initially(lockout):
    locked, ttl = lockout.is_locked("a@b.com", "1.2.3.4")
    assert locked is False
    assert ttl == 0


def test_lock_after_five_failures(lockout):
    for _ in range(4):
        locked_now, _ = lockout.record_failure("a@b.com", "1.2.3.4")
        assert locked_now is False
    locked_now, ttl = lockout.record_failure("a@b.com", "1.2.3.4")
    assert locked_now is True
    assert ttl >= 1
    locked, ttl2 = lockout.is_locked("a@b.com", "1.2.3.4")
    assert locked is True
    assert ttl2 >= 1


def test_different_ip_separate_counter(lockout):
    for _ in range(5):
        lockout.record_failure("a@b.com", "1.1.1.1")
    locked_other, _ = lockout.is_locked("a@b.com", "9.9.9.9")
    assert locked_other is False


def test_clear_removes_lock(lockout):
    for _ in range(5):
        lockout.record_failure("a@b.com", "1.2.3.4")
    assert lockout.is_locked("a@b.com", "1.2.3.4")[0] is True
    lockout.clear("a@b.com", "1.2.3.4")
    assert lockout.is_locked("a@b.com", "1.2.3.4")[0] is False


def test_admin_unlock_clears_all_ips(lockout):
    for ip in ("1.1.1.1", "2.2.2.2", "3.3.3.3"):
        for _ in range(5):
            lockout.record_failure("a@b.com", ip)
    cleared = lockout.admin_unlock("a@b.com")
    assert cleared >= 3
    for ip in ("1.1.1.1", "2.2.2.2", "3.3.3.3"):
        assert lockout.is_locked("a@b.com", ip)[0] is False
