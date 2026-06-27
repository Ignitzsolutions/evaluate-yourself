"""Append-only auth audit log helpers."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from db.database import SessionLocal
from db import models

logger = logging.getLogger(__name__)


def log_event(
    event_type: str,
    *,
    outcome: str = "success",
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    detail: Optional[dict] = None,
) -> None:
    """Best-effort append. Never raises."""
    db = SessionLocal()
    try:
        row = models.AuthAuditEvent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            email=(email or "").lower() or None,
            event_type=event_type,
            outcome=outcome,
            ip_address=ip_address,
            user_agent=(user_agent or "")[:255] or None,
            detail=json.dumps(detail, default=str) if detail else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(row)
        db.commit()
    except Exception as exc:
        logger.debug("audit_log.log_event failed: %s", exc)
        db.rollback()
    finally:
        db.close()
