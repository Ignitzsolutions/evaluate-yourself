import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api import auth
from db import models
from db.database import Base, get_db
from services.auth.password_service import PasswordService
from services.auth.token_service import TokenService


def _client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    token_service = TokenService(secret_key="test-secret-key-for-password-setup-flow")
    password_service = PasswordService()
    auth.configure_auth_dependencies(token_service, password_service)

    app = FastAPI()
    app.include_router(auth.router, prefix="/api/auth")
    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app), TestingSessionLocal, token_service, password_service


def _passwordless_user(db):
    user = models.User(
        id=str(uuid.uuid4()),
        clerk_user_id=f"self_{uuid.uuid4()}",
        email=f"user-{uuid.uuid4()}@example.com",
        full_name="Passwordless User",
        password_hash=None,
        is_active=True,
        is_deleted=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_set_password_requires_setup_token_or_bearer():
    client, SessionLocal, _, _ = _client()
    with SessionLocal() as db:
        _passwordless_user(db)

    response = client.post("/api/auth/set-password", json={"password": "NewPass123"})

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "MISSING_SETUP_TOKEN"


def test_login_password_not_set_does_not_mint_setup_token():
    client, SessionLocal, _, _ = _client()
    with SessionLocal() as db:
        user = _passwordless_user(db)

    response = client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "Anything123"},
    )

    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["code"] == "PASSWORD_NOT_SET"
    assert "setup_token" not in detail


def test_set_password_with_password_setup_token_hashes_password_and_blocks_reuse():
    client, SessionLocal, token_service, password_service = _client()
    with SessionLocal() as db:
        user = _passwordless_user(db)
        setup_token = token_service.create_password_setup_token(user.id, user.email)

    response = client.post(
        "/api/auth/set-password",
        json={"password": "NewPass123", "setup_token": setup_token},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}

    with SessionLocal() as db:
        refreshed = db.query(models.User).filter(models.User.id == user.id).one()
        assert refreshed.password_hash
        assert password_service.verify_password("NewPass123", refreshed.password_hash)

    second_response = client.post(
        "/api/auth/set-password",
        json={"password": "OtherPass123", "setup_token": setup_token},
    )

    assert second_response.status_code == 409
    assert second_response.json()["detail"]["code"] == "PASSWORD_ALREADY_SET"


def test_set_password_rejects_access_token_as_setup_token():
    client, SessionLocal, token_service, _ = _client()
    with SessionLocal() as db:
        user = _passwordless_user(db)
        access_token = token_service.create_user_token(user.id, user.email)

    response = client.post(
        "/api/auth/set-password",
        json={"password": "NewPass123", "setup_token": access_token},
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "INVALID_SETUP_TOKEN"
