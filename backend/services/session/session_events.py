"""Session event logging with Redis Lists and Streams (dual support for migration)."""

import asyncio
import json
import logging
import uuid
from typing import List, Optional, Dict, Any, AsyncIterator
from datetime import datetime, timezone
import redis

logger = logging.getLogger(__name__)


class SessionEventLog:
    """Append-only event log with List (legacy) and Stream (new) support."""

    def __init__(self, redis_client: redis.Redis):
        """Initialize with Redis client."""
        self.redis = redis_client
        self.list_key_prefix = "events:"
        self.stream_key_prefix = "events_stream:"

    def append(self, session_id: str, event_type: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """Append event using both List (legacy) and Stream (new) for dual compatibility."""
        event_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        event = {
            "event_id": event_id,
            "session_id": session_id,
            "event_type": event_type,
            "timestamp": timestamp,
            "metadata": metadata or {}
        }
        
        event_json = json.dumps(event, default=str)
        
        try:
            # Legacy: append to List (LPUSH - newest at index 0)
            self.redis.lpush(f"{self.list_key_prefix}{session_id}", event_json)
            self.redis.expire(f"{self.list_key_prefix}{session_id}", 7776000)  # 90 days
            
            # New: append to Stream (XADD with auto ID)
            stream_key = f"{self.stream_key_prefix}{session_id}"
            stream_id = self.redis.xadd(stream_key, {"event": event_json})  # noqa: F841
            self.redis.expire(stream_key, 7776000)  # 90 days
            
            logger.debug(f"Appended event {event_id} to session {session_id}")
            return event_id
            
        except Exception as e:
            logger.error(f"Error appending event to session {session_id}: {e}")
            return event_id

    def get_events(self, session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get events from List (legacy), normalized to chronological order."""
        try:
            events_json = self.redis.lrange(f"{self.list_key_prefix}{session_id}", 0, limit - 1)
            parsed = [json.loads(e) for e in events_json]
            return list(reversed(parsed))
        except Exception as e:
            logger.error(f"Error getting events for session {session_id}: {e}")
            return []

    @staticmethod
    def _extract_event_json(event_data: Dict[Any, Any]) -> str:
        if not isinstance(event_data, dict):
            return "{}"
        raw = event_data.get("event")
        if raw is None:
            raw = event_data.get(b"event")
        if raw is None:
            return "{}"
        if isinstance(raw, bytes):
            return raw.decode()
        return str(raw)

    def get_events_after(self, session_id: str, after_event_id: str, limit: int = 200) -> List[Dict[str, Any]]:
        """Get events after given ID (using Stream for deterministic ordering)."""
        try:
            stream_key = f"{self.stream_key_prefix}{session_id}"
            
            if after_event_id == "0":
                # Return all events
                results = self.redis.xrange(stream_key, count=limit)
            else:
                # Find the stream ID for the given event_id, then query after it
                all_events = self.redis.xrange(stream_key, count=10000)
                found_idx = -1
                
                for idx, (stream_id, event_data) in enumerate(all_events):
                    event_json = self._extract_event_json(event_data)
                    event = json.loads(event_json)
                    if event.get("event_id") == after_event_id:
                        found_idx = idx
                        break
                
                if found_idx == -1:
                    # Event not found, return recent events
                    results = self.redis.xrange(stream_key, count=limit)
                else:
                    # Return events after found_idx
                    results = all_events[found_idx + 1 : found_idx + 1 + limit]
            
            events = []
            for stream_id, event_data in results:
                event_json = self._extract_event_json(event_data)
                events.append(json.loads(event_json))
            
            return events
            
        except Exception as e:
            logger.error(f"Error getting events after {after_event_id} for session {session_id}: {e}")
            return []

    def get_events_replay(self, session_id: str, after_event_id: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
        """Get events for replay (chunked, ordered)."""
        if after_event_id is None or after_event_id == "0":
            return self.get_events(session_id, limit)
        else:
            return self.get_events_after(session_id, after_event_id, limit)

    def get_event_by_id(self, session_id: str, event_id: str) -> Optional[Dict[str, Any]]:
        """Get single event by ID."""
        try:
            events = self.get_events(session_id, limit=10000)
            for event in events:
                if event.get("event_id") == event_id:
                    return event
            return None
        except Exception as e:
            logger.error(f"Error getting event {event_id} for session {session_id}: {e}")
            return None

    async def get_events_stream_subscription(self, session_id: str) -> AsyncIterator[Dict[str, Any]]:
        """Async iterator for live event subscription using XREAD BLOCKING."""
        stream_key = f"{self.stream_key_prefix}{session_id}"
        last_id = "$"  # Start from latest new messages
        
        try:
            while True:
                # XREAD with BLOCK (1000ms timeout)
                result = await asyncio.to_thread(
                    self.redis.xread,
                    {stream_key: last_id},
                    block=1000,
                    count=10,
                )
                
                if result:
                    for stream, messages in result:
                        for stream_id, event_data in messages:
                            event_json = self._extract_event_json(event_data)
                            event = json.loads(event_json)
                            last_id = stream_id
                            yield event
                else:
                    # Timeout, continue listening
                    continue
                    
        except Exception as e:
            logger.error(f"Error in stream subscription for session {session_id}: {e}")

    def replay_events(self, session_id: str) -> Dict[str, Any]:
        """Reconstruct session state from event log."""
        events = self.get_events(session_id, limit=10000)
        
        events_chrono = events
        
        state = {
            "stage": "CREATED",
            "transcript_status": "PENDING",
            "scoring_status": "PENDING",
            "feedback_status": "PENDING",
            "error_message": None,
            "transcript_ids": [],
            "scorecard_id": None,
            "feedback_id": None,
            "feedback_ids": [],
            "event_ids": []
        }
        
        for event in events_chrono:
            event_type = event.get("event_type")
            metadata = event.get("metadata", {})
            
            if event_type == "SESSION_CREATED":
                state["stage"] = "CREATED"
            elif event_type == "TRANSCRIPT_ATTACHED":
                state["stage"] = "TRANSCRIPT_ATTACHED"
                state["transcript_status"] = "ATTACHED"
                if "transcript_id" in metadata:
                    state["transcript_ids"].append(metadata["transcript_id"])
            elif event_type == "SCORING_STARTED":
                state["stage"] = "SCORING_STARTED"
                state["scoring_status"] = "STARTED"
            elif event_type == "SCORING_COMPLETED":
                state["stage"] = "SCORING_COMPLETED" if state.get("feedback_status") == "PENDING" else state["stage"]
                state["scoring_status"] = "COMPLETED"
                if "scorecard_id" in metadata:
                    state["scorecard_id"] = metadata["scorecard_id"]
            elif event_type == "FEEDBACK_STARTED":
                state["stage"] = "FEEDBACK_STARTED"
                state["feedback_status"] = "STARTED"
            elif event_type == "FEEDBACK_GENERATED":
                state["stage"] = "FEEDBACK_GENERATED"
                state["feedback_status"] = "COMPLETED"
                if "feedback_id" in metadata:
                    state["feedback_id"] = metadata["feedback_id"]
                    state["feedback_ids"].append(metadata["feedback_id"])
            elif event_type == "COMPLETED":
                state["stage"] = "COMPLETED"
            elif event_type == "ERROR":
                state["stage"] = "ERROR"
                state["error_message"] = metadata.get("error_message")
            
            state["event_ids"].append(event.get("event_id"))
        
        return state

    def get_event_count(self, session_id: str) -> int:
        """Get total event count."""
        try:
            return self.redis.llen(f"{self.list_key_prefix}{session_id}")
        except Exception as e:
            logger.error(f"Error getting event count for session {session_id}: {e}")
            return 0

    def clear_events(self, session_id: str) -> bool:
        """Clear all events for session."""
        try:
            self.redis.delete(f"{self.list_key_prefix}{session_id}")
            self.redis.delete(f"{self.stream_key_prefix}{session_id}")
            return True
        except Exception as e:
            logger.error(f"Error clearing events for session {session_id}: {e}")
            return False
