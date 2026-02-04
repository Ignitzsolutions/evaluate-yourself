"""Session and token validation middleware."""

import logging
from typing import Optional, Tuple
from fastapi import HTTPException, status

from .token_service import TokenService
from ..session.session_manager import SessionManager

logger = logging.getLogger(__name__)


class AuthMiddleware:
    """Gatekeeper for session and token validation."""

    def __init__(self, token_service: TokenService, session_manager: SessionManager):
        """Initialize with dependencies."""
        self.token_service = token_service
        self.session_manager = session_manager

    @staticmethod
    def extract_token(authorization_header: Optional[str], query_token: Optional[str]) -> Optional[str]:
        """Extract JWT token from Authorization header or query param."""
        if query_token:
            return query_token
        
        if authorization_header and authorization_header.startswith("Bearer "):
            return authorization_header[7:]
        
        return None

    def validate_and_extract(self, authorization_header: Optional[str], query_token: Optional[str]) -> Tuple[str, str, str]:
        """Validate token and extract claims."""
        token = self.extract_token(authorization_header, query_token)
        
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No token provided")
        
        claims = self.token_service.validate_token(token)
        if not claims:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
        
        session_id = claims.get("session_id")
        tenant_id = claims.get("tenant_id")
        candidate_id = claims.get("candidate_id")
        
        if not session_id or not tenant_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incomplete token claims")
        
        return session_id, tenant_id, candidate_id

    def validate_session(self, session_id: str, tenant_id: str) -> bool:
        """Validate session exists and belongs to tenant."""
        if not self.session_manager.validate_session(session_id, tenant_id):
            logger.warning(f"Invalid session {session_id} for tenant {tenant_id}")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session not found or invalid")
        
        return True
