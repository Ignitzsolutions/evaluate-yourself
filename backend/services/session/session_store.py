"""Redis session store with atomic WATCH/MULTI/EXEC operations."""

import json
import logging
from typing import Optional, Any, Dict, Callable, cast
import redis
from redis.exceptions import WatchError

from .session_models import SessionData

logger = logging.getLogger(__name__)


class SessionStore:
    """Dumb Redis persistence layer for sessions."""

    def __init__(self, redis_client: redis.Redis):
        """Initialize with Redis client."""
        self.redis = redis_client
        self.key_prefix = "sess:"

    def _serialize(self, obj: Any) -> str:
        """Serialize object to JSON."""
        if isinstance(obj, SessionData):
            obj = obj.model_dump()
        return json.dumps(obj, default=str)

    def _deserialize(self, data: str) -> Dict[str, Any]:
        """Deserialize JSON to dict."""
        return json.loads(data)

    def get(self, session_id: str) -> Optional[SessionData]:
        """Get session by ID."""
        try:
            data = cast(Optional[str], self.redis.get(f"{self.key_prefix}{session_id}"))
            if not data:
                return None
            session_dict = self._deserialize(data)
            return SessionData(**session_dict)
        except Exception as e:
            logger.error(f"Error getting session {session_id}: {e}")
            return None

    def set(self, session_id: str, session: SessionData, ttl_seconds: int = 3600) -> bool:
        """Store session with TTL."""
        try:
            data = self._serialize(session)
            self.redis.setex(f"{self.key_prefix}{session_id}", ttl_seconds, data)
            return True
        except Exception as e:
            logger.error(f"Error setting session {session_id}: {e}")
            return False

    def touch(self, session_id: str, ttl_seconds: int = 3600) -> bool:
        """Refresh session TTL."""
        try:
            return bool(self.redis.expire(f"{self.key_prefix}{session_id}", ttl_seconds))
        except Exception as e:
            logger.error(f"Error touching session {session_id}: {e}")
            return False

    def delete(self, session_id: str) -> bool:
        """Delete session."""
        try:
            return bool(self.redis.delete(f"{self.key_prefix}{session_id}"))
        except Exception as e:
            logger.error(f"Error deleting session {session_id}: {e}")
            return False

    def exists(self, session_id: str) -> bool:
        """Check if session exists."""
        try:
            return bool(self.redis.exists(f"{self.key_prefix}{session_id}"))
        except Exception as e:
            logger.error(f"Error checking session {session_id}: {e}")
            return False

    def ttl(self, session_id: str) -> Optional[int]:
        """Get TTL in seconds, or None if not exists."""
        try:
            ttl = cast(int, self.redis.ttl(f"{self.key_prefix}{session_id}"))
            if ttl == -1:
                return None  # Key exists with no TTL
            if ttl == -2:
                return None  # Key doesn't exist
            return ttl
        except Exception as e:
            logger.error(f"Error getting TTL for session {session_id}: {e}")
            return None

    def atomic_update(
        self, session_id: str, update_func: Callable[[SessionData], SessionData], max_retries: int = 3
    ) -> Optional[SessionData]:
        """
        Atomically update session using WATCH/MULTI/EXEC.
        
        Args:
            session_id: Session ID to update
            update_func: Function that takes SessionData and returns updated SessionData
            max_retries: Max retries on WatchError
        
        Returns:
            Updated SessionData on success, None on failure
        """
        for attempt in range(max_retries):
            try:
                # WATCH the session key
                key = f"{self.key_prefix}{session_id}"
                pipe = self.redis.pipeline()
                pipe.watch(key)

                # Load current value
                data = cast(Optional[str], pipe.get(key))
                if data:
                    session = SessionData(**self._deserialize(data))
                else:
                    # Key was deleted
                    pipe.unwatch()
                    return None

                # Apply update function
                updated_session = update_func(session)

                # Execute atomic transaction
                pipe.multi()
                pipe.setex(key, 3600, self._serialize(updated_session))
                pipe.execute()

                return updated_session

            except WatchError:
                # Key changed, retry
                if attempt < max_retries - 1:
                    continue
                else:
                    logger.error(f"Failed to update session {session_id} after {max_retries} retries")
                    return None
            except Exception as e:
                logger.error(f"Error in atomic_update for session {session_id}: {e}")
                return None

        return None
