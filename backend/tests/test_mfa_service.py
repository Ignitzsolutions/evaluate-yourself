"""Tests for the MFA service.

Skipped if pyotp is not installed in the test env.
Uses an in-memory SQLite DB and a stub MFA encryption key.
"""

import os
import pytest

pyotp = pytest.importorskip("pyotp")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.database import Base
from backend.db import models
from backend.services.auth import mfa_service


@pytest.fixture
def db(monkeypatch):
    # Use an isolated in-memory SQLite db with the MFA + User tables created.
    monkeypatch.setenv("MFA_ENCRYPTION_KEY", "test-key-please-change-12345")
    monkeypatch.setenv("ENV", "development")
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[
        models.User.__table__,
        models.UserMFA.__table__,
    ])
    Session = sessionmaker(bind=engine)
    session = Session()
    user = models.User(id="u1", email="u1@example.com", full_name="U One")
    session.add(user)
    session.commit()
    yield session
    session.close()


def test_enroll_and_verify_flow(db):
    uri, secret = mfa_service.begin_enrollment(db, "u1", account_label="u1@example.com")
    assert "otpauth://totp" in uri
    assert len(secret) >= 16
    assert mfa_service.is_enabled(db, "u1") is False

    code = pyotp.TOTP(secret).now()
    ok, recovery = mfa_service.confirm_enrollment(db, "u1", code)
    assert ok is True
    assert len(recovery) == 8
    assert mfa_service.is_enabled(db, "u1") is True

    # Live TOTP verifies.
    live_code = pyotp.TOTP(secret).now()
    assert mfa_service.verify(db, "u1", live_code) is True

    # Wrong code fails.
    assert mfa_service.verify(db, "u1", "000000") is False


def test_recovery_code_consumes_once(db):
    _uri, secret = mfa_service.begin_enrollment(db, "u1")
    _ok, recovery = mfa_service.confirm_enrollment(db, "u1", pyotp.TOTP(secret).now())
    code = recovery[0]
    assert mfa_service.verify(db, "u1", code) is True
    # Same recovery code cannot be reused.
    assert mfa_service.verify(db, "u1", code) is False


def test_disable_clears(db):
    _uri, secret = mfa_service.begin_enrollment(db, "u1")
    mfa_service.confirm_enrollment(db, "u1", pyotp.TOTP(secret).now())
    mfa_service.disable(db, "u1")
    assert mfa_service.is_enabled(db, "u1") is False
