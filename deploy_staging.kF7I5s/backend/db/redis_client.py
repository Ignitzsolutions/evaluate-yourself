"""Redis client factory for Azure Redis Cache support."""

import os
import logging
from typing import Optional
import redis
from redis.exceptions import ConnectionError, TimeoutError

logger = logging.getLogger(__name__)

# Global Redis client instance
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    """Get or create Redis client singleton.
    
    Supports both local development and Azure Redis Cache:
    - Local: REDIS_URL not set → localhost:6379
    - Azure: REDIS_URL=rediss://xxx.redis.cache.windows.net:6380
    
    Returns:
        redis.Redis: Configured Redis client
    """
    global _redis_client
    
    if _redis_client is None:
        redis_url = os.getenv("REDIS_URL")
        
        if redis_url:
            # Parse Redis URL (supports redis:// and rediss:// for TLS)
            logger.info(f"Connecting to Redis via URL (TLS: {redis_url.startswith('rediss://')})")
            _redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=int(os.getenv("REDIS_TIMEOUT", "5")),
                socket_connect_timeout=int(os.getenv("REDIS_CONNECT_TIMEOUT", "5")),
                socket_keepalive=True,
                health_check_interval=int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "30")),
                retry_on_timeout=True,
                max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "50"))
            )
        else:
            # Local development fallback
            host = os.getenv("REDIS_HOST", "localhost")
            port = int(os.getenv("REDIS_PORT", "6379"))
            logger.info(f"Connecting to Redis at {host}:{port} (local development)")
            _redis_client = redis.Redis(
                host=host,
                port=port,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30,
                retry_on_timeout=True
            )
    
    return _redis_client


def test_redis_connection() -> tuple[bool, str, float]:
    """Test Redis connectivity for health checks.
    
    Returns:
        tuple: (success: bool, message: str, latency_ms: float)
    """
    import time
    start = time.time()
    try:
        client = get_redis_client()
        result = client.ping()
        latency_ms = (time.time() - start) * 1000
        if result:
            return True, "Redis connected", latency_ms
        else:
            return False, "Redis PING failed", latency_ms
    except (ConnectionError, TimeoutError) as e:
        latency_ms = (time.time() - start) * 1000
        logger.error(f"Redis health check failed: {e}")
        return False, f"Connection error: {str(e)}", latency_ms
    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        logger.error(f"Redis health check failed: {e}")
        return False, str(e), latency_ms


def close_redis_client():
    """Close Redis client connection pool (for graceful shutdown)."""
    global _redis_client
    if _redis_client:
        _redis_client.close()
        _redis_client = None
        logger.info("Redis client closed")
