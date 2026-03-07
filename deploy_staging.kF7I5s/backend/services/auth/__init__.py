"""JWT token creation and validation without storing secrets in tokens."""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt

logger = logging.getLogger(__name__)


class TokenService:
    """JWT token operations without PII."""

    def __init__(
        self,
        secret_key: Optional[str] = None,
        issuer: str = "evaluate-yourself",
        audience: str = "evaluate-yourself-api",
        token_lifetime_hours: int = 1
    ):
        """Initialize token service."""
        self.secret_key = secret_key or os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-prod")
        self.issuer = issuer
        self.audience = audience
        self.token_lifetime_seconds = token_lifetime_hours * 3600
        self.algorithm = "HS256"

    def create_session_token(
        self,
        session_id: str,
        candidate_id: str,
        tenant_id: str
    ) -> str:
        """Create JWT session token (no PII)."""
        now = datetime.utcnow()
        payload = {
            "iss": self.issuer,
            "aud": self.audience,
            "sub": candidate_id,
            "session_id": session_id,
            "candidate_id": candidate_id,
            "tenant_id": tenant_id,
            "iat": now,
            "exp": now + timedelta(seconds=self.token_lifetime_seconds)
        }
        
        try:
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            logger.debug(f"Created token for session {session_id}")
            return token
        except Exception as e:
            logger.error(f"Error creating token: {e}")
            raise

    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate and decode JWT token."""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                issuer=self.issuer,
                audience=self.audience
            )
            logger.debug(f"Validated token for session {payload.get('session_id')}")
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None

    def create_refresh_token(self, session_id: str, candidate_id: str, tenant_id: str) -> str:
        """Create a longer-lived refresh token."""
        now = datetime.utcnow()
        payload = {
            "iss": self.issuer,
            "aud": self.audience,
            "sub": candidate_id,
            "session_id": session_id,
            "tenant_id": tenant_id,
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(days=7)
        }
        
        try:
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            return token
        except Exception as e:
            logger.error(f"Error creating refresh token: {e}")
            raise
