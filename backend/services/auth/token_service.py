"""JWT token creation and validation with JTI-based revocation support."""

import os
import logging
import secrets
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import jwt

logger = logging.getLogger(__name__)

_WEAK_FALLBACK = "dev-secret-change-in-prod"


class TokenService:
    """JWT token operations without PII, with JTI revocation support."""

    def __init__(
        self,
        secret_key: Optional[str] = None,
        issuer: str = "evaluate-yourself",
        audience: str = "evaluate-yourself-api",
        token_lifetime_hours: int = 1,
        redis_client=None,
    ):
        """Initialize token service.

        Raises RuntimeError in production if JWT_SECRET_KEY is missing or too short.
        """
        resolved = secret_key or os.getenv("JWT_SECRET_KEY")
        env = os.getenv("ENV", os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development"))).strip().lower()
        is_prod = env == "production"

        if not resolved:
            if is_prod:
                raise RuntimeError(
                    "JWT_SECRET_KEY must be set in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            resolved = _WEAK_FALLBACK
            logger.warning(
                "JWT_SECRET_KEY not set — using insecure fallback. "
                "Set JWT_SECRET_KEY to a random 32+ char secret before production."
            )
        elif resolved == _WEAK_FALLBACK:
            if is_prod:
                raise RuntimeError(
                    "JWT_SECRET_KEY is set to the default insecure value. "
                    "Generate a strong key: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            logger.warning("JWT_SECRET_KEY is the default weak value — replace before production.")

        if len(resolved) < 32:
            if is_prod:
                raise RuntimeError(f"JWT_SECRET_KEY must be at least 32 characters (got {len(resolved)}).")
            logger.warning(f"JWT_SECRET_KEY is only {len(resolved)} chars — use 32+ in production.")

        self.secret_key = resolved
        self.issuer = issuer
        self.audience = audience
        self.token_lifetime_seconds = token_lifetime_hours * 3600
        self.algorithm = "HS256"
        self._redis = redis_client

    # ------------------------------------------------------------------
    # Token creation
    # ------------------------------------------------------------------

    def create_session_token(
        self,
        session_id: str,
        candidate_id: str,
        tenant_id: str,
    ) -> str:
        """Create JWT session token (no PII). Includes unique `jti` for revocation."""
        now = datetime.now(timezone.utc)
        jti = str(uuid.uuid4())
        payload = {
            "iss": self.issuer,
            "aud": self.audience,
            "sub": candidate_id,
            "jti": jti,
            "session_id": session_id,
            "candidate_id": candidate_id,
            "tenant_id": tenant_id,
            "iat": now,
            "exp": now + timedelta(seconds=self.token_lifetime_seconds),
        }
        try:
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            logger.debug("Created session token for session %s (jti=%s)", session_id, jti)
            return token
        except Exception as e:
            logger.error("Error creating session token: %s", e)
            raise

    def create_refresh_token(
        self,
        session_id: str,
        candidate_id: str,
        tenant_id: str,
    ) -> str:
        """Create refresh token. Stores hash in Redis for rotation tracking."""
        now = datetime.now(timezone.utc)
        jti = str(uuid.uuid4())
        payload = {
            "iss": self.issuer,
            "aud": self.audience,
            "sub": candidate_id,
            "jti": jti,
            "session_id": session_id,
            "tenant_id": tenant_id,
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(days=7),
        }
        try:
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            # Store JTI in Redis so we can rotate/invalidate
            if self._redis:
                try:
                    self._redis.setex(f"refresh_jti:{jti}", 7 * 86400, session_id)
                except Exception as e:
                    logger.warning("Could not store refresh JTI in Redis: %s", e)
            return token
        except Exception as e:
            logger.error("Error creating refresh token: %s", e)
            raise

    # ------------------------------------------------------------------
    # Token validation
    # ------------------------------------------------------------------

    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate and decode JWT token. Checks JTI revocation list in Redis."""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                issuer=self.issuer,
                audience=self.audience,
            )
            # Check revocation
            jti = payload.get("jti")
            if jti and self._redis:
                try:
                    if self._redis.exists(f"revoked_jti:{jti}"):
                        logger.warning("Token JTI is revoked: %s", jti)
                        return None
                except Exception as e:
                    logger.warning("Could not check JTI revocation in Redis: %s", e)
            logger.debug("Validated token for session %s", payload.get("session_id"))
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid token: %s", e)
            return None

    # ------------------------------------------------------------------
    # Token revocation
    # ------------------------------------------------------------------

    def revoke_token(self, token: str) -> bool:
        """Revoke a token by adding its JTI to the Redis blocklist."""
        if not self._redis:
            logger.warning("Cannot revoke token: no Redis client configured")
            return False
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                issuer=self.issuer,
                audience=self.audience,
                options={"verify_exp": False},  # Allow revoking expired tokens
            )
            jti = payload.get("jti")
            if not jti:
                logger.warning("Cannot revoke token without JTI claim")
                return False
            exp = payload.get("exp", 0)
            now_ts = datetime.now(timezone.utc).timestamp()
            remaining_ttl = max(1, int(exp - now_ts))
            self._redis.setex(f"revoked_jti:{jti}", remaining_ttl, "1")
            logger.info("Revoked token JTI=%s (TTL=%ds)", jti, remaining_ttl)
            return True
        except Exception as e:
            logger.error("Error revoking token: %s", e)
            return False
