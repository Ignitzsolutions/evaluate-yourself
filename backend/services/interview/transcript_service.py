"""Transcript storage and retrieval service."""

import logging
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class TranscriptService:
    """Persist and retrieve interview transcripts from database."""

    def __init__(self, db_session=None):
        """Initialize with database session."""
        self.db = db_session
        self._storage = {}  # In-memory store for now

    def store_transcript(self, session_id: str, candidate_id: str, transcript_text: str) -> str:
        """Store transcript and return ID."""
        try:
            transcript_id = f"tr_{session_id[:8]}_{len(self._storage)}"
            self._storage[transcript_id] = {
                "session_id": session_id,
                "candidate_id": candidate_id,
                "content": transcript_text,
                "created_at": str(datetime.now(timezone.utc))
            }
            logger.info(f"Stored transcript {transcript_id} for session {session_id}")
            return transcript_id
        except Exception as e:
            logger.error(f"Error storing transcript: {e}")
            raise

    def get_transcript(self, transcript_id: str) -> Optional[str]:
        """Get transcript content by ID."""
        try:
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
            return [tid for tid, rec in self._storage.items() if rec.get("session_id") == session_id]
        except Exception as e:
            logger.error(f"Error getting transcripts for session {session_id}: {e}")
            return []

    def delete_transcript(self, transcript_id: str) -> bool:
        """Delete transcript."""
        try:
            if transcript_id in self._storage:
                del self._storage[transcript_id]
                logger.info(f"Deleted transcript {transcript_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting transcript {transcript_id}: {e}")
            return False
