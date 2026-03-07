"""Redis-backed store for InterviewState."""

import json
import logging
import os
from typing import Optional
import redis

from services.interview_state import InterviewState

logger = logging.getLogger(__name__)


class InterviewStateStore:
    def __init__(self, redis_client: redis.Redis, ttl_seconds: Optional[int] = None):
        self.redis = redis_client
        self.key_prefix = "interview_state:"
        self.ttl_seconds = ttl_seconds or int(os.getenv("INTERVIEW_STATE_TTL_SECONDS", "86400"))

    def _key(self, session_id: str) -> str:
        return f"{self.key_prefix}{session_id}"

    def get(self, session_id: str) -> Optional[InterviewState]:
        try:
            raw = self.redis.get(self._key(session_id))
            if not raw:
                return None
            data = json.loads(raw)
            return InterviewState.from_dict(data)
        except Exception as e:
            logger.error("Error loading interview state %s: %s", session_id, e)
            return None

    def set(self, state: InterviewState) -> bool:
        try:
            payload = json.dumps(state.to_dict(), default=str)
            self.redis.setex(self._key(state.session_id), self.ttl_seconds, payload)
            return True
        except Exception as e:
            logger.error("Error saving interview state %s: %s", state.session_id, e)
            return False

    def delete(self, session_id: str) -> bool:
        try:
            return bool(self.redis.delete(self._key(session_id)))
        except Exception as e:
            logger.error("Error deleting interview state %s: %s", session_id, e)
            return False
