"""Non-blocking usage recorder.

`record_llm_usage(...)` can be called from sync or async code paths.
Persists a `LLMUsageEvent` and publishes a `usage:events` Redis pub/sub message
that the admin live SSE stream subscribes to.

Errors are swallowed and logged — telemetry must never break the request path.
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional

from db.database import SessionLocal
from db import models
from services.observability.pricing import estimate_cost_micro_usd

logger = logging.getLogger(__name__)

_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="usage-recorder")
_REDIS_CHANNEL = "usage:events"


def _publish_event(payload: dict) -> None:
    try:
        from db.redis_client import get_redis_client
        client = get_redis_client()
        client.publish(_REDIS_CHANNEL, json.dumps(payload, default=str))
    except Exception as exc:
        logger.debug("usage_recorder: redis publish failed: %s", exc)


def _persist_event(event: models.LLMUsageEvent, summary: dict) -> None:
    db = SessionLocal()
    try:
        db.add(event)
        db.commit()
    except Exception as exc:
        logger.warning("usage_recorder: db write failed: %s", exc)
        db.rollback()
    finally:
        db.close()
    _publish_event(summary)


def record_llm_usage(
    *,
    model: str,
    route: str,
    user_id: Optional[str] = None,
    clerk_user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    provider: str = "openai",
    kind: str = "chat",
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    audio_input_seconds: int = 0,
    audio_output_seconds: int = 0,
    latency_ms: Optional[int] = None,
) -> None:
    """Fire-and-forget usage record."""
    try:
        from services.feature_flags import usage_recording_enabled
        if not usage_recording_enabled():
            return
    except Exception:
        pass
    try:
        total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)
        cost_micro = estimate_cost_micro_usd(
            model,
            prompt_tokens=prompt_tokens or 0,
            completion_tokens=completion_tokens or 0,
            audio_input_seconds=audio_input_seconds or 0,
            audio_output_seconds=audio_output_seconds or 0,
        )
        now = datetime.now(timezone.utc)
        event = models.LLMUsageEvent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            clerk_user_id=clerk_user_id,
            session_id=session_id,
            route=route,
            provider=provider,
            model=model,
            kind=kind,
            prompt_tokens=prompt_tokens or 0,
            completion_tokens=completion_tokens or 0,
            total_tokens=total_tokens,
            audio_input_seconds=audio_input_seconds or 0,
            audio_output_seconds=audio_output_seconds or 0,
            est_cost_usd_micro=cost_micro,
            latency_ms=latency_ms,
            created_at=now,
        )
        summary = {
            "type": "usage",
            "user_id": user_id,
            "clerk_user_id": clerk_user_id,
            "session_id": session_id,
            "route": route,
            "model": model,
            "kind": kind,
            "tokens": total_tokens,
            "audio_seconds": (audio_input_seconds or 0) + (audio_output_seconds or 0),
            "est_cost_usd": cost_micro / 1_000_000.0,
            "ts": now.isoformat(),
        }
        _EXECUTOR.submit(_persist_event, event, summary)
    except Exception as exc:
        logger.debug("usage_recorder: failed to enqueue: %s", exc)


def record_openai_response_usage(
    response_usage,
    *,
    model: str,
    route: str,
    **ctx,
) -> None:
    """Convenience wrapper for OpenAI ChatCompletion / Responses usage payloads.

    Accepts either a dict or an object with prompt_tokens/completion_tokens attrs.
    """
    if response_usage is None:
        return
    try:
        if isinstance(response_usage, dict):
            pt = int(response_usage.get("prompt_tokens", 0) or 0)
            ct = int(response_usage.get("completion_tokens", 0) or 0)
        else:
            pt = int(getattr(response_usage, "prompt_tokens", 0) or 0)
            ct = int(getattr(response_usage, "completion_tokens", 0) or 0)
        record_llm_usage(
            model=model,
            route=route,
            prompt_tokens=pt,
            completion_tokens=ct,
            **ctx,
        )
    except Exception as exc:
        logger.debug("usage_recorder: openai usage parse failed: %s", exc)
