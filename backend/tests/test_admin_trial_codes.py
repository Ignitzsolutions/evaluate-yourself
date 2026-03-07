from datetime import datetime, timedelta, timezone
import json

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.api import admin as admin_module
from backend.db import models


class FakeUser:
    def __init__(self, clerk_user_id: str):
        self.clerk_user_id = clerk_user_id


def _db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    return db


def test_admin_can_create_and_list_trial_codes():
    db = _db()
    payload = admin_module.TrialCodeCreateRequest(duration_minutes=5, expires_in_days=7, note="campaign-a")
    create_resp = admin_module.create_trial_code(
        payload=payload,
        admin_user=FakeUser("admin_1"),
        db=db,
    )
    assert create_resp["code"].startswith("TRY-")
    assert create_resp["status"] == "ACTIVE"

    list_resp = admin_module.list_trial_codes(
        _admin_user=FakeUser("admin_1"),
        db=db,
        page=1,
        page_size=10,
        status=None,
    )
    items = list_resp["items"]
    assert len(items) == 1
    assert items[0]["code"] == create_resp["code"]


def test_admin_trial_code_suffix_create_and_filter():
    db = _db()
    payload = admin_module.TrialCodeCreateRequest(
        duration_minutes=5,
        expires_in_days=7,
        note="suffix-campaign",
        code_suffix="abc12",
    )
    create_resp = admin_module.create_trial_code(
        payload=payload,
        admin_user=FakeUser("admin_1"),
        db=db,
    )
    assert create_resp["code"].endswith("-ABC12")
    assert create_resp["code_suffix"] == "ABC12"
    assert create_resp["code_format_version"] == "v2_suffix_optional"

    list_resp = admin_module.list_trial_codes(
        _admin_user=FakeUser("admin_1"),
        db=db,
        status=None,
        suffix="ABC12",
        page=1,
        page_size=10,
    )
    assert list_resp["total"] == 1
    assert list_resp["items"][0]["code_suffix"] == "ABC12"
    assert list_resp["items"][0]["note"] == "suffix-campaign"


def test_admin_trial_code_invalid_suffix_rejected():
    db = _db()
    payload = admin_module.TrialCodeCreateRequest(
        duration_minutes=5,
        expires_in_days=7,
        code_suffix="bad-suffix!",
    )
    try:
        admin_module.create_trial_code(
            payload=payload,
            admin_user=FakeUser("admin_1"),
            db=db,
        )
        assert False, "Expected HTTPException for invalid suffix"
    except HTTPException as exc:
        assert exc.status_code == 422


def test_non_admin_blocked_from_admin_endpoints():
    db = _db()
    admin_module.configure_admin_dependencies(
        get_current_user_func=lambda authorization=None, db=None: FakeUser("candidate_1"),
        is_admin_func=lambda clerk_user_id: False,
    )
    try:
        admin_module._get_admin_user(authorization="Bearer token", db=db)
        assert False, "Expected HTTPException for non-admin access"
    except HTTPException as exc:
        assert exc.status_code == 403


def test_soft_delete_candidate_revokes_entitlements():
    db = _db()
    user = models.User(
        id="u1",
        clerk_user_id="candidate_1",
        email="candidate@example.com",
        full_name="Candidate One",
        is_active=True,
        is_deleted=False,
    )
    ent = models.UserEntitlement(
        id="e1",
        clerk_user_id="candidate_1",
        source_type="TRIAL_CODE",
        source_id="code1",
        plan_tier="trial",
        duration_minutes_effective=5,
        is_active=True,
        starts_at=datetime.now(timezone.utc).replace(tzinfo=None),
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=2),
    )
    db.add(user)
    db.add(ent)
    db.commit()
    resp = admin_module.soft_delete_candidate(
        clerk_user_id="candidate_1",
        _admin_user=FakeUser("admin_1"),
        db=db,
    )
    assert resp["is_deleted"] is True
    db.refresh(user)
    db.refresh(ent)
    assert user.is_deleted is True
    assert user.is_active is False
    assert ent.is_active is False
    assert ent.revoked_at is not None


def test_delete_trial_code_revokes_active_entitlement():
    db = _db()
    code = models.TrialCode(
        id="tc_1",
        code="TRY-ABCDEFGH",
        status="REDEEMED",
        duration_minutes=5,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3),
        created_by_clerk_user_id="admin_1",
        redeemed_by_clerk_user_id="candidate_1",
        redeemed_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    ent = models.UserEntitlement(
        id="e1",
        clerk_user_id="candidate_1",
        source_type="TRIAL_CODE",
        source_id="tc_1",
        plan_tier="trial",
        duration_minutes_effective=5,
        is_active=True,
        starts_at=datetime.now(timezone.utc).replace(tzinfo=None),
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3),
    )
    db.add(code)
    db.add(ent)
    db.commit()
    resp = admin_module.delete_trial_code(
        code_id="tc_1",
        _admin_user=FakeUser("admin_1"),
        db=db,
    )
    assert resp["status"] == "DELETED"
    db.refresh(code)
    db.refresh(ent)
    assert code.status == "DELETED"
    assert ent.is_active is False
    assert ent.revoked_at is not None


def test_evaluation_quality_summary_counts_invalid_contracts():
    db = _db()
    report_ok = models.InterviewReport(
        id="r1",
        session_id="s1",
        user_id="candidate_1",
        title="Report 1",
        type="Mixed",
        mode="Voice",
        duration="10 minutes",
        overall_score=70,
        scores=json.dumps({"communication": 70, "clarity": 70, "structure": 70, "relevance": 70}),
        transcript=json.dumps([]),
        recommendations=json.dumps([]),
        questions=3,
        metrics=json.dumps(
            {
                "contract_passed": True,
                "validation_flags": [],
                "evaluation_explainability": {"source": "runtime_adaptive_turn_evaluations"},
            }
        ),
        is_sample=False,
    )
    report_bad = models.InterviewReport(
        id="r2",
        session_id="s2",
        user_id="candidate_1",
        title="Report 2",
        type="Mixed",
        mode="Voice",
        duration="10 minutes",
        overall_score=0,
        scores=json.dumps({"communication": 0, "clarity": 0, "structure": 0, "relevance": 0}),
        transcript=json.dumps([]),
        recommendations=json.dumps([]),
        questions=0,
        metrics=json.dumps(
            {
                "contract_passed": False,
                "validation_flags": ["HARD_GUARD_CANDIDATE_WORDS_ZERO"],
                "score_provenance": {"source": "runtime_adaptive_turn_evaluations", "forced_zero_reason": "evaluation_contract_failed"},
            }
        ),
        is_sample=False,
    )
    db.add(report_ok)
    db.add(report_bad)
    db.commit()

    summary = admin_module.evaluation_quality_summary(
        _admin_user=FakeUser("admin_1"),
        db=db,
    )
    assert summary["total_reports"] == 2
    assert summary["invalid_contract_reports"] == 1
    assert summary["zero_score_without_evidence_attempts_blocked"] >= 1
    assert "invalid_contract_blocked_today" in summary
    assert "source_distribution_last_7_days" in summary
    assert "score_percentiles_by_interview_type_last_7_days" in summary
    assert "contract_failed_reasons" in summary
    assert "phase_c_readiness" in summary


def test_admin_dashboard_overview_shapes_and_counts():
    db = _db()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    user = models.User(
        id="u1",
        clerk_user_id="candidate_1",
        email="candidate@example.com",
        full_name="Candidate One",
        is_active=True,
        is_deleted=False,
        created_at=now - timedelta(hours=2),
        last_login_at=now - timedelta(hours=1),
    )
    profile = models.UserProfile(
        id="p1",
        clerk_user_id="candidate_1",
        user_category="professional",
        primary_goal="job-change",
        target_roles=json.dumps(["Backend Engineer", "Python Developer"]),
        industries=json.dumps(["Software"]),
        interview_timeline="30-days",
        prep_intensity="medium",
        learning_style="hands-on",
        consent_data_use=True,
    )
    session = models.InterviewSession(
        id="sdb1",
        session_id="session_db_1",
        clerk_user_id="candidate_1",
        status="COMPLETED",
        interview_type="technical",
        difficulty="easy",
        duration_minutes_requested=10,
        duration_minutes_effective=5,
        started_at=now - timedelta(hours=1),
        session_meta_json=json.dumps(
            {
                "question_mix": "technical",
                "interview_style": "neutral",
                "selected_skills": ["python_sql_github_cloud"],
                "company": "Acme",
            }
        ),
    )
    code = models.TrialCode(
        id="tc_dash_1",
        code="TRY-ABCDEF12-SFX1",
        code_suffix="SFX1",
        status="REDEEMED",
        duration_minutes=5,
        expires_at=now + timedelta(days=2),
        created_by_clerk_user_id="admin_1",
        redeemed_by_clerk_user_id="candidate_1",
        redeemed_at=now - timedelta(hours=2),
    )
    entitlement = models.UserEntitlement(
        id="e_dash_1",
        clerk_user_id="candidate_1",
        source_type="TRIAL_CODE",
        source_id="tc_dash_1",
        plan_tier="trial",
        duration_minutes_effective=5,
        is_active=True,
        starts_at=now - timedelta(hours=2),
        expires_at=now + timedelta(days=2),
    )
    db.add(user)
    db.add(profile)
    db.add(session)
    db.add(code)
    db.add(entitlement)
    db.commit()

    overview = admin_module.admin_dashboard_overview(
        _admin_user=FakeUser("admin_1"),
        db=db,
    )
    assert overview["db"]["health"] in {"up", "down"}
    assert overview["db"]["engine"]
    assert overview["table_counts"]["users_total"] >= 1
    assert overview["candidate_funnel"]["registered_24h"] >= 1
    assert overview["candidate_funnel"]["logged_in_24h"] >= 1
    assert "active_users_now" in overview["candidate_funnel"]
    assert "active_users_last_15m_count" in overview["candidate_funnel"]
    assert "interview_type_distribution" in overview["interview_metadata"]
    assert "selected_skills_top" in overview["interview_metadata"]
    assert "target_roles_top" in overview["interview_metadata"]
    assert overview["trials"]["created_7d"] >= 1
    assert "invalid_contract_reports" in overview["quality"]


def test_admin_active_users_includes_live_or_recent_login_and_excludes_deleted():
    db = _db()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    live_user = models.User(
        id="u_live",
        clerk_user_id="candidate_live",
        email="live@example.com",
        full_name="Live User",
        is_active=True,
        is_deleted=False,
        last_login_at=now - timedelta(hours=5),
    )
    recent_user = models.User(
        id="u_recent",
        clerk_user_id="candidate_recent",
        email="recent@example.com",
        full_name="Recent User",
        is_active=True,
        is_deleted=False,
        last_login_at=now - timedelta(minutes=5),
    )
    deleted_user = models.User(
        id="u_deleted",
        clerk_user_id="candidate_deleted",
        email="deleted@example.com",
        full_name="Deleted User",
        is_active=False,
        is_deleted=True,
        last_login_at=now - timedelta(minutes=2),
    )
    live_session = models.InterviewSession(
        id="sess_live",
        session_id="session_live_1",
        clerk_user_id="candidate_live",
        status="ACTIVE",
        interview_type="technical",
        started_at=now - timedelta(minutes=10),
    )
    db.add_all([live_user, recent_user, deleted_user, live_session])
    db.commit()

    resp = admin_module.admin_active_users(
        _admin_user=FakeUser("admin_1"),
        db=db,
        window_minutes=15,
        page=1,
        page_size=50,
        q=None,
    )
    ids = {item["clerk_user_id"] for item in resp["items"]}
    assert "candidate_live" in ids
    assert "candidate_recent" in ids
    assert "candidate_deleted" not in ids
    assert resp["count_now"] == 1
    assert resp["count_window"] == 2


def test_admin_interviews_returns_capture_source_and_filters_skill():
    db = _db()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    user = models.User(
        id="u1",
        clerk_user_id="candidate_1",
        email="candidate@example.com",
        full_name="Candidate One",
        is_active=True,
        is_deleted=False,
    )
    session = models.InterviewSession(
        id="sid1",
        session_id="session_1",
        clerk_user_id="candidate_1",
        status="COMPLETED",
        interview_type="technical",
        difficulty="mid",
        started_at=now - timedelta(minutes=30),
        report_id="rep_1",
        session_meta_json=json.dumps({"selected_skills": ["backend_engineering"], "question_mix": "technical"}),
    )
    report = models.InterviewReport(
        id="rep_1",
        session_id="session_1",
        user_id="candidate_1",
        title="r",
        type="technical",
        mode="voice",
        duration="10",
        overall_score=72,
        scores=json.dumps({}),
        transcript=json.dumps([]),
        recommendations=json.dumps([]),
        questions=4,
        metrics=json.dumps({"capture_status": "COMPLETE", "evaluation_explainability": {"source": "server_deterministic_rubric"}}),
        is_sample=False,
    )
    db.add_all([user, session, report])
    db.commit()

    filtered = admin_module.admin_interviews(
        _admin_user=FakeUser("admin_1"),
        db=db,
        page=1,
        page_size=25,
        status="completed",
        interview_type="technical",
        q=None,
        window_days=30,
        skill="backend_engineering",
    )
    assert filtered["total"] == 1
    item = filtered["items"][0]
    assert item["capture_status"] == "COMPLETE"
    assert item["evaluation_source"] == "server_deterministic_rubric"
    assert "backend_engineering" in item["selected_skills"]


def test_admin_reports_filters_by_source_and_capture_status():
    db = _db()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    user = models.User(
        id="u1",
        clerk_user_id="candidate_1",
        email="candidate@example.com",
        full_name="Candidate One",
        is_active=True,
        is_deleted=False,
    )
    report_ok = models.InterviewReport(
        id="rep_ok",
        session_id="session_ok",
        user_id="candidate_1",
        title="ok",
        type="technical",
        mode="voice",
        duration="10",
        overall_score=80,
        scores=json.dumps({}),
        transcript=json.dumps([]),
        recommendations=json.dumps([]),
        questions=5,
        metrics=json.dumps({"capture_status": "COMPLETE", "evaluation_explainability": {"source": "server_deterministic_rubric"}}),
        date=now - timedelta(hours=2),
        is_sample=False,
    )
    report_other = models.InterviewReport(
        id="rep_other",
        session_id="session_other",
        user_id="candidate_1",
        title="other",
        type="behavioral",
        mode="voice",
        duration="10",
        overall_score=20,
        scores=json.dumps({}),
        transcript=json.dumps([]),
        recommendations=json.dumps([]),
        questions=1,
        metrics=json.dumps({"capture_status": "INCOMPLETE_NO_CANDIDATE_AUDIO", "evaluation_explainability": {"source": "none_no_candidate_audio"}}),
        date=now - timedelta(hours=1),
        is_sample=False,
    )
    db.add_all([user, report_ok, report_other])
    db.commit()

    resp = admin_module.admin_reports(
        _admin_user=FakeUser("admin_1"),
        db=db,
        page=1,
        page_size=25,
        interview_type="all",
        source="server_deterministic_rubric",
        capture_status="COMPLETE",
        q=None,
        window_days=30,
    )
    assert resp["total"] == 1
    assert resp["items"][0]["report_id"] == "rep_ok"


def test_admin_config_is_read_only_and_masks_sensitive_config():
    db = _db()
    config = admin_module.admin_config(
        _admin_user=FakeUser("admin_1"),
        db=db,
    )
    assert "db" in config
    assert "flags" in config
    assert "cors" in config
    assert "admin_access" in config
    serialized = json.dumps(config).lower()
    assert "clerk_secret_key" not in serialized
