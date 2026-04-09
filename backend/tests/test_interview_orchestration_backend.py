from datetime import datetime

import fakeredis
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import app as app_module
from backend.db import models
from backend.services.interview.conversation_planner import build_bootstrap_conversation_plan
from backend.services.interview.persistence import load_latest_evidence_artifact


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
