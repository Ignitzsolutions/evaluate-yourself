from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.models import Base, User
from backend.db.users import get_or_create_user


def _make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)()


def test_get_or_create_user_does_not_overwrite_another_users_phone():
    db = _make_session()
    try:
        first = get_or_create_user(
            db=db,
            clerk_user_id="user_one",
            email="one@example.com",
            "+919900000001",
        )
        second = get_or_create_user(
            db=db,
            clerk_user_id="user_two",
            email="two@example.com",
        )

        updated_second = get_or_create_user(
            db=db,
            clerk_user_id="user_two",
            "+919900000001",
        )

        db.refresh(first)
        assert first.phone_e164 == "+919900000001"
        assert updated_second.phone_e164 is None
    finally:
        db.close()


def test_get_or_create_user_persists_verified_phone_for_new_user():
    db = _make_session()
    try:
        user = get_or_create_user(
            db=db,
            clerk_user_id="user_three",
            email="three@example.com",
            "+919900000003",
        )

        row = db.query(User).filter(User.clerk_user_id == "user_three").first()

        assert user.phone_e164 == "+919900000003"
        assert row.phone_e164 == "+919900000003"
    finally:
        db.close()
