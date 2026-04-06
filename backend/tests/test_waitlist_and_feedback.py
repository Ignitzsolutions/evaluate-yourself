import asyncio
import json
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import app as app_module
from backend.db import models


class FakeUser:
    def __init__(self, *, id="u1", clerk_user_id="clerk_1"):
        self.id = id
        self.clerk_user_id = clerk_user_id


def _db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    models.Base.metadata.create_all(bind=engine)
    return SessionLocal()


def test_waitlist_signup_creates_and_dedupes_by_normalized_email():
    db = _db()
    try:
        first = app_module.join_waitlist(
            payload=app_module.WaitlistSignupRequest(email="User@Example.com", source_page="landing", intent="free_trial"),
            db=db,
        )
        second = app_module.join_waitlist(
            payload=app_module.WaitlistSignupRequest(email="user@example.com", source_page="pricing", intent="launch"),
            db=db,
        )

        rows = db.query(models.LaunchWaitlistSignup).all()
        assert first["already_joined"] is False
        assert second["already_joined"] is True
        assert len(rows) == 1
        assert rows[0].normalized_email == "user@example.com"
        assert rows[0].source_page == "pricing"
        assert rows[0].intent == "launch"
    finally:
        db.close()


def test_report_feedback_persists_to_table_and_metrics():
    db = _db()
    original_get_current_user = app_module.get_current_user
    try:
        user = models.User(id="u1", clerk_user_id="clerk_1", email="user@example.com")
        report = models.InterviewReport(
            id="report_1",
            session_id="session_1",
            user_id="clerk_1",
            title="Report",
            type="mixed",
            mode="Voice-Only Realtime",
            metrics=json.dumps({"plan_tier": "trial", "trial_mode": True}),
        )
        db.add(user)
        db.add(report)
        db.commit()

        app_module.get_current_user = lambda authorization=None, db=None: FakeUser(id="u1", clerk_user_id="clerk_1")
        result = asyncio.run(
            app_module.upsert_report_feedback(
                report_id="report_1",
                payload={"rating": 4, "comment": "Useful session", "submitted_at": datetime.now(timezone.utc).isoformat()},
                authorization="Bearer token",
                db=db,
            )
        )

        db.refresh(report)
        feedback_row = db.query(models.TrialFeedback).filter(models.TrialFeedback.report_id == "report_1").first()
        metrics = json.loads(report.metrics)

        assert result["session_feedback"]["rating"] == 4
        assert feedback_row is not None
        assert feedback_row.rating == 4
        assert feedback_row.comment == "Useful session"
        assert feedback_row.plan_tier == "trial"
        assert feedback_row.trial_mode is True
        assert metrics["session_feedback"]["rating"] == 4
    finally:
        app_module.get_current_user = original_get_current_user
        db.close()
