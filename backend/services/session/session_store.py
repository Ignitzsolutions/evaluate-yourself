"""Redis session store with atomic WATCH/MULTI/EXEC operations."""

import json
import logging
from typing import Optional, Any, Dict, Callable
from datetime import datetime, timedelta
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
            data = self.redis.get(f"{self.key_prefix}{session_id}")
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
            ttl = self.redis.ttl(f"{self.key_prefix}{session_id}")
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
                data = pipe.get(key)
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

    # Lock management methods
    def acquire_lock(self, lock_key: str, ttl_seconds: int = 300) -> bool:
        """
        Acquire a distributed lock using SET NX EX atomic operation.
        
        Args:
            lock_key: Lock identifier (e.g., 'feedback_lock:session_123')
            ttl_seconds: Lock TTL in seconds (default 5 minutes)
        
        Returns:
            True if lock acquired, False if already held
        """
        try:
            # SET key value NX EX seconds - atomic operation
            result = self.redis.set(lock_key, "1", nx=True, ex=ttl_seconds)
            return bool(result)
        except Exception as e:
            logger.error(f"Error acquiring lock {lock_key}: {e}")
            return False

    def release_lock(self, lock_key: str) -> bool:
        """
        Release a distributed lock.
        
        Args:
            lock_key: Lock identifier
        
        Returns:
            True if lock was released, False otherwise
        """
        try:
            return bool(self.redis.delete(lock_key))
        except Exception as e:
            logger.error(f"Error releasing lock {lock_key}: {e}")
            return False

    def check_lock(self, lock_key: str) -> bool:
        """
        Check if a lock exists.
        
        Args:
            lock_key: Lock identifier
        
        Returns:
            True if lock exists, False otherwise
        """
        try:
            return bool(self.redis.exists(lock_key))
        except Exception as e:
            logger.error(f"Error checking lock {lock_key}: {e}")
            return False

    # Event streaming methods using Redis Streams
    def emit_event(self, session_id: str, event_type: str, payload: Dict[str, Any]) -> Optional[str]:
        """
        Emit an event to Redis Stream for a session.
        
        Args:
            session_id: Session ID
            event_type: Event type (e.g., 'FEEDBACK_GENERATED', 'INTERVIEW_ENDED')
            payload: Event payload dictionary
        
        Returns:
            Event ID from Redis Stream, or None on failure
        """
        try:
            stream_key = f"events:{session_id}"
            event_data = {
                "type": event_type,
                "timestamp": datetime.now().isoformat(),
                "payload": json.dumps(payload, default=str)
            }
            # XADD returns the event ID (e.g., '1234567890123-0')
            event_id = self.redis.xadd(stream_key, event_data)
            return event_id.decode() if isinstance(event_id, bytes) else event_id
        except Exception as e:
            logger.error(f"Error emitting event {event_type} for session {session_id}: {e}")
            return None

    def replay_events(self, session_id: str, start_id: str = "0", count: int = 100) -> List[Dict[str, Any]]:
        """
        Replay events from Redis Stream for a session.
        
        Args:
            session_id: Session ID
            start_id: Starting event ID (default '0' for beginning)
            count: Max number of events to retrieve
        
        Returns:
            List of events with id, type, timestamp, and payload
        """
        try:
            stream_key = f"events:{session_id}"
            # XRANGE returns [(event_id, {field: value})]
            events = self.redis.xrange(stream_key, min=start_id, max="+", count=count)
            
            result = []
            for event_id, event_data in events:
                event_id_str = event_id.decode() if isinstance(event_id, bytes) else event_id
                event_type = event_data.get(b"type", b"").decode() if isinstance(event_data.get(b"type"), bytes) else event_data.get("type", "")
                timestamp = event_data.get(b"timestamp", b"").decode() if isinstance(event_data.get(b"timestamp"), bytes) else event_data.get("timestamp", "")
                payload_str = event_data.get(b"payload", b"{}").decode() if isinstance(event_data.get(b"payload"), bytes) else event_data.get("payload", "{}")
                
                try:
                    payload = json.loads(payload_str)
                except json.JSONDecodeError:
                    payload = {}
                
                result.append({
                    "id": event_id_str,
                    "type": event_type,
                    "timestamp": timestamp,
                    "payload": payload
                })
            
            return result
        except Exception as e:
            logger.error(f"Error replaying events for session {session_id}: {e}")
            return []

    def get_latest_events(self, session_id: str, after_id: Optional[str] = None, block_ms: int = 0) -> List[Dict[str, Any]]:
        """
        Get latest events from Redis Stream, optionally blocking for new events.
        
        Args:
            session_id: Session ID
            after_id: Only return events after this ID (default None for all new)
            block_ms: Block for this many milliseconds waiting for new events (0 = no block)
        
        Returns:
            List of events with id, type, timestamp, and payload
        """
        try:
            stream_key = f"events:{session_id}"
            start_id = after_id if after_id else "$"  # '$' means only new events
            
            if block_ms > 0:
                # XREAD BLOCK for live streaming
                streams = {stream_key: start_id}
                results = self.redis.xread(streams, count=10, block=block_ms)
                if not results:
                    return []
                
                # results = [(stream_key, [(event_id, event_data)])]
                events = results[0][1] if results else []
            else:
                # Non-blocking read
                events = self.redis.xrange(stream_key, min=start_id, max="+", count=10)
            
            result = []
            for event_id, event_data in events:
                event_id_str = event_id.decode() if isinstance(event_id, bytes) else event_id
                event_type = event_data.get(b"type", b"").decode() if isinstance(event_data.get(b"type"), bytes) else event_data.get("type", "")
                timestamp = event_data.get(b"timestamp", b"").decode() if isinstance(event_data.get(b"timestamp"), bytes) else event_data.get("timestamp", "")
                payload_str = event_data.get(b"payload", b"{}").decode() if isinstance(event_data.get(b"payload"), bytes) else event_data.get("payload", "{}")
                
                try:
                    payload = json.loads(payload_str)
                except json.JSONDecodeError:
                    payload = {}
                
                result.append({
                    "id": event_id_str,
                    "type": event_type,
                    "timestamp": timestamp,
                    "payload": payload
                })
            
            return result
        except Exception as e:
            logger.error(f"Error getting latest events for session {session_id}: {e}")
            return []
