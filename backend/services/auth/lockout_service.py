"""Per-account + per-IP login lockout with exponential backoff.

Redis-backed counter; safe to call from any code path.
"""

from __future__ import annotations

import logging
import time
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

_FAIL_PREFIX = "auth:fail:"
_LOCK_PREFIX = "auth:lock:"
_MAX_FAILS_BEFORE_LOCK = 5
_BASE_LOCK_SECONDS = 60  # doubles each successive lock, capped
_MAX_LOCK_SECONDS = 60 * 60  # 1h
_WINDOW_SECONDS = 15 * 60


def _redis():
    from db.redis_client import get_redis_client
    return get_redis_client()


def _key(email: str, ip: Optional[str]) -> str:
    return f"{(email or '').lower().strip()}|{ip or 'unknown'}"


def is_locked(email: str, ip: Optional[str]) -> Tuple[bool, int]:
    """Return (locked, seconds_remaining)."""
    try:
        client = _redis()
        ttl = client.ttl(f"{_LOCK_PREFIX}{_key(email, ip)}")
        if ttl and ttl > 0:
            return True, int(ttl)
    except Exception as exc:
        logger.debug("lockout.is_locked failed: %s", exc)
    return False, 0


def record_failure(email: str, ip: Optional[str]) -> Tuple[bool, int]:
    """Increment failure count; lock if threshold exceeded.

    Returns (locked_now, seconds_until_unlock).
    """
    try:
        client = _redis()
        k = _key(email, ip)
        fkey = f"{_FAIL_PREFIX}{k}"
        lkey = f"{_LOCK_PREFIX}{k}"
        pipe = client.pipeline()
        pipe.incr(fkey)
        pipe.expire(fkey, _WINDOW_SECONDS)
        count, _ = pipe.execute()
        count = int(count or 0)
        if count >= _MAX_FAILS_BEFORE_LOCK:
            tier = max(0, count - _MAX_FAILS_BEFORE_LOCK)
            lock_seconds = min(_BASE_LOCK_SECONDS * (2 ** tier), _MAX_LOCK_SECONDS)
            client.setex(lkey, lock_seconds, "1")
            return True, lock_seconds
    except Exception as exc:
        logger.debug("lockout.record_failure failed: %s", exc)
    return False, 0


def clear(email: str, ip: Optional[str]) -> None:
    try:
        client = _redis()
        k = _key(email, ip)
        client.delete(f"{_FAIL_PREFIX}{k}", f"{_LOCK_PREFIX}{k}")
    except Exception as exc:
        logger.debug("lockout.clear failed: %s", exc)


def admin_unlock(email: str) -> int:
    """Wipe every lock + counter for an email across IPs."""
    cleared = 0
    try:
        client = _redis()
        prefix = (email or "").lower().strip() + "|"
        for pattern_prefix in (_FAIL_PREFIX, _LOCK_PREFIX):
            cursor = 0
            while True:
                cursor, keys = client.scan(cursor=cursor, match=f"{pattern_prefix}{prefix}*", count=200)
                if keys:
                    client.delete(*keys)
                    cleared += len(keys)
                if cursor == 0:
                    break
    except Exception as exc:
        logger.debug("lockout.admin_unlock failed: %s", exc)
    return cleared
