"""Competency framework for interview evaluation.

Defines 6 core competencies and maps question topic_tags and IDs to them.
Used by report_generator, hiring_signal, and adaptive_engine to produce
per-competency scores in reports.
"""

from __future__ import annotations

from typing import Dict, List, Optional

# ─── Core competencies ───────────────────────────────────────────────────────

COMPETENCIES: Dict[str, str] = {
    "communication": "Clear, confident, and structured verbal delivery",
    "problem_solving": "Analytical thinking, trade-off reasoning, and creative solutions",
    "technical_depth": "Domain knowledge, implementation detail, and engineering rigor",
    "ownership": "Initiative, accountability, and follow-through on commitments",
    "collaboration": "Teamwork, stakeholder management, and cross-functional impact",
    "adaptability": "Handling change, ambiguity, feedback, and learning under pressure",
}

COMPETENCY_KEYS: List[str] = list(COMPETENCIES.keys())

# ─── Tag → Competency mapping ─────────────────────────────────────────────────

_TAG_TO_COMPETENCY: Dict[str, str] = {
    # communication
    "communication": "communication",
    "presentation": "communication",
    "clarity": "communication",
    "writing": "communication",
    "stakeholder": "communication",
    "intro": "communication",
    # problem_solving
    "problem-solving": "problem_solving",
    "debugging": "problem_solving",
    "architecture": "problem_solving",
    "design": "problem_solving",
    "system-design": "problem_solving",
    "tradeoffs": "problem_solving",
    "decision-making": "problem_solving",
    "ambiguity": "problem_solving",
    # technical_depth
    "technical": "technical_depth",
    "coding": "technical_depth",
    "algorithms": "technical_depth",
    "data-structures": "technical_depth",
    "databases": "technical_depth",
    "cloud": "technical_depth",
    "infrastructure": "technical_depth",
    "security": "technical_depth",
    "performance": "technical_depth",
    "python": "technical_depth",
    "java": "technical_depth",
    "javascript": "technical_depth",
    "ml": "technical_depth",
    "data-science": "technical_depth",
    "devops": "technical_depth",
    # ownership
    "ownership": "ownership",
    "initiative": "ownership",
    "accountability": "ownership",
    "project": "ownership",
    "delivery": "ownership",
    "impact": "ownership",
    "goal-setting": "ownership",
    "time-management": "ownership",
    # collaboration
    "teamwork": "collaboration",
    "conflict": "collaboration",
    "cross-functional": "collaboration",
    "mentoring": "collaboration",
    "feedback": "collaboration",
    "influence": "collaboration",
    "leadership": "collaboration",
    # adaptability
    "adaptability": "adaptability",
    "learning": "adaptability",
    "growth": "adaptability",
    "change": "adaptability",
    "failure": "adaptability",
    "resilience": "adaptability",
    "pressure": "adaptability",
}

# ─── Explicit per-question overrides (for questions whose tags don't map cleanly) ──

_QUESTION_ID_OVERRIDES: Dict[str, str] = {
    "bh_j_001": "communication",       # Tell me about yourself
    "bh_j_004": "collaboration",        # Helped a teammate
    "bh_j_007": "adaptability",         # Received feedback
    "bh_j_008": "adaptability",         # Requirements changed
    "bh_m_003": "ownership",            # Project ownership
    "bh_m_005": "collaboration",        # Disagreement with manager
    "bh_m_007": "problem_solving",      # Ambiguous requirement
    "bh_s_001": "ownership",            # Led large initiative
    "bh_s_003": "communication",        # Influenced without authority
    "te_j_001": "technical_depth",      # Explain OOP
    "te_m_001": "technical_depth",      # System design intro
    "te_s_001": "technical_depth",      # Senior architecture
}


def get_competency_for_question(
    question_id: Optional[str] = None,
    topic_tags: Optional[List[str]] = None,
    domain: Optional[str] = None,
    interview_type: Optional[str] = None,
) -> str:
    """Return the primary competency for a given question.

    Resolution order:
    1. Explicit question ID override
    2. First matching topic_tag
    3. Domain fallback (technical → technical_depth, behavioral → ownership)
    4. Default: problem_solving
    """
    if question_id and question_id in _QUESTION_ID_OVERRIDES:
        return _QUESTION_ID_OVERRIDES[question_id]

    if topic_tags:
        for tag in topic_tags:
            mapped = _TAG_TO_COMPETENCY.get(tag.lower())
            if mapped:
                return mapped

    if domain:
        domain_lower = domain.lower()
        if "technical" in domain_lower:
            return "technical_depth"
        if "behavioral" in domain_lower:
            return "ownership"

    if interview_type:
        if "technical" in (interview_type or "").lower():
            return "technical_depth"

    return "problem_solving"


def competency_weights_for_type(interview_type: str) -> Dict[str, float]:
    """Return scoring weights per competency based on interview type."""
    if interview_type == "technical":
        return {
            "communication": 0.10,
            "problem_solving": 0.20,
            "technical_depth": 0.40,
            "ownership": 0.10,
            "collaboration": 0.10,
            "adaptability": 0.10,
        }
    if interview_type == "behavioral":
        return {
            "communication": 0.20,
            "problem_solving": 0.15,
            "technical_depth": 0.05,
            "ownership": 0.25,
            "collaboration": 0.20,
            "adaptability": 0.15,
        }
    # mixed
    return {
        "communication": 0.15,
        "problem_solving": 0.20,
        "technical_depth": 0.20,
        "ownership": 0.20,
        "collaboration": 0.15,
        "adaptability": 0.10,
    }


def aggregate_competency_scores(
    turn_analyses: List[Dict],
) -> Dict[str, int]:
    """Aggregate per-turn competency scores into overall per-competency scores.

    Args:
        turn_analyses: list of dicts, each with 'competency' and 'score_0_100'

    Returns:
        dict mapping each competency to 0-100 score (missing ones get 0)
    """
    buckets: Dict[str, List[int]] = {k: [] for k in COMPETENCY_KEYS}
    for t in turn_analyses:
        comp = t.get("competency")
        score = t.get("score_0_100")
        if comp in buckets and isinstance(score, (int, float)):
            buckets[comp].append(int(score))
    return {
        comp: (int(round(sum(vals) / len(vals))) if vals else 0)
        for comp, vals in buckets.items()
    }
