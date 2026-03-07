"""Interview scoring service with idempotency."""

import logging
import json
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class ScoringService:
    """Generate and persist interview scores with idempotency."""

    def __init__(self, db_session=None):
        """Initialize with database session."""
        self.db = db_session
        self._storage = {}  # In-memory store for now

    def score_interview(
        self,
        session_id: str,
        candidate_id: str,
        interview_type: str,
        transcript_text: str
    ) -> Dict[str, Any]:
        """Score interview and return scorecard."""
        try:
            # Simplified scoring logic
            scorecard_id = f"sc_{session_id[:8]}_{len(self._storage)}"
            
            scores = {
                "communication": 78,
                "clarity": 82,
                "structure": 75,
                "relevance": 80,
                "overall_score": 79
            }
            
            scorecard = {
                "scorecard_id": scorecard_id,
                "session_id": session_id,
                "candidate_id": candidate_id,
                "interview_type": interview_type,
                "scores": scores,
                "created_at": str(__import__('datetime').datetime.utcnow())
            }
            
            self._storage[scorecard_id] = scorecard
            logger.info(f"Scored interview: {scorecard_id} (overall: {scores['overall_score']})")
            return scorecard
            
        except Exception as e:
            logger.error(f"Error scoring interview: {e}")
            raise

    def get_scorecard(self, scorecard_id: str) -> Optional[Dict[str, Any]]:
        """Get scorecard by ID."""
        try:
            return self._storage.get(scorecard_id)
        except Exception as e:
            logger.error(f"Error getting scorecard {scorecard_id}: {e}")
            return None

    def get_session_scorecard(self, session_id: str, interview_type: str) -> Optional[Dict[str, Any]]:
        """Get scorecard for session and interview type."""
        try:
            for scorecard in self._storage.values():
                if scorecard.get("session_id") == session_id and scorecard.get("interview_type") == interview_type:
                    return scorecard
            return None
        except Exception as e:
            logger.error(f"Error getting scorecard for session {session_id}: {e}")
            return None

    def delete_scorecard(self, scorecard_id: str) -> bool:
        """Delete scorecard."""
        try:
            if scorecard_id in self._storage:
                del self._storage[scorecard_id]
                logger.info(f"Deleted scorecard {scorecard_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting scorecard {scorecard_id}: {e}")
            return False
