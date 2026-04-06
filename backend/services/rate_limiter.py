from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Callable, Iterable, Optional, Protocol

import redis
from redis.exceptions import RedisError
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response


logger = logging.getLogger(__name__)

TRUTHY_VALUES = {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class RateLimitRule:
    name: str
    path_prefix: str
    limit: int
    window_seconds: int


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    key: str
    limit: int
    remaining: int
    reset_after_seconds: int


class RateLimitStorage(Protocol):
    def increment(self, key: str, window_seconds: int, now: Optional[int] = None) -> tuple[int, int]:
        ...


class InMemoryRateLimitStorage:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: dict[str, tuple[int, int]] = {}

    def increment(self, key: str, window_seconds: int, now: Optional[int] = None) -> tuple[int, int]:
        current = int(now or time.time())
        expires_at = current + window_seconds
        with self._lock:
            count, bucket_expires_at = self._buckets.get(key, (0, expires_at))
            if bucket_expires_at <= current:
                count = 0
                bucket_expires_at = expires_at
            count += 1
            self._buckets[key] = (count, bucket_expires_at)
            return count, max(1, bucket_expires_at - current)


class RedisRateLimitStorage:
    def __init__(self, redis_client: redis.Redis) -> None:
        self.redis = redis_client

    def increment(self, key: str, window_seconds: int, now: Optional[int] = None) -> tuple[int, int]:
        count = int(self.redis.incr(key))
        ttl = int(self.redis.ttl(key))
        if count == 1 or ttl < 0:
            self.redis.expire(key, window_seconds)
            ttl = window_seconds
        return count, max(1, ttl)


class ResilientRateLimitStorage:
    def __init__(
        self,
        primary: RedisRateLimitStorage,
        fallback: Optional[InMemoryRateLimitStorage] = None,
    ) -> None:
        self.primary = primary
        self.fallback = fallback or InMemoryRateLimitStorage()
        self._using_fallback = False

    def increment(self, key: str, window_seconds: int, now: Optional[int] = None) -> tuple[int, int]:
        if self._using_fallback:
            return self.fallback.increment(key, window_seconds, now=now)
        try:
            return self.primary.increment(key, window_seconds, now=now)
        except RedisError as exc:
            self._using_fallback = True
            logger.warning("Rate limiter Redis backend unavailable; switching to in-memory fallback: %s", exc)
            return self.fallback.increment(key, window_seconds, now=now)


class RateLimiter:
    def __init__(
        self,
        rules: Iterable[RateLimitRule],
        storage: RateLimitStorage,
        *,
        enabled: bool = True,
        key_prefix: str = "rate_limit",
    ) -> None:
        self.rules = list(rules)
        self.storage = storage
        self.enabled = enabled
        self.key_prefix = key_prefix

    def _match_rule(self, path: str) -> Optional[RateLimitRule]:
        for rule in self.rules:
            if path.startswith(rule.path_prefix):
                return rule
        return None

    def _get_client_identifier(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for", "").strip()
        if forwarded_for:
            first = forwarded_for.split(",")[0].strip()
            if first:
                return first
        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    def should_skip(self, request: Request) -> bool:
        path = request.url.path
        if request.method.upper() == "OPTIONS":
            return True
        if path in {"/health", "/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}:
            return True
        if path.startswith("/static") or path.startswith("/backend-static"):
            return True
        return False

    def check(self, request: Request) -> Optional[RateLimitDecision]:
        if not self.enabled or self.should_skip(request):
            return None

        rule = self._match_rule(request.url.path)
        if not rule:
            return None

        current = int(time.time())
        window_slot = current // rule.window_seconds
        identifier = self._get_client_identifier(request)
        key = f"{self.key_prefix}:{rule.name}:{identifier}:{window_slot}"
        count, ttl = self.storage.increment(key, rule.window_seconds, now=current)
        remaining = max(0, rule.limit - count)
        return RateLimitDecision(
            allowed=count <= rule.limit,
            key=key,
            limit=rule.limit,
            remaining=remaining,
            reset_after_seconds=max(1, ttl),
        )


def build_default_rate_limit_rules(env: Optional[dict[str, str]] = None) -> list[RateLimitRule]:
    source = env or os.environ
    return [
        RateLimitRule(
            name="realtime",
            path_prefix="/api/realtime/webrtc",
            limit=int(source.get("RATE_LIMIT_REALTIME_PER_MINUTE", "20")),
            window_seconds=int(source.get("RATE_LIMIT_REALTIME_WINDOW_SECONDS", "60")),
        ),
        RateLimitRule(
            name="admin",
            path_prefix="/api/admin",
            limit=int(source.get("RATE_LIMIT_ADMIN_PER_MINUTE", "300")),
            window_seconds=int(source.get("RATE_LIMIT_ADMIN_WINDOW_SECONDS", "60")),
        ),
        RateLimitRule(
            name="interview",
            path_prefix="/api/interview",
            limit=int(source.get("RATE_LIMIT_INTERVIEW_PER_MINUTE", "180")),
            window_seconds=int(source.get("RATE_LIMIT_INTERVIEW_WINDOW_SECONDS", "60")),
        ),
        RateLimitRule(
            name="profile",
            path_prefix="/api/me",
            limit=int(source.get("RATE_LIMIT_PROFILE_PER_MINUTE", "120")),
            window_seconds=int(source.get("RATE_LIMIT_PROFILE_WINDOW_SECONDS", "60")),
        ),
        RateLimitRule(
            name="api",
            path_prefix="/api",
            limit=int(source.get("RATE_LIMIT_API_PER_MINUTE", "300")),
            window_seconds=int(source.get("RATE_LIMIT_API_WINDOW_SECONDS", "60")),
        ),
    ]


def build_default_rate_limiter(redis_client: Optional[redis.Redis] = None) -> RateLimiter:
    enabled = (os.getenv("RATE_LIMIT_ENABLED", "true").strip().lower() in TRUTHY_VALUES)
    if redis_client is not None:
        storage: InMemoryRateLimitStorage | RedisRateLimitStorage | ResilientRateLimitStorage = ResilientRateLimitStorage(
            RedisRateLimitStorage(redis_client)
        )
    else:
        storage = InMemoryRateLimitStorage()
    return RateLimiter(
        build_default_rate_limit_rules(),
        storage,
        enabled=enabled,
    )


def apply_rate_limit_headers(response: Response, decision: Optional[RateLimitDecision]) -> Response:
    if not decision:
        return response
    response.headers["X-RateLimit-Limit"] = str(decision.limit)
    response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
    response.headers["X-RateLimit-Reset"] = str(decision.reset_after_seconds)
    return response


def register_rate_limit_middleware(app: FastAPI, limiter: RateLimiter) -> None:
    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next: Callable):
        decision = limiter.check(request)
        if decision and not decision.allowed:
            response = JSONResponse(
                status_code=429,
                content={
                    "detail": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Too many requests. Please retry shortly.",
                        "limit": decision.limit,
                        "retry_after_seconds": decision.reset_after_seconds,
                    }
                },
            )
            response.headers["Retry-After"] = str(decision.reset_after_seconds)
            return apply_rate_limit_headers(response, decision)

        response = await call_next(request)
        return apply_rate_limit_headers(response, decision)
