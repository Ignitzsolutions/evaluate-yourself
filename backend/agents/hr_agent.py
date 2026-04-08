"""Behavioral/intro agent used by the interview orchestrator."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

try:
    from services.interview.adaptive_engine import choose_opening_question, decide_next_turn
except Exception:  # pragma: no cover
    from backend.services.interview.adaptive_engine import choose_opening_question, decide_next_turn


def plan_hr_turn(
    *,
    interview_type: str,
    difficulty: str,
    role: Optional[str],
    company: Optional[str],
    question_mix: str,
    interview_style: str,
    duration_minutes: int,
    asked_question_ids: List[str],
    selected_skills: Optional[List[str]] = None,
    recent_transcript: Optional[List[Dict[str, Any]]] = None,
    last_user_turn: str = "",
    db: Any = None,
) -> Dict[str, Any]:
    if not recent_transcript and not last_user_turn:
        opening = choose_opening_question(
            interview_type=interview_type,
            difficulty=difficulty,
            role=role,
            question_mix=question_mix,
            selected_skills=selected_skills,
            db=db,
        )
        return {
            "agent_owner": "hr_behavioral_agent",
            "speaker_strategy": "opening_intro",
            "filler_hint": "acknowledgment",
            "next_question": opening.get("next_question"),
            "question_id": opening.get("question_id"),
            "policy_action": opening.get("policy_action", "NONE"),
            "refusal_message": opening.get("refusal_message"),
            "recoverable_error": None,
        }

    decision = decide_next_turn(
        last_user_turn=last_user_turn,
        recent_transcript=recent_transcript or [],
        interview_type=interview_type,
        difficulty=difficulty,
        role=role,
        company=company,
        question_mix=question_mix,
        interview_style=interview_style,
        duration_minutes=duration_minutes,
        asked_question_ids=asked_question_ids,
        selected_skills=selected_skills,
        db=db,
    )
    decision["agent_owner"] = "hr_behavioral_agent"
    decision["speaker_strategy"] = "behavioral_probe" if decision.get("followup_type") != "recovery" else "recovery_pivot"
    decision["filler_hint"] = "thinking" if decision.get("followup_type") != "recovery" else "pivot"
    decision["recoverable_error"] = decision.get("recoverable_error")
    return decision

