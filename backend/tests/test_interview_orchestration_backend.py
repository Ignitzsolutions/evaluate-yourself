from datetime import datetime
import os
from pathlib import Path
import subprocess
import sys

import fakeredis
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import app as app_module
from backend.db import models
from backend.services.interview.conversation_planner import build_bootstrap_conversation_plan
from backend.services.interview.persistence import load_latest_evidence_artifact, persist_session_memory_snapshot


class FakeUser:
    def __init__(self, clerk_user_id: str):
        self.clerk_user_id = clerk_user_id


def _db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return TestingSessionLocal()


@pytest.fixture
def redis_client(monkeypatch):
    client = fakeredis.FakeStrictRedis(decode_responses=True)
    monkeypatch.setattr(app_module, "get_redis_client", lambda: client)
    return client


def test_bootstrap_plan_exposes_resume_and_evaluation_metadata():
    plan = build_bootstrap_conversation_plan(
        session_id="session_bootstrap",
        interview_type="mixed",
        difficulty="mid",
        role="Backend Engineer",
        company="Acme",
        question_mix="balanced",
        interview_style="neutral",
        selected_skills=["sql"],
        duration_minutes=15,
    )

    assert plan["resume_token"]
    assert plan["filler_pack_version"] == "sonia-fillers-v1"
    assert plan["orchestrator_session_version"] == "orchestrator-sprint1-v1"
    assert plan["evaluation_channels"]["technical_semantic"]["trusted_source"] == "server_transcript"
    assert plan["conversation_plan"]["resume_supported"] is True
    assert plan["conversation_plan"]["evaluation_channels"]["english_communication"]["enabled"] is True


def test_bootstrap_plan_loads_prior_round_memory_summary():
    db = _db()
    persist_session_memory_snapshot(
        db,
        session_id="session_memory",
        clerk_user_id="candidate_1",
        round_index=0,
        snapshot_kind="round_summary",
        memory={
            "skills_demonstrated": ["sql"],
            "unresolved_follow_ups": ["Can you explain the tradeoff you skipped earlier?"],
        },
        resume_token="resume_1",
    )

    plan = build_bootstrap_conversation_plan(
        session_id="session_memory",
        interview_type="mixed",
        difficulty="mid",
        role="Backend Engineer",
        company="Acme",
        question_mix="balanced",
        interview_style="neutral",
        selected_skills=["sql"],
        duration_minutes=15,
        round_index=1,
        db=db,
    )

    assert plan["conversation_plan"]["mcp_context"]["memory_summary_available"] is True
    assert plan["memory_summary"]["skills_demonstrated"] == ["sql"]


def test_free_access_mode_resolves_to_free_plan_without_entitlement():
    db = _db()

    plan_tier, entitlement = app_module._resolve_plan_tier_for_user(db, "candidate_1")

    assert plan_tier == "free"
    assert entitlement is None
    assert app_module._effective_duration_minutes(90, plan_tier, entitlement) == 90


def test_persistence_module_supports_backend_script_import_path():
    repo_root = Path(__file__).resolve().parents[2]
    backend_dir = repo_root / "backend"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from services.interview.persistence import load_latest_memory_snapshot; print(load_latest_memory_snapshot.__name__)",
        ],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "load_latest_memory_snapshot" in result.stdout


@pytest.mark.asyncio
async def test_next_turn_and_compatibility_wrapper_share_planner_contract(monkeypatch, redis_client):
    monkeypatch.setattr(app_module, "INTERVIEW_SKILL_TRACKS_ENABLED", False)
    monkeypatch.setattr(
        app_module,
        "plan_next_turn_graph",
        lambda **kwargs: {
            "next_question": "Explain the tradeoffs of your last deployment.",
            "question_id": "tech_q_1",
            "reason": "move_on",
            "turn_scores": {"clarity": 4, "depth": 5, "relevance": 5},
            "difficulty_next": "senior",
            "followup_type": "move_on",
            "policy_action": "NONE",
            "refusal_message": None,
            "selected_skills_applied": kwargs.get("selected_skills") or [],
            "adaptive_path": {"mode": "technical"},
            "agent_owner": "technical_lead_agent",
            "speaker_strategy": "inquisitive",
            "filler_hint": "thinking",
            "recoverable_error": None,
            "conversation_plan": {
                "agent_owner": "technical_lead_agent",
                "speaker_strategy": "inquisitive",
                "filler_hint": "thinking",
            },
            "interrupt_policy": {"candidate_barge_in": True, "sonia_interrupt_after_ms": 180000},
        },
    )

    db = _db()
    db.add(
        models.InterviewSession(
            session_id="session_next_turn",
            clerk_user_id="candidate_1",
            status="ACTIVE",
            interview_type="mixed",
            difficulty="mid",
            duration_minutes_effective=15,
            started_at=datetime.utcnow(),
        )
    )
    db.commit()

    payload = app_module.NextTurnRequest(
        last_user_turn="I built a deployment pipeline.",
        transcript_window=[
            {"speaker": "ai", "text": "Tell me about your background."},
            {"speaker": "user", "text": "I built deployment pipelines and rolled out services."},
        ],
        interviewType="mixed",
        difficulty="mid",
        role="Backend Engineer",
        company="Acme",
        questionMix="balanced",
        interviewStyle="neutral",
        durationMinutes=15,
        askedQuestionIds=[],
        selectedSkills=[],
    )

    response = await app_module.next_turn(
        session_id="session_next_turn",
        payload=payload,
        current_user=FakeUser("candidate_1"),
        db=db,
    )

    assert response["next_question"] == "Explain the tradeoffs of your last deployment."
    assert response["agent_owner"] == "technical_lead_agent"
    assert response["speaker_strategy"] == "inquisitive"
    assert response["filler_pack_version"] == "sonia-fillers-v1"
    assert response["orchestrator_session_version"] == "orchestrator-sprint1-v1"
    assert response["resume_token"]
    assert response["conversation_plan"]["speaker_strategy"] == "inquisitive"

    assert db.query(models.InterviewRound).count() == 1
    assert db.query(models.SessionMemorySnapshot).count() == 1

    legacy_response = await app_module.adaptive_turn(
        session_id="session_next_turn",
        payload=app_module.AdaptiveTurnRequest(
            last_user_turn="I built a deployment pipeline.",
            transcript_window=[
                {"speaker": "ai", "text": "Tell me about your background."},
                {"speaker": "user", "text": "I built deployment pipelines and rolled out services."},
            ],
            interviewType="mixed",
            difficulty="mid",
            role="Backend Engineer",
            company="Acme",
            questionMix="balanced",
            interviewStyle="neutral",
            durationMinutes=15,
            askedQuestionIds=[],
            selectedSkills=[],
        ),
        current_user=FakeUser("candidate_1"),
        db=db,
    )
    assert legacy_response["conversation_plan"]["speaker_strategy"] == "inquisitive"
    assert legacy_response["resume_token"]


@pytest.mark.asyncio
async def test_capture_endpoint_persists_trusted_and_fallback_evidence(redis_client):
    db = _db()
    db.add(
        models.InterviewSession(
            session_id="session_capture",
            clerk_user_id="candidate_1",
            status="ACTIVE",
            interview_type="mixed",
            difficulty="mid",
            duration_minutes_effective=15,
            started_at=datetime.utcnow(),
        )
    )
    db.commit()

    response = await app_module.capture_interview_evidence(
        session_id="session_capture",
        request=app_module.TrustedCaptureRequest(
            trusted_transcript=[
                {"speaker": "ai", "text": "What did you build?", "timestamp": "2026-04-08T10:00:00Z"},
                {"speaker": "user", "text": "I built a payment service.", "timestamp": "2026-04-08T10:00:06Z"},
            ],
            fallback_transcript=[
                {"speaker": "user", "text": "I built a payment service.", "timestamp": "2026-04-08T10:00:06Z"},
            ],
            word_timestamps=[{"word": "built", "start_ms": 0, "end_ms": 120}],
            capture_integrity={"manual_override": True},
            transcript_origin="browser_speech_fallback",
            evaluation_source="server_transcript",
        ),
        authorization=None,
        db=db,
    )

    assert response["session_id"] == "session_capture"
    assert response["trust_level"] == "mixed_evidence"
    assert response["capture_integrity"]["trusted_candidate_turn_count"] == 1
    assert response["capture_integrity"]["fallback_candidate_turn_count"] == 1
    assert response["evaluation_channels"]["technical_semantic"]["trusted_source"] == "server_transcript"

    artifact = load_latest_evidence_artifact(db, session_id="session_capture")
    assert artifact is not None
    assert artifact["payload"]["trusted_transcript"][1]["text"] == "I built a payment service."
    assert artifact["payload"]["fallback_transcript"][0]["text"] == "I built a payment service."
    assert artifact["word_timestamps"][0]["word"] == "built"

    assert db.query(models.EvidenceArtifact).count() == 1
    assert db.query(models.SessionMemorySnapshot).count() == 1
