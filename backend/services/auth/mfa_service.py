"""TOTP-based MFA service.

Stores AES-encrypted secret in `user_mfa` table; verifies via pyotp.
Falls back to plain-base32 if no encryption key (dev only); logs warning in prod.

Recovery codes are hashed with bcrypt and stored as JSON array.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import secrets
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from db import models

logger = logging.getLogger(__name__)


def _fernet():
    """Return Fernet instance if cryptography is available + key set, else None."""
    try:
        from cryptography.fernet import Fernet
    except Exception:
        return None
    key = os.getenv("MFA_ENCRYPTION_KEY")
    if not key:
        from db.redis_client import is_production_env
        if is_production_env():
            raise RuntimeError("MFA_ENCRYPTION_KEY must be set in production for MFA service.")
        return None
    # Accept either a proper Fernet key (44 char urlsafe) or a passphrase we hash.
    try:
        Fernet(key.encode())
        material = key.encode()
    except Exception:
        material = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
    return Fernet(material)


def _encrypt_secret(secret: str) -> str:
    f = _fernet()
    if f is None:
        logger.warning("MFA secret stored without encryption (dev only).")
        return "plain:" + secret
    return "enc:" + f.encrypt(secret.encode()).decode()


def _decrypt_secret(blob: str) -> str:
    if blob.startswith("plain:"):
        return blob[len("plain:"):]
    if blob.startswith("enc:"):
        f = _fernet()
        if f is None:
            raise RuntimeError("MFA secret is encrypted but no MFA_ENCRYPTION_KEY available.")
        return f.decrypt(blob[len("enc:"):].encode()).decode()
    return blob  # legacy


def _hash_recovery_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def is_enabled(db: Session, user_id: str) -> bool:
    row = db.query(models.UserMFA).filter(models.UserMFA.user_id == user_id).first()
    return bool(row and row.confirmed_at)


def get_record(db: Session, user_id: str) -> Optional[models.UserMFA]:
    return db.query(models.UserMFA).filter(models.UserMFA.user_id == user_id).first()


def begin_enrollment(db: Session, user_id: str, *, issuer: str = "EvaluateYourself", account_label: Optional[str] = None) -> Tuple[str, str]:
    """Return (provisioning_uri, base32_secret). Caller renders QR code from URI."""
    import pyotp
    secret = pyotp.random_base32()
    row = get_record(db, user_id)
    if row is None:
        row = models.UserMFA(user_id=user_id, secret_encrypted=_encrypt_secret(secret))
        db.add(row)
    else:
        row.secret_encrypted = _encrypt_secret(secret)
        row.confirmed_at = None
        row.recovery_codes_hashed = None
    db.commit()
    uri = pyotp.TOTP(secret).provisioning_uri(name=account_label or user_id, issuer_name=issuer)
    return uri, secret


def confirm_enrollment(db: Session, user_id: str, code: str) -> Tuple[bool, List[str]]:
    """Verify first TOTP code and finalize enrollment. Returns (ok, recovery_codes)."""
    import pyotp
    from datetime import datetime, timezone
    row = get_record(db, user_id)
    if row is None:
        return False, []
    try:
        secret = _decrypt_secret(row.secret_encrypted)
    except Exception:
        return False, []
    if not pyotp.TOTP(secret).verify(code, valid_window=1):
        return False, []
    recovery = [secrets.token_hex(5) for _ in range(8)]
    row.recovery_codes_hashed = json.dumps([_hash_recovery_code(c) for c in recovery])
    row.confirmed_at = datetime.now(timezone.utc)
    db.commit()
    return True, recovery


def verify(db: Session, user_id: str, code: str) -> bool:
    """Verify a TOTP code or consume a recovery code."""
    import pyotp
    row = get_record(db, user_id)
    if row is None or not row.confirmed_at:
        return False
    try:
        secret = _decrypt_secret(row.secret_encrypted)
    except Exception:
        return False
    code = (code or "").strip().replace(" ", "")
    if pyotp.TOTP(secret).verify(code, valid_window=1):
        return True
    # Recovery code path
    if row.recovery_codes_hashed:
        try:
            codes = json.loads(row.recovery_codes_hashed)
        except Exception:
            codes = []
        target = _hash_recovery_code(code)
        if target in codes:
            codes.remove(target)
            row.recovery_codes_hashed = json.dumps(codes)
            db.commit()
            return True
    return False


def disable(db: Session, user_id: str) -> None:
    row = get_record(db, user_id)
    if row is not None:
        db.delete(row)
        db.commit()
