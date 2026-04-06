from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
import fakeredis

from backend.services.rate_limiter import (
    InMemoryRateLimitStorage,
    RateLimiter,
    RateLimitRule,
    RedisRateLimitStorage,
    ResilientRateLimitStorage,
    register_rate_limit_middleware,
)
from redis.exceptions import RedisError


def _make_app(storage):
    app = FastAPI()
    limiter = RateLimiter(
        [RateLimitRule(name="api", path_prefix="/api", limit=2, window_seconds=60)],
        storage,
    )
    register_rate_limit_middleware(app, limiter)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3001"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/demo")
    def demo():
        return {"ok": True}

    @app.get("/health")
    def health():
        return {"status": "healthy"}

    return app


def test_in_memory_rate_limiter_blocks_after_limit():
    app = _make_app(InMemoryRateLimitStorage())
    client = TestClient(app)
    headers = {"x-forwarded-for": "10.0.0.1"}

    first = client.get("/api/demo", headers=headers)
    second = client.get("/api/demo", headers=headers)
    third = client.get("/api/demo", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["detail"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert third.headers["X-RateLimit-Limit"] == "2"
    assert third.headers["X-RateLimit-Remaining"] == "0"
    assert int(third.headers["Retry-After"]) >= 1


def test_rate_limiter_skips_health_endpoint():
    app = _make_app(InMemoryRateLimitStorage())
    client = TestClient(app)

    for _ in range(5):
        response = client.get("/health", headers={"x-forwarded-for": "10.0.0.2"})
        assert response.status_code == 200


def test_redis_backed_rate_limiter_preserves_cors_headers_on_429():
    fake_redis = fakeredis.FakeRedis(decode_responses=True)
    app = _make_app(RedisRateLimitStorage(fake_redis))
    client = TestClient(app)
    headers = {
        "Origin": "http://localhost:3001",
        "x-forwarded-for": "10.0.0.3",
    }

    client.get("/api/demo", headers=headers)
    client.get("/api/demo", headers=headers)
    blocked = client.get("/api/demo", headers=headers)

    assert blocked.status_code == 429
    assert blocked.headers["access-control-allow-origin"] == "http://localhost:3001"


def test_resilient_rate_limiter_falls_back_when_redis_is_unavailable():
    class BrokenRedisStorage:
        def increment(self, key: str, window_seconds: int, now=None):
            raise RedisError("redis unavailable")

    storage = ResilientRateLimitStorage(BrokenRedisStorage(), InMemoryRateLimitStorage())
    app = _make_app(storage)
    client = TestClient(app)
    headers = {"x-forwarded-for": "10.0.0.4"}

    first = client.get("/api/demo", headers=headers)
    second = client.get("/api/demo", headers=headers)
    third = client.get("/api/demo", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
