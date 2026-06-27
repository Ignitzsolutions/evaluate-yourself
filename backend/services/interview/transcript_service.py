"""Transcript storage and retrieval service."""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List

logger = logging.getLogger(__name__)


class TranscriptService:
    """Persist and retrieve interview transcripts from database."""

    def __init__(self, db_session=None):
        """Initialize with database session."""
        self.db = db_session
        self._storage = {}  # In-memory fallback when Redis is unavailable
        self._redis = None
        try:
            from db.redis_client import get_redis_client
            self._redis = get_redis_client()
        except Exception as exc:  # noqa: BLE001
            logger.warning("TranscriptService using in-memory fallback (Redis unavailable): %s", exc)

    @staticmethod
    def _transcript_key(transcript_id: str) -> str:
        return f"transcript:{transcript_id}"

    @staticmethod
    def _session_index_key(session_id: str) -> str:
        return f"session_transcripts:{session_id}"

    def store_transcript(self, session_id: str, candidate_id: str, transcript_text: str) -> str:
        """Store transcript and return ID."""
        try:
            transcript_id = f"tr_{session_id[:8]}_{uuid.uuid4().hex[:12]}"
            payload = {
                "session_id": session_id,
                "candidate_id": candidate_id,
                "content": transcript_text,
                "created_at": str(datetime.now(timezone.utc))
            }
            if self._redis is not None:
                self._redis.setex(self._transcript_key(transcript_id), 7776000, json.dumps(payload))
                self._redis.sadd(self._session_index_key(session_id), transcript_id)
                self._redis.expire(self._session_index_key(session_id), 7776000)
            self._storage[transcript_id] = payload
            logger.info(f"Stored transcript {transcript_id} for session {session_id}")
            return transcript_id
        except Exception as e:
            logger.error(f"Error storing transcript: {e}")
            raise

    def get_transcript(self, transcript_id: str) -> Optional[str]:
        """Get transcript content by ID."""
        try:
            if self._redis is not None:
                cached = self._redis.get(self._transcript_key(transcript_id))
                if cached:
                    record = json.loads(cached)
                    return record.get("content")
            record = self._storage.get(transcript_id)
            if record:
                return record.get("content")
            return None
        except Exception as e:
            logger.error(f"Error getting transcript {transcript_id}: {e}")
            return None

    def get_transcript_summary(self, transcript_id: str, max_chars: int = 5000) -> Optional[str]:
        """Get transcript summary (first N chars)."""
        try:
            content = self.get_transcript(transcript_id)
            if content:
                return content[:max_chars]
            return None
        except Exception as e:
            logger.error(f"Error getting transcript summary: {e}")
            return None

    def get_session_transcripts(self, session_id: str) -> List[str]:
        """Get all transcript IDs for session."""
        try:
            if self._redis is not None:
                transcript_ids = self._redis.smembers(self._session_index_key(session_id))
                if transcript_ids:
                    return sorted(list(transcript_ids))
            return [tid for tid, rec in self._storage.items() if rec.get("session_id") == session_id]
        except Exception as e:
            logger.error(f"Error getting transcripts for session {session_id}: {e}")
            return []

    def delete_transcript(self, transcript_id: str) -> bool:
        """Delete transcript."""
        try:
            if self._redis is not None:
                raw = self._redis.get(self._transcript_key(transcript_id))
                if raw:
                    record = json.loads(raw)
                    session_id = record.get("session_id")
                    if session_id:
                        self._redis.srem(self._session_index_key(session_id), transcript_id)
                self._redis.delete(self._transcript_key(transcript_id))
            if transcript_id in self._storage:
                del self._storage[transcript_id]
                logger.info(f"Deleted transcript {transcript_id}")
                return True
            return self._redis is not None
        except Exception as e:
            logger.error(f"Error deleting transcript {transcript_id}: {e}")
            return False
