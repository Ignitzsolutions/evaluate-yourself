"""Deterministic interview setup planning from profile and JD signals."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

try:
    from data.interview_questions import get_questions_by_type_and_difficulty
except Exception:  # pragma: no cover
    from backend.data.interview_questions import get_questions_by_type_and_difficulty

try:
    from services.interview.adaptive_engine import normalize_difficulty
    from services.interview.jd_parser import filter_questions_by_jd, parse_jd
    from services.interview.skill_tracks import normalize_track_ids
except Exception:  # pragma: no cover
    from backend.services.interview.adaptive_engine import normalize_difficulty
    from backend.services.interview.jd_parser import filter_questions_by_jd, parse_jd
    from backend.services.interview.skill_tracks import normalize_track_ids


def _clean_text(value: Optional[str], *, max_length: int = 4000) -> Optional[str]:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text:
        return None
    return text[:max_length]


def _normalize_seniority(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    if raw in {"intern", "internship", "entry", "entry-level", "graduate", "junior", "jr"}:
        return "junior"
    if raw in {"mid", "middle", "intermediate", "experienced"}:
        return "mid"
    if raw in {"senior", "sr", "lead", "staff", "principal", "architect", "manager"}:
        return "senior"
    return None


def resolve_default_difficulty(
    *,
    target_role: Optional[str] = None,
    seniority: Optional[str] = None,
    years_experience: Optional[float] = None,
    jd_signals: Optional[Dict[str, Any]] = None,
    requested_difficulty: Optional[str] = None,
) -> str:
    """Map setup signals to the bank difficulty levels: junior, mid, senior."""

    explicit = str(requested_difficulty or "").strip().lower()
    if explicit and explicit != "auto":
        return normalize_difficulty(explicit)

    jd_seniority = _normalize_seniority((jd_signals or {}).get("seniority"))
    if jd_seniority:
        return jd_seniority

    normalized = _normalize_seniority(seniority)
    if normalized:
        return normalized

    role = str(target_role or "").lower()
    if any(token in role for token in ("principal", "staff", "lead", "architect", "manager")):
        return "senior"
    if any(token in role for token in ("intern", "graduate", "entry", "junior", "associate")):
        return "junior"

    if years_experience is not None:
        try:
            years = float(years_experience)
        except (TypeError, ValueError):
            years = None
        if years is not None:
            if years <= 2:
                return "junior"
            if years >= 6:
                return "senior"

    return "mid"


def build_jd_question_plan(
    *,
    target_jd: Optional[str],
    target_role: Optional[str] = None,
    seniority: Optional[str] = None,
    years_experience: Optional[float] = None,
    interview_type: Optional[str] = "mixed",
    requested_difficulty: Optional[str] = None,
    selected_skills: Optional[List[str]] = None,
    question_count: int = 6,
) -> Dict[str, Any]:
    """Create a deterministic, previewable question plan from a pasted JD."""

    jd_text = _clean_text(target_jd)
    jd_signals = parse_jd(jd_text, use_llm=False) if jd_text else None
    difficulty = resolve_default_difficulty(
        target_role=target_role,
        seniority=seniority,
        years_experience=years_experience,
        jd_signals=jd_signals,
        requested_difficulty=requested_difficulty,
    )

    normalized_type = str(interview_type or "mixed").strip().lower()
    if normalized_type not in {"behavioral", "technical", "mixed"}:
        normalized_type = "mixed"

    question_types = (
        ["technical", "behavioral"]
        if normalized_type == "mixed"
        else [normalized_type]
    )
    questions: List[Dict[str, Any]] = []
    for qtype in question_types:
        questions.extend(get_questions_by_type_and_difficulty(qtype, difficulty))
    questions = filter_questions_by_jd(questions, jd_signals)

    seen: set[str] = set()
    planned_questions: List[Dict[str, Any]] = []
    for question in questions:
        question_id = str(question.get("id") or "")
        if not question_id or question_id in seen:
            continue
        seen.add(question_id)
        planned_questions.append(
            {
                "id": question_id,
                "text": str(question.get("text") or ""),
                "difficulty": str(question.get("difficulty") or difficulty),
                "domain": str(question.get("domain") or ""),
                "topic_tags": [str(tag) for tag in (question.get("topic_tags") or [])],
            }
        )
        if len(planned_questions) >= max(1, min(int(question_count or 6), 10)):
            break

    tracks = normalize_track_ids(selected_skills)
    suggested_tracks = [
        str(track)
        for track in ((jd_signals or {}).get("skill_tracks") or [])
        if str(track or "").strip()
    ][:3]

    return {
        "target_role": _clean_text(target_role, max_length=120),
        "difficulty": difficulty,
        "interview_type": normalized_type,
        "jd_signals": jd_signals or {},
        "selected_skills": tracks,
        "suggested_skill_tracks": suggested_tracks,
        "questions": planned_questions,
        "source": "deterministic_jd_planner" if jd_text else "deterministic_defaults",
    }
