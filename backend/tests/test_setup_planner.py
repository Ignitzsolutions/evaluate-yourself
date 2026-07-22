import asyncio

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import app as app_module
from backend.db import models
from backend.services.interview.setup_planner import (
    build_jd_question_plan,
    resolve_default_difficulty,
)


def test_resolve_default_difficulty_from_explicit_override():
    assert resolve_default_difficulty(requested_difficulty="easy", seniority="senior") == "junior"
    assert resolve_default_difficulty(requested_difficulty="hard", seniority="junior") == "senior"


def test_resolve_default_difficulty_from_seniority_and_role():
    assert resolve_default_difficulty(requested_difficulty="auto", seniority="junior") == "junior"
    assert resolve_default_difficulty(requested_difficulty="auto", target_role="Staff Backend Engineer") == "senior"
    assert resolve_default_difficulty(requested_difficulty="auto", years_experience=4) == "mid"


def test_build_jd_question_plan_is_deterministic_and_jd_aware():
    jd = """
    Senior Backend Engineer role. Must have Python, FastAPI, PostgreSQL,
    Docker, Kubernetes, and AWS experience. 7+ years preferred.
    """

    first = build_jd_question_plan(
        target_jd=jd,
        target_role="Backend Engineer",
        seniority="auto",
        years_experience=7,
        interview_type="technical",
        requested_difficulty="auto",
        selected_skills=["python_sql_github_cloud"],
        question_count=4,
    )
    second = build_jd_question_plan(
        target_jd=jd,
        target_role="Backend Engineer",
        seniority="auto",
        years_experience=7,
        interview_type="technical",
        requested_difficulty="auto",
        selected_skills=["python_sql_github_cloud"],
        question_count=4,
    )

    assert first == second
    assert first["difficulty"] == "senior"
    assert "python" in first["jd_signals"]["tech_stack"]
    assert first["questions"]
    assert len(first["questions"]) <= 4


def test_jd_question_plan_endpoint_returns_preview(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)
    db = testing_session()

    class FakeUser:
        clerk_user_id = "candidate_1"
        id = "user_1"

    monkeypatch.setattr(app_module, "get_current_user", lambda **kwargs: FakeUser())

    response = asyncio.run(
        app_module.interview_jd_question_plan(
            app_module.JdQuestionPlanRequest(
                targetJobDescription="Lead Python backend engineer with AWS and Kubernetes.",
                targetRole="Lead Backend Engineer",
                seniority="lead",
                interviewType="technical",
                difficulty="auto",
                questionCount=3,
            ),
            authorization="Bearer fake",
            db=db,
        )
    )

    assert response["ok"] is True
    assert response["questionPlan"]["difficulty"] == "senior"
    assert response["questionPlan"]["questions"]
