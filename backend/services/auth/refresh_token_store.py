"""Persistent refresh-token store with rotation + reuse detection.

Each refresh issues a new JTI in the same family. Reusing an old (revoked) JTI
revokes the entire family (likely compromise).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from db import models

logger = logging.getLogger(__name__)

DEFAULT_LIFETIME_DAYS = 30


def issue(
    db: Session,
    *,
    user_id: str,
    family_id: Optional[str] = None,
    parent_jti: Optional[str] = None,
    device_label: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    lifetime_days: int = DEFAULT_LIFETIME_DAYS,
) -> models.RefreshTokenRecord:
    now = datetime.now(timezone.utc)
    rec = models.RefreshTokenRecord(
        jti=str(uuid.uuid4()),
        user_id=user_id,
        family_id=family_id or str(uuid.uuid4()),
        parent_jti=parent_jti,
        device_label=device_label,
        ip_address=ip_address,
        user_agent=user_agent,
        issued_at=now,
        expires_at=now + timedelta(days=lifetime_days),
    )
    db.add(rec)
    db.commit()
    return rec


def rotate(
    db: Session,
    *,
    presented_jti: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[Optional[models.RefreshTokenRecord], Optional[str]]:
    """Return (new_record, error_reason). On reuse detection, revokes the family."""
    rec = (
        db.query(models.RefreshTokenRecord)
        .filter(models.RefreshTokenRecord.jti == presented_jti)
        .first()
    )
    if rec is None:
        return None, "not_found"
    now = datetime.now(timezone.utc)
    exp = rec.expires_at
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < now:
        return None, "expired"
    if rec.revoked_at:
        # Reuse detection: kill the family.
        revoke_family(db, rec.family_id, reason="reuse_detected")
        return None, "reuse_detected"
    rec.revoked_at = now
    rec.revoked_reason = "rotated"
    rec.last_used_at = now
    db.commit()
    new_rec = issue(
        db,
        user_id=rec.user_id,
        family_id=rec.family_id,
        parent_jti=rec.jti,
        device_label=rec.device_label,
        ip_address=ip_address or rec.ip_address,
        user_agent=user_agent or rec.user_agent,
    )
    return new_rec, None


def revoke(db: Session, jti: str, *, reason: str = "manual") -> bool:
    rec = db.query(models.RefreshTokenRecord).filter(models.RefreshTokenRecord.jti == jti).first()
    if rec is None or rec.revoked_at:
        return False
    rec.revoked_at = datetime.now(timezone.utc)
    rec.revoked_reason = reason
    db.commit()
    return True


def revoke_family(db: Session, family_id: str, *, reason: str = "manual") -> int:
    now = datetime.now(timezone.utc)
    count = (
        db.query(models.RefreshTokenRecord)
        .filter(
            models.RefreshTokenRecord.family_id == family_id,
            models.RefreshTokenRecord.revoked_at.is_(None),
        )
        .update({"revoked_at": now, "revoked_reason": reason}, synchronize_session=False)
    )
    db.commit()
    return int(count)


def list_active_sessions(db: Session, user_id: str) -> List[models.RefreshTokenRecord]:
    return (
        db.query(models.RefreshTokenRecord)
        .filter(
            models.RefreshTokenRecord.user_id == user_id,
            models.RefreshTokenRecord.revoked_at.is_(None),
        )
        .order_by(models.RefreshTokenRecord.issued_at.desc())
        .all()
    )
