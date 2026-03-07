from backend.api import admin as admin_module
from backend.db import models
from backend.services.interview.admin_question_bank import (
    get_effective_questions_by_type_and_difficulty,
    validate_selected_skills_effective,
)
from backend.services.interview.skill_tracks import question_matches_track
from backend.data.interview_questions import get_questions_by_type_and_difficulty
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class FakeUser:
    def __init__(self, clerk_user_id: str):
        self.clerk_user_id = clerk_user_id


def _db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return TestingSessionLocal()


def _first_builtin_for_track(track_id: str) -> str:
    for q in get_questions_by_type_and_difficulty("technical", None):
        if question_matches_track(q, track_id):
            return str(q["id"])
    raise AssertionError(f"No builtin question found for track {track_id}")


def test_admin_question_bank_track_question_and_override_flow():
    db = _db()
    admin = FakeUser("admin_1")

    created_track = admin_module.admin_question_bank_create_track(
        payload=admin_module.AdminQuestionBankTrackCreateRequest(
            track_type="technical",
            label="Python Advanced",
            description="Deep Python topics",
            is_active=True,
        ),
        admin_user=admin,
        db=db,
    )
    assert created_track["track_type"] == "technical"
    assert created_track["source_kind"] == "custom"
    assert created_track["id"].startswith("python_advanced")

    list_tracks = admin_module.admin_question_bank_tracks(
        interview_type="technical",
        _admin_user=admin,
        db=db,
    )
    created_ids = {row["id"] for row in list_tracks["items"]}
    assert created_track["id"] in created_ids

    created_question = admin_module.admin_question_bank_create_question(
        payload=admin_module.AdminQuestionBankQuestionCreateRequest(
            track_id=created_track["id"],
            interview_type="technical",
            text="How do Python descriptors work in practice?",
            is_active=True,
        ),
        admin_user=admin,
        db=db,
    )
    assert created_question["source_kind"] == "custom"

    list_questions = admin_module.admin_question_bank_questions(
        track_id=created_track["id"],
        interview_type="technical",
        include_inactive=True,
        _admin_user=admin,
        db=db,
    )
    custom_questions = [q for q in list_questions["items"] if q["source_kind"] == "custom"]
    assert any("descriptors" in q["text"].lower() for q in custom_questions)

    runtime_questions = get_effective_questions_by_type_and_difficulty(db, "technical", "mid")
    assert any(q.get("_admin_track_id") == created_track["id"] for q in runtime_questions)

    builtin_qid = _first_builtin_for_track("python_sql_github_cloud")
    admin_module.admin_question_bank_update_builtin_question(
        builtin_question_id=builtin_qid,
        payload=admin_module.AdminQuestionBankQuestionUpdateRequest(
            text="Custom override text for builtin question",
            is_active=False,
        ),
        admin_user=admin,
        db=db,
    )

    python_track_questions = admin_module.admin_question_bank_questions(
        track_id="python_sql_github_cloud",
        interview_type="technical",
        include_inactive=True,
        _admin_user=admin,
        db=db,
    )["items"]
    overridden = next(q for q in python_track_questions if q["id"] == builtin_qid)
    assert overridden["overridden"] is True
    assert overridden["is_active"] is False
    assert overridden["text"] == "Custom override text for builtin question"

    runtime_after_override = get_effective_questions_by_type_and_difficulty(db, "technical", "mid")
    runtime_ids = {q["id"] for q in runtime_after_override}
    assert builtin_qid not in runtime_ids


def test_validate_selected_skills_effective_respects_custom_track_status():
    db = _db()
    admin = FakeUser("admin_1")
    created_track = admin_module.admin_question_bank_create_track(
        payload=admin_module.AdminQuestionBankTrackCreateRequest(
            track_type="technical",
            label="Node Platform",
            is_active=True,
        ),
        admin_user=admin,
        db=db,
    )

    selected, err = validate_selected_skills_effective(db, "technical", [created_track["id"]])
    assert err is None
    assert selected == [created_track["id"]]

    admin_module.admin_question_bank_update_track(
        track_id=created_track["id"],
        payload=admin_module.AdminQuestionBankTrackUpdateRequest(is_active=False),
        admin_user=admin,
        db=db,
    )
    selected2, err2 = validate_selected_skills_effective(db, "technical", [created_track["id"]])
    assert selected2 == []
    assert "inactive" in (err2 or "").lower()

