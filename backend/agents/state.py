"""Shared orchestration state for the interview planner."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class OrchestratorState:
    session_id: str
    interview_type: str = "mixed"
    difficulty: str = "mid"
    role: Optional[str] = None
    company: Optional[str] = None
    question_mix: str = "balanced"
    interview_style: str = "neutral"
    duration_minutes: int = 0
    asked_question_ids: List[str] = field(default_factory=list)
    selected_skills: List[str] = field(default_factory=list)
    recent_transcript: List[Dict[str, Any]] = field(default_factory=list)
    last_user_turn: str = ""
    current_phase: str = "intro"
    round_index: int = 0
    resume_token: Optional[str] = None
    filler_pack_version: str = "sonia-fillers-v1"
    orchestrator_session_version: str = "orchestrator-sprint1-v1"
    conversation_plan: Dict[str, Any] = field(default_factory=dict)
    interrupt_policy: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "interview_type": self.interview_type,
            "difficulty": self.difficulty,
            "role": self.role,
            "company": self.company,
            "question_mix": self.question_mix,
            "interview_style": self.interview_style,
            "duration_minutes": self.duration_minutes,
            "asked_question_ids": list(self.asked_question_ids),
            "selected_skills": list(self.selected_skills),
            "recent_transcript": list(self.recent_transcript),
            "last_user_turn": self.last_user_turn,
            "current_phase": self.current_phase,
            "round_index": self.round_index,
            "resume_token": self.resume_token,
            "filler_pack_version": self.filler_pack_version,
            "orchestrator_session_version": self.orchestrator_session_version,
            "conversation_plan": dict(self.conversation_plan),
            "interrupt_policy": dict(self.interrupt_policy),
            "context": dict(self.context),
        }

