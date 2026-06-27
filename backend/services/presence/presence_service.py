"""Redis-backed user presence with TTL heartbeats + pub/sub events.

Each `mark_active` write extends a per-user TTL key and publishes a
`presence:events` message that the admin live SSE stream relays.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Iterable, List, Optional

logger = logging.getLogger(__name__)

_PRESENCE_PREFIX = "presence:user:"
_PRESENCE_SET = "presence:active"
_CHANNEL = "presence:events"
_DEFAULT_TTL_SECONDS = 60


def _redis():
    from db.redis_client import get_redis_client
    return get_redis_client()


def mark_active(
    user_id: str,
    *,
    clerk_user_id: Optional[str] = None,
    email: Optional[str] = None,
    route: Optional[str] = None,
    session_id: Optional[str] = None,
    ttl_seconds: int = _DEFAULT_TTL_SECONDS,
) -> None:
    """Record a heartbeat. Fire-and-forget — never raises."""
    try:
        client = _redis()
        now_ms = int(time.time() * 1000)
        payload = {
            "user_id": user_id,
            "clerk_user_id": clerk_user_id,
            "email": email,
            "route": route,
            "session_id": session_id,
            "last_seen_ms": now_ms,
        }
        key = f"{_PRESENCE_PREFIX}{user_id}"
        pipe = client.pipeline()
        pipe.setex(key, ttl_seconds, json.dumps(payload, default=str))
        pipe.zadd(_PRESENCE_SET, {user_id: now_ms})
        pipe.zremrangebyscore(_PRESENCE_SET, 0, now_ms - ttl_seconds * 1000)
        pipe.execute()
        client.publish(_CHANNEL, json.dumps({"type": "heartbeat", **payload}, default=str))
    except Exception as exc:
        logger.debug("presence.mark_active failed: %s", exc)


def mark_offline(user_id: str) -> None:
    try:
        client = _redis()
        client.delete(f"{_PRESENCE_PREFIX}{user_id}")
        client.zrem(_PRESENCE_SET, user_id)
        client.publish(_CHANNEL, json.dumps({"type": "offline", "user_id": user_id}))
    except Exception as exc:
        logger.debug("presence.mark_offline failed: %s", exc)


def list_active(window_seconds: int = 60, limit: int = 200) -> List[dict]:
    """Return active users seen within window_seconds, newest first."""
    try:
        client = _redis()
        now_ms = int(time.time() * 1000)
        cutoff = now_ms - window_seconds * 1000
        ids = client.zrevrangebyscore(_PRESENCE_SET, now_ms, cutoff, start=0, num=limit)
        if not ids:
            return []
        keys = [f"{_PRESENCE_PREFIX}{uid}" for uid in ids]
        raw = client.mget(keys)
        out: List[dict] = []
        for uid, blob in zip(ids, raw):
            if not blob:
                continue
            try:
                out.append(json.loads(blob))
            except Exception:
                continue
        return out
    except Exception as exc:
        logger.debug("presence.list_active failed: %s", exc)
        return []


def count_active(window_seconds: int = 60) -> int:
    try:
        client = _redis()
        now_ms = int(time.time() * 1000)
        cutoff = now_ms - window_seconds * 1000
        return int(client.zcount(_PRESENCE_SET, cutoff, now_ms))
    except Exception:
        return 0
