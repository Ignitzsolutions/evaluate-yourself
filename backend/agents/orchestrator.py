"""Framework-light conversation orchestrator compatible with LangGraph adoption."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

try:  # pragma: no cover - optional dependency during local development
    from langgraph.graph import END, StateGraph

    LANGGRAPH_AVAILABLE = True
except Exception:  # pragma: no cover
    END = "__end__"
    StateGraph = None
    LANGGRAPH_AVAILABLE = False

try:
    from backend.agents.hr_agent import plan_hr_turn
    from backend.agents.technical_lead import plan_technical_turn
    from backend.agents.judge_router import build_evaluation_channel_plan
    from backend.agents.report_aggregator import aggregate_evaluation_channels
    from backend.agents.state import OrchestratorState
    from backend.db import models
    from backend.mcp_servers.resume_context_server import get_candidate_context
    from backend.mcp_servers.rubric_server import get_rubric
except Exception:  # pragma: no cover
    from agents.hr_agent import plan_hr_turn  # type: ignore
    from agents.technical_lead import plan_technical_turn  # type: ignore
    from agents.judge_router import build_evaluation_channel_plan  # type: ignore
    from agents.report_aggregator import aggregate_evaluation_channels  # type: ignore
    from agents.state import OrchestratorState  # type: ignore
    from db import models  # type: ignore
    from mcp_servers.resume_context_server import get_candidate_context  # type: ignore
    from mcp_servers.rubric_server import get_rubric  # type: ignore


class ConversationOrchestrator:
    session_version = "orchestrator-sprint1-v1"
    filler_pack_version = "sonia-fillers-v1"

    def __init__(self) -> None:
        self._graph = self._build_graph() if LANGGRAPH_AVAILABLE else None

    def build_bootstrap_context(
        self,
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
        resume_token: Optional[str] = None,
        recent_transcript: Optional[List[Dict[str, Any]]] = None,
        phase: str = "intro",
        round_index: int = 0,
        db: Any = None,
    ) -> Dict[str, Any]:
        state = OrchestratorState(
            session_id=session_id,
            interview_type=interview_type,
            difficulty=difficulty,
            role=role,
            company=company,
            question_mix=question_mix,
            interview_style=interview_style,
            duration_minutes=duration_minutes,
            asked_question_ids=list(asked_question_ids or []),
            selected_skills=list(selected_skills or []),
            recent_transcript=list(recent_transcript or []),
            current_phase=phase,
            round_index=round_index,
            resume_token=resume_token or uuid.uuid4().hex,
            filler_pack_version=self.filler_pack_version,
            orchestrator_session_version=self.session_version,
        )
        plan = self._invoke(state, db=db)
        plan.setdefault("resume_token", state.resume_token)
        plan.setdefault("conversation_plan", self._conversation_plan(state, plan))
        plan.setdefault("filler_pack_version", self.filler_pack_version)
        plan.setdefault("orchestrator_session_version", self.session_version)
        plan.setdefault("evaluation_channels", build_evaluation_channel_plan())
        if state.context:
            plan.setdefault("resume_context", state.context.get("resume_context"))
            plan.setdefault("rubric", state.context.get("rubric"))
        return plan

    def plan_next_turn(
        self,
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
        state = OrchestratorState(
            session_id=session_id,
            interview_type=interview_type,
            difficulty=difficulty,
            role=role,
            company=company,
            question_mix=question_mix,
            interview_style=interview_style,
            duration_minutes=duration_minutes,
            asked_question_ids=list(asked_question_ids or []),
            selected_skills=list(selected_skills or []),
            recent_transcript=list(recent_transcript or []),
            last_user_turn=last_user_turn,
            current_phase=phase,
            round_index=round_index,
            resume_token=resume_token or uuid.uuid4().hex,
            filler_pack_version=self.filler_pack_version,
            orchestrator_session_version=self.session_version,
        )
        plan = self._invoke(state, db=db)
        plan.setdefault("resume_token", state.resume_token)
        plan.setdefault("conversation_plan", self._conversation_plan(state, plan))
        plan.setdefault("filler_pack_version", self.filler_pack_version)
        plan.setdefault("orchestrator_session_version", self.session_version)
        plan.setdefault("evaluation_channels", build_evaluation_channel_plan())
        if state.context:
            plan.setdefault("resume_context", state.context.get("resume_context"))
            plan.setdefault("rubric", state.context.get("rubric"))
        return plan

    def summarize_handoff(self, transcript_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        owners = []
        for item in transcript_history:
            owner = str(item.get("agent_owner") or "").strip()
            if owner:
                owners.append(owner)
        return {
            "hops": len(set(owners)),
            "owners": owners[-8:],
        }

    def _build_graph(self):
        if not LANGGRAPH_AVAILABLE or StateGraph is None:
            return None

        graph = StateGraph(OrchestratorState)
        graph.add_node("hydrate_context", self._hydrate_context)
        graph.add_node("route_turn", self._route)
        graph.set_entry_point("hydrate_context")
        graph.add_edge("hydrate_context", "route_turn")
        graph.add_edge("route_turn", END)
        return graph.compile()

    def _invoke(self, state: OrchestratorState, db: Any = None) -> Dict[str, Any]:
        if self._graph is not None:
            result = self._graph.invoke((state, {"db": db}))
            if isinstance(result, tuple):
                _, output = result
                if isinstance(output, dict):
                    return output
            if isinstance(result, dict):
                return result
        hydrated = self._hydrate_context(state, {"db": db})
        return self._route(hydrated, {"db": db})

    def _hydrate_context(self, state: OrchestratorState, config: Any = None) -> OrchestratorState:
        db = None
        if isinstance(config, dict):
            db = config.get("db")
        elif isinstance(config, tuple) and len(config) > 1 and isinstance(config[1], dict):
            db = config[1].get("db")

        candidate_profile = None
        if db is not None:
            try:
                session_row = (
                    db.query(models.InterviewSession)
                    .filter(models.InterviewSession.session_id == state.session_id)
                    .first()
                )
                user_row = None
                if session_row and getattr(session_row, "clerk_user_id", None):
                    user_row = (
                        db.query(models.User)
                        .filter(models.User.clerk_user_id == session_row.clerk_user_id)
                        .first()
                    )
                if user_row:
                    candidate_profile = (
                        db.query(models.CandidateProfileV2)
                        .filter(models.CandidateProfileV2.user_id == user_row.id)
                        .first()
                    )
            except Exception:
                candidate_profile = None

        state.context = {
            "resume_context": get_candidate_context(candidate_profile, state.role),
            "rubric": get_rubric(
                interview_type=state.interview_type,
                role_family=state.role,
                difficulty=state.difficulty,
                selected_skills=state.selected_skills,
            ),
        }
        return state

    def _conversation_plan(self, state: OrchestratorState, plan: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "phase": state.current_phase,
            "round_index": state.round_index,
            "agent_owner": plan.get("agent_owner", "orchestrator"),
            "speaker_strategy": plan.get("speaker_strategy", "probe"),
            "filler_hint": plan.get("filler_hint", "acknowledgment"),
            "interrupt_policy": {
                "candidate_barge_in": True,
                "sonia_ramble_interrupt_ms": 180000,
                "allow_candidate_interrupt": True,
            },
            "resume_supported": True,
            "evaluation_channels": build_evaluation_channel_plan(),
            "mcp_context": {
                "resume_context_available": bool((state.context or {}).get("resume_context")),
                "rubric_available": bool((state.context or {}).get("rubric")),
            },
        }

    def _route(self, state: OrchestratorState, config: Any = None) -> Dict[str, Any]:
        db = None
        if isinstance(config, dict):
            db = config.get("db")
        elif isinstance(config, tuple) and len(config) > 1 and isinstance(config[1], dict):
            db = config[1].get("db")
        interview_type = (state.interview_type or "mixed").strip().lower()
        phase = (state.current_phase or "intro").strip().lower()
        asked_count = len(state.asked_question_ids)
        if phase in {"intro", "opening", "resume"} or asked_count == 0:
            return plan_hr_turn(
                interview_type=interview_type,
                difficulty=state.difficulty,
                role=state.role,
                company=state.company,
                question_mix=state.question_mix,
                interview_style=state.interview_style,
                duration_minutes=state.duration_minutes,
                asked_question_ids=state.asked_question_ids,
                selected_skills=state.selected_skills,
                recent_transcript=state.recent_transcript,
                last_user_turn=state.last_user_turn,
                db=db,
            )
        if interview_type == "behavioral":
            return plan_hr_turn(
                interview_type=interview_type,
                difficulty=state.difficulty,
                role=state.role,
                company=state.company,
                question_mix=state.question_mix,
                interview_style=state.interview_style,
                duration_minutes=state.duration_minutes,
                asked_question_ids=state.asked_question_ids,
                selected_skills=state.selected_skills,
                recent_transcript=state.recent_transcript,
                last_user_turn=state.last_user_turn,
                db=db,
            )
        if interview_type == "technical":
            return plan_technical_turn(
                interview_type=interview_type,
                difficulty=state.difficulty,
                role=state.role,
                company=state.company,
                question_mix=state.question_mix,
                interview_style=state.interview_style,
                duration_minutes=state.duration_minutes,
                asked_question_ids=state.asked_question_ids,
                selected_skills=state.selected_skills,
                recent_transcript=state.recent_transcript,
                last_user_turn=state.last_user_turn,
                db=db,
            )
        if asked_count % 2 == 0:
            return plan_hr_turn(
                interview_type=interview_type,
                difficulty=state.difficulty,
                role=state.role,
                company=state.company,
                question_mix=state.question_mix,
                interview_style=state.interview_style,
                duration_minutes=state.duration_minutes,
                asked_question_ids=state.asked_question_ids,
                selected_skills=state.selected_skills,
                recent_transcript=state.recent_transcript,
                last_user_turn=state.last_user_turn,
                db=db,
            )
        return plan_technical_turn(
            interview_type=interview_type,
            difficulty=state.difficulty,
            role=state.role,
            company=state.company,
            question_mix=state.question_mix,
            interview_style=state.interview_style,
            duration_minutes=state.duration_minutes,
            asked_question_ids=state.asked_question_ids,
            selected_skills=state.selected_skills,
            recent_transcript=state.recent_transcript,
            last_user_turn=state.last_user_turn,
            db=db,
        )
