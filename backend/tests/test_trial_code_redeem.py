from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import app as app_module
from backend.db import models


class FakeUser:
    def __init__(self, clerk_user_id: str):
        self.clerk_user_id = clerk_user_id


def _db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return TestingSessionLocal()


def test_redeem_trial_code_returns_structured_not_found_error():
    db = _db()

    try:
        app_module.redeem_trial_code(
            payload=app_module.TrialCodeRedeemRequest(code="TRY-MISSING"),
            current_user=FakeUser("candidate_1"),
            db=db,
        )
        assert False, "Expected HTTPException for missing trial code"
    except HTTPException as exc:
        assert exc.status_code == 404
        assert exc.detail == {
            "code": "TRIAL_CODE_NOT_FOUND",
            "message": "Trial code not found",
            "retryable": False,
        }


def test_redeem_trial_code_returns_structured_already_redeemed_error():
    db = _db()
    db.add(
        models.TrialCode(
            id="tc_1",
            code="TRY-TAKEN",
            status="REDEEMED",
            duration_minutes=5,
            created_by_clerk_user_id="admin_1",
            redeemed_by_clerk_user_id="candidate_2",
            redeemed_at=datetime.utcnow(),
        )
    )
    db.commit()

    try:
        app_module.redeem_trial_code(
            payload=app_module.TrialCodeRedeemRequest(code="TRY-TAKEN"),
            current_user=FakeUser("candidate_1"),
            db=db,
        )
        assert False, "Expected HTTPException for redeemed trial code"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == {
            "code": "TRIAL_CODE_ALREADY_REDEEMED",
            "message": "Trial code already redeemed",
            "retryable": False,
        }


def test_redeem_trial_code_returns_structured_expired_error():
    db = _db()
    db.add(
        models.TrialCode(
            id="tc_2",
            code="TRY-EXPIRED",
            status="ACTIVE",
            duration_minutes=5,
            expires_at=datetime.utcnow() - timedelta(days=1),
            created_by_clerk_user_id="admin_1",
        )
    )
    db.commit()

    try:
        app_module.redeem_trial_code(
            payload=app_module.TrialCodeRedeemRequest(code="TRY-EXPIRED"),
            current_user=FakeUser("candidate_1"),
            db=db,
        )
        assert False, "Expected HTTPException for expired trial code"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == {
            "code": "TRIAL_CODE_EXPIRED",
            "message": "Trial code expired",
            "retryable": False,
        }


def test_redeem_trial_code_success_returns_entitlement_payload():
    db = _db()
    db.add(
        models.TrialCode(
            id="tc_3",
            code="TRY-READY",
            status="ACTIVE",
            duration_minutes=7,
            created_by_clerk_user_id="admin_1",
        )
    )
    db.commit()

    payload = app_module.redeem_trial_code(
        payload=app_module.TrialCodeRedeemRequest(code="TRY-READY"),
        current_user=FakeUser("candidate_1"),
        db=db,
    )

    assert payload["plan_tier"] == "trial"
    assert payload["duration_minutes_effective"] == 7
    assert payload["is_active"] is True
    assert payload["code"] == "TRY-READY"
