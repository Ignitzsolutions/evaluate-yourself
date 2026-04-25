"""Security headers middleware for production hardening."""

import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_env = os.getenv("ENV", os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development"))).strip().lower()
_IS_PROD = _env == "production"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard security headers to every HTTP response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(self), microphone=(self), geolocation=()"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://clerk.evaluate-yourself.com; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob: https:; "
            "media-src 'self' blob:; "
            "connect-src 'self' https: wss:; "
            "worker-src 'self' blob:; "
            "frame-ancestors 'none'"
        )
        if _IS_PROD:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
        return response
