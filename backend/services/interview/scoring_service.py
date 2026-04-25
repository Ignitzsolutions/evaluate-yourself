"""Interview scoring service — computes and persists scorecards from transcripts."""

import logging
import re
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Scoring weights per competency (must sum to 1.0)
_COMPETENCY_WEIGHTS = {
    "communication": 0.25,
    "clarity": 0.20,
    "technical": 0.25,
    "problem_solving": 0.20,
    "confidence": 0.10,
}

# Keywords that signal strong performance per competency
_POSITIVE_KEYWORDS: Dict[str, List[str]] = {
    "communication": ["explained", "communicated", "collaborated", "discussed", "presented", "articulated", "clearly"],
    "clarity": ["specifically", "concretely", "example", "instance", "precisely", "defined", "structured"],
    "technical": ["implemented", "designed", "architecture", "algorithm", "optimized", "scalable", "deployed", "framework", "api", "database"],
    "problem_solving": ["identified", "analyzed", "solution", "approach", "debugged", "resolved", "hypothesis", "tested", "iterated"],
    "confidence": ["decided", "led", "initiated", "proposed", "recommended", "owned", "drove", "delivered"],
}

_NEGATIVE_KEYWORDS: List[str] = ["um", "uh", "like", "you know", "basically", "sort of", "kind of"]


def _count_words(text: str) -> int:
    return len(re.findall(r'\b\w+\b', text.lower())) if text else 0


def _keyword_score(text: str, keywords: List[str]) -> float:
    """Returns fraction of keywords found in the text (0.0–1.0)."""
    if not text or not keywords:
        return 0.0
    lower = text.lower()
    hits = sum(1 for kw in keywords if kw in lower)
    return min(1.0, hits / max(1, len(keywords) * 0.4))  # 40% hit rate → full score


def _fluency_penalty(text: str) -> float:
    """Returns a penalty (0.0–0.2) based on filler word density."""
    words = _count_words(text)
    if words < 10:
        return 0.0
    filler_count = sum(text.lower().count(f) for f in _NEGATIVE_KEYWORDS)
    filler_rate = filler_count / max(1, words)
    return min(0.2, filler_rate * 2)


def _compute_scores_from_transcript(candidate_turns: List[str]) -> Dict[str, int]:
    """
    Compute competency scores (0–100) from candidate transcript turns.

    Scoring methodology:
    - Base score: 55 (calibrated to represent a mediocre-but-passing response)
    - Word count bonus: up to +15 points (longer answers signal engagement)
    - Keyword coverage: up to +25 points per competency
    - Fluency penalty: up to -10 points for filler word density
    """
    full_text = " ".join(candidate_turns)
    word_count = _count_words(full_text)

    if word_count < 20:
        # Insufficient response — score below average
        return {k: 45 for k in _COMPETENCY_WEIGHTS}

    # Word count bonus (plateaus at ~300 words)
    word_bonus = min(15, int(word_count / 20))

    # Fluency penalty
    penalty = int(_fluency_penalty(full_text) * 50)

    scores: Dict[str, int] = {}
    for competency, keywords in _POSITIVE_KEYWORDS.items():
        kw_score = _keyword_score(full_text, keywords)
        raw = 55 + word_bonus + int(kw_score * 25) - penalty
        scores[competency] = max(30, min(99, raw))

    return scores


def _weighted_overall(scores: Dict[str, int]) -> int:
    total = sum(
        scores.get(comp, 65) * weight
        for comp, weight in _COMPETENCY_WEIGHTS.items()
    )
    return max(30, min(99, int(total)))


class ScoringService:
    """Compute and persist interview scorecards."""

    def __init__(self, db_session=None):
        self.db = db_session

    def score_interview(
        self,
        session_id: str,
        candidate_id: str,
        transcript_turns: Optional[List[Dict[str, Any]]] = None,
        interview_type: str = "mixed",
        duration_minutes: int = 0,
    ) -> Dict[str, Any]:
        """
        Score an interview session and persist the result.

        Args:
            session_id: Interview session identifier.
            candidate_id: Clerk user ID of the candidate.
            transcript_turns: List of {"role": "user"|"assistant", "content": str} dicts.
            interview_type: Type of interview (behavioral, technical, mixed).
            duration_minutes: Duration of the interview in minutes.

        Returns:
            Dict with competency scores, overall score, and grade.
        """
        # Extract candidate speech turns only
        candidate_turns: List[str] = []
        if transcript_turns:
            for turn in transcript_turns:
                if isinstance(turn, dict) and turn.get("role") in ("user", "candidate"):
                    content = turn.get("content") or turn.get("text") or ""
                    if content:
                        candidate_turns.append(str(content))

        scores = _compute_scores_from_transcript(candidate_turns)
        overall = _weighted_overall(scores)

        grade = (
            "A" if overall >= 85 else
            "B" if overall >= 75 else
            "C" if overall >= 65 else
            "D" if overall >= 55 else
            "F"
        )

        scorecard: Dict[str, Any] = {
            "session_id": session_id,
            "candidate_id": candidate_id,
            "interview_type": interview_type,
            "duration_minutes": duration_minutes,
            "scores": scores,
            "overall_score": overall,
            "grade": grade,
            "word_count": sum(_count_words(t) for t in candidate_turns),
            "turn_count": len(candidate_turns),
        }

        self._persist(scorecard)
        return scorecard

    def _persist(self, scorecard: Dict[str, Any]) -> None:
        """Persist scorecard to DB if session available, else log warning."""
        if not self.db:
            logger.warning(
                "ScoringService: no DB session — scorecard for session %s not persisted",
                scorecard.get("session_id"),
            )
            return

        try:
            session_id = scorecard["session_id"]
            # Try to update existing InterviewReport row if present
            try:
                from db import models
                report = (
                    self.db.query(models.InterviewReport)
                    .filter(models.InterviewReport.session_id == session_id)
                    .first()
                )
                if report:
                    import json
                    report.score_breakdown = json.dumps(scorecard.get("scores", {}))
                    report.overall_score = scorecard.get("overall_score")
                    self.db.commit()
                    logger.info("Persisted scorecard for session %s (overall=%s)", session_id, scorecard.get("overall_score"))
                    return
            except Exception as inner_e:
                logger.warning("Could not persist scorecard to InterviewReport: %s", inner_e)
                self.db.rollback()
        except Exception as e:
            logger.error("Unexpected error persisting scorecard: %s", e)

    def get_scorecard(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve scorecard from DB."""
        if not self.db:
            return None
        try:
            from db import models
            import json
            report = (
                self.db.query(models.InterviewReport)
                .filter(models.InterviewReport.session_id == session_id)
                .first()
            )
            if report and report.score_breakdown:
                return {
                    "session_id": session_id,
                    "scores": json.loads(report.score_breakdown),
                    "overall_score": report.overall_score,
                }
        except Exception as e:
            logger.error("Error retrieving scorecard: %s", e)
        return None
