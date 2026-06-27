"""Tests for refresh-token rotation + reuse detection."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.database import Base
from backend.db import models
from backend.services.auth import refresh_token_store as rts


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[models.RefreshTokenRecord.__table__])
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_issue_and_list(db):
    r1 = rts.issue(db, user_id="u1", device_label="Mac")
    r2 = rts.issue(db, user_id="u1", device_label="Phone")
    sessions = rts.list_active_sessions(db, "u1")
    assert {s.jti for s in sessions} == {r1.jti, r2.jti}


def test_rotate_revokes_old_and_keeps_family(db):
    r1 = rts.issue(db, user_id="u1", device_label="Mac")
    new, err = rts.rotate(db, presented_jti=r1.jti)
    assert err is None
    assert new is not None
    assert new.family_id == r1.family_id
    assert new.parent_jti == r1.jti
    refreshed = db.query(models.RefreshTokenRecord).filter_by(jti=r1.jti).one()
    assert refreshed.revoked_at is not None
    assert refreshed.revoked_reason == "rotated"


def test_reuse_detection_revokes_family(db):
    r1 = rts.issue(db, user_id="u1")
    r2, err = rts.rotate(db, presented_jti=r1.jti)
    assert err is None
    # Attacker replays r1 (already revoked) → should burn the whole family.
    again, err = rts.rotate(db, presented_jti=r1.jti)
    assert again is None
    assert err == "reuse_detected"
    # r2 must now be revoked too.
    r2_now = db.query(models.RefreshTokenRecord).filter_by(jti=r2.jti).one()
    assert r2_now.revoked_at is not None
    assert r2_now.revoked_reason == "reuse_detected"


def test_revoke_unknown_returns_false(db):
    assert rts.revoke(db, "nope") is False


def test_rotate_unknown_returns_not_found(db):
    _new, err = rts.rotate(db, presented_jti="missing")
    assert err == "not_found"
