"""Security headers middleware for production hardening."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from db.redis_client import is_production_env


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard security headers to every HTTP response.

    Static headers are pre-built at init time to avoid per-request reconstruction.
    HSTS is only set in production.
    """

    def __init__(self, app):
        super().__init__(app)
        self._static_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
            "Content-Security-Policy": (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob: https:; "
                "media-src 'self' blob:; "
                "connect-src 'self' https: wss:; "
                "worker-src 'self' blob:; "
                "frame-ancestors 'none'"
            ),
        }
        if is_production_env():
            self._static_headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.update(self._static_headers)
        return response
