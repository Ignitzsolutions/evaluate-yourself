"""FastAPI middleware for session injection."""

import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from backend.services.session.session_manager import SessionManager
from backend.services.auth.middleware import AuthMiddleware

logger = logging.getLogger(__name__)


class SessionInjectionMiddleware(BaseHTTPMiddleware):
    """Inject validated session into request context."""

    def __init__(self, app, session_manager: SessionManager, auth_middleware: AuthMiddleware):
        """Initialize middleware."""
        super().__init__(app)
        self.session_manager = session_manager
        self.auth_middleware = auth_middleware

    async def dispatch(self, request: Request, call_next) -> Response:
        """Inject session into request.state."""
        try:
            # Extract auth header and query token
            auth_header = request.headers.get("Authorization")
            query_token = request.query_params.get("token")
            
            # Validate token and extract claims
            session_id, tenant_id, candidate_id = self.auth_middleware.validate_and_extract(auth_header, query_token)
            
            # Validate session
            self.auth_middleware.validate_session(session_id, tenant_id)
            
            # Load session
            session = self.session_manager.get_session(session_id)
            if not session:
                request.state.session = None
                request.state.error = "Session not found"
            else:
                request.state.session = session
                
                # Refresh TTL on success
                self.session_manager.touch_session(session_id)
        
        except Exception as e:
            request.state.session = None
            request.state.error = str(e)
        
        response = await call_next(request)
        return response
