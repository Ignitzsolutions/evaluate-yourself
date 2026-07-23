from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.api import auth as auth_module
from db import models
from db.database import Base, get_db
from backend.services.auth.password_service import PasswordService
from backend.services.auth.token_service import TokenService


def test_refresh_token_moves_to_httponly_cookie_and_requires_csrf_for_cookie_refresh():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    auth_module.configure_auth_dependencies(
        TokenService(secret_key="test-secret-key-that-is-long-enough"),
        PasswordService(),
    )

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.dependency_overrides[get_db] = override_get_db
    app.include_router(auth_module.router, prefix="/api/auth")
    client = TestClient(app)

    try:
        register = client.post(
            "/api/auth/register",
            json={
                "email": "cookie@example.com",
                "password": "Password1",
                "full_name": "Cookie User",
            },
        )
        assert register.status_code == 200
        body = register.json()
        assert body["access_token"]
        assert body["refresh_token"] is None
        assert body["csrf_token"]
        assert "ey_refresh_token" in register.cookies

        rejected = client.post("/api/auth/refresh", json={})
        assert rejected.status_code == 403

        refreshed = client.post(
            "/api/auth/refresh",
            headers={"X-CSRF-Token": body["csrf_token"]},
            json={},
        )
        assert refreshed.status_code == 200
        refreshed_body = refreshed.json()
        assert refreshed_body["access_token"]
        assert refreshed_body["refresh_token"] is None
        assert refreshed_body["csrf_token"]

        logout = client.post(
            "/api/auth/logout",
            headers={"X-CSRF-Token": refreshed_body["csrf_token"]},
            json={},
        )
        assert logout.status_code == 200
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
