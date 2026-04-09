"""Facade for Sprint 1 interview planning and bootstrap context."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

try:
    from backend.agents.orchestrator import ConversationOrchestrator
except Exception:  # pragma: no cover
    from agents.orchestrator import ConversationOrchestrator  # type: ignore


_ORCHESTRATOR = ConversationOrchestrator()


def build_bootstrap_conversation_plan(
    *,
    session_id: str,
    interview_type: str,
    difficulty: str,
    role: Optional[str],
    company: Optional[str],
    question_mix: str,
    interview_style: str,
    selected_skills: Optional[List[str]],
    duration_minutes: int,
    asked_question_ids: Optional[List[str]] = None,
    recent_transcript: Optional[List[Dict[str, Any]]] = None,
    resume_token: Optional[str] = None,
    phase: str = "intro",
    round_index: int = 0,
    db: Any = None,
) -> Dict[str, Any]:
    return _ORCHESTRATOR.build_bootstrap_context(
        session_id=session_id,
        interview_type=interview_type,
        difficulty=difficulty,
        role=role,
        company=company,
        question_mix=question_mix,
        interview_style=interview_style,
        selected_skills=selected_skills,
        duration_minutes=duration_minutes,
        asked_question_ids=asked_question_ids,
        recent_transcript=recent_transcript,
        resume_token=resume_token,
        phase=phase,
        round_index=round_index,
        db=db,
    )


def plan_next_turn(
    *,
    session_id: str,
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
    phase: str = "active",
    round_index: int = 0,
    resume_token: Optional[str] = None,
    db: Any = None,
) -> Dict[str, Any]:
    return _ORCHESTRATOR.plan_next_turn(
        session_id=session_id,
        interview_type=interview_type,
        difficulty=difficulty,
        role=role,
        company=company,
        question_mix=question_mix,
        interview_style=interview_style,
        duration_minutes=duration_minutes,
        asked_question_ids=asked_question_ids,
        selected_skills=selected_skills,
        recent_transcript=recent_transcript,
        last_user_turn=last_user_turn,
        phase=phase,
        round_index=round_index,
        resume_token=resume_token,
        db=db,
    )

