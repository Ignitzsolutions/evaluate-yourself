import asyncio
import importlib
import json
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
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


def _request(session_id="session_new"):
    return app_module.CreateInterviewReportRequest(
        session_id=session_id,
        title="Report",
        type="mixed",
        mode="Voice-Only Realtime",
        duration="10 minutes",
        overall_score=82,
        scores=app_module.ScoreBreakdown(
            communication=80,
            clarity=81,
            structure=82,
            technical_depth=83,
            relevance=84,
        ),
        transcript=[
            app_module.TranscriptMessage(
                speaker="candidate",
                text="I improved a service.",
                timestamp=datetime.now(timezone.utc),
            )
        ],
        recommendations=["Keep practicing."],
        questions=1,
    )


def test_report_list_filters_by_internal_user_id(monkeypatch):
    db = _db()
    original_get_current_user = app_module.get_current_user
    try:
        db.add(models.User(id="u1", clerk_user_id="clerk_1", email="user@example.com"))
        db.add_all(
            [
                models.InterviewReport(
                    id="internal_owner",
                    session_id="session_internal",
                    user_id="u1",
                    title="Internal",
                    type="mixed",
                    mode="voice",
                    overall_score=80,
                    questions=1,
                    is_sample=False,
                ),
                models.InterviewReport(
                    id="legacy_clerk_owner",
                    session_id="session_legacy",
                    user_id="clerk_1",
                    title="Legacy",
                    type="mixed",
                    mode="voice",
                    overall_score=10,
                    questions=1,
                    is_sample=False,
                ),
            ]
        )
        db.commit()

        app_module.get_current_user = lambda authorization=None, db=None: FakeUser()
        result = asyncio.run(app_module.list_interview_reports(authorization="Bearer token", db=db))

        assert [row.id for row in result] == ["internal_owner"]
    finally:
        app_module.get_current_user = original_get_current_user
        db.close()


def test_create_report_stores_internal_user_id(monkeypatch):
    db = _db()
    original_get_current_user = app_module.get_current_user
    try:
        db.add(models.User(id="u1", clerk_user_id="clerk_1", email="user@example.com"))
        db.commit()

        app_module.get_current_user = lambda authorization=None, db=None: FakeUser()
        monkeypatch.setattr(app_module, "EVAL_REPORT_POST_ENDPOINT_MODE", "enabled")
        result = asyncio.run(
            app_module.create_interview_report(
                request=_request(),
                authorization="Bearer token",
                db=db,
            )
        )

        report = db.query(models.InterviewReport).filter(models.InterviewReport.id == result["id"]).one()
        assert report.user_id == "u1"
        assert json.loads(report.scores)["communication"] == 80
    finally:
        app_module.get_current_user = original_get_current_user
        db.close()


def test_report_owner_check_uses_internal_user_id(monkeypatch):
    db = _db()
    original_get_current_user = app_module.get_current_user
    try:
        db.add(models.User(id="u1", clerk_user_id="clerk_1", email="user@example.com"))
        db.add(
            models.InterviewReport(
                id="report_1",
                session_id="session_1",
                user_id="u1",
                title="Report",
                type="mixed",
                mode="voice",
                overall_score=80,
                scores=json.dumps({}),
                transcript=json.dumps([]),
                recommendations=json.dumps([]),
                questions=1,
                is_sample=False,
            )
        )
        db.commit()

        app_module.get_current_user = lambda authorization=None, db=None: FakeUser()
        report = asyncio.run(
            app_module.get_interview_report("report_1", authorization="Bearer token", db=db)
        )

        assert report.id == "report_1"
    finally:
        app_module.get_current_user = original_get_current_user
        db.close()


def test_report_user_id_backfill_converts_clerk_ids_and_leaves_unknowns():
    migration = importlib.import_module(
        "backend.migrations.versions.20260719_0016_interview_report_user_id_backfill"
    )
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE users (id TEXT PRIMARY KEY, clerk_user_id TEXT UNIQUE)"))
        conn.execute(
            text(
                "CREATE TABLE interview_reports (id TEXT PRIMARY KEY, user_id TEXT, title TEXT)"
            )
        )
        conn.execute(text("INSERT INTO users (id, clerk_user_id) VALUES ('u1', 'clerk_1')"))
        conn.execute(
            text(
                """
                INSERT INTO interview_reports (id, user_id, title)
                VALUES ('r1', 'clerk_1', 'known'), ('r2', 'missing_clerk', 'unknown')
                """
            )
        )

        migration._backfill_interview_report_user_ids(conn)
        rows = dict(conn.execute(text("SELECT id, user_id FROM interview_reports")).all())

    assert rows == {"r1": "u1", "r2": "missing_clerk"}


def test_legacy_gaze_websocket_is_production_gated(monkeypatch):
    monkeypatch.setattr(app_module, "is_production", True)
    client = TestClient(app_module.app)

    with client.websocket_connect("/ws") as websocket:
        message = websocket.receive_json()

    assert message["type"] == "error"
    assert "disabled in production" in message["error"]


def test_legacy_gaze_websocket_stays_available_in_development(monkeypatch):
    monkeypatch.setattr(app_module, "is_production", False)
    client = TestClient(app_module.app)

    with client.websocket_connect("/ws") as websocket:
        websocket.send_json({"type": "init"})
        message = websocket.receive_json()

    assert message == {"type": "init", "status": "connected"}
