"""Self-hosted authentication endpoints: register, login, logout, refresh, set-password."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from db.database import get_db
from db import models

logger = logging.getLogger(__name__)

router = APIRouter()

# Injected at startup by app.py
_token_service = None
_password_service = None


def configure_auth_dependencies(token_service, password_service):
    global _token_service, _password_service
    _token_service = token_service
    _password_service = password_service


# ── Request / Response schemas ────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class SetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


# ── Helpers ───────────────────────────────────────────────────────────

def _user_dict(user: models.User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_admin": bool(user.is_admin),
        "email_verified": bool(user.email_verified),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _issue_tokens(user: models.User) -> AuthTokenResponse:
    access = _token_service.create_user_token(
        user_id=user.id,
        email=user.email or "",
        is_admin=bool(user.is_admin),
    )
    refresh = _token_service.create_user_refresh_token(user_id=user.id)
    return AuthTokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=_token_service.token_lifetime_seconds,
        user=_user_dict(user),
    )


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthTokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # Validate password strength
    errors = _password_service.validate_strength(body.password)
    if errors:
        raise HTTPException(status_code=422, detail={"code": "WEAK_PASSWORD", "message": " ".join(errors)})

    # Check email uniqueness
    existing = db.query(models.User).filter(
        models.User.email == body.email.lower()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail={"code": "EMAIL_TAKEN", "message": "An account with this email already exists."})

    # Create user
    user_id = str(uuid.uuid4())
    user = models.User(
        id=user_id,
        clerk_user_id=f"self_{user_id}",
        email=body.email.lower(),
        full_name=body.full_name.strip(),
        password_hash=_password_service.hash_password(body.password),
        is_admin=False,
        email_verified=False,
        is_active=True,
        is_deleted=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info("Registered user %s (%s)", user.id, user.email)
    return _issue_tokens(user)


@router.post("/login", response_model=AuthTokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.email == body.email.lower()
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password."})

    if user.is_deleted:
        raise HTTPException(status_code=403, detail={"code": "ACCOUNT_DELETED", "message": "This account has been deleted."})

    if not user.is_active:
        raise HTTPException(status_code=403, detail={"code": "ACCOUNT_DEACTIVATED", "message": "This account has been deactivated."})

    # Clerk migrant: no password set yet
    if not user.password_hash:
        raise HTTPException(status_code=403, detail={
            "code": "PASSWORD_NOT_SET",
            "message": "You haven't set a password yet. Please set one to continue.",
        })

    if not _password_service.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password."})

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    logger.info("Login successful for user %s (%s)", user.id, user.email)
    return _issue_tokens(user)


@router.post("/logout")
def logout(
    body: LogoutRequest = LogoutRequest(),
    authorization: Optional[str] = Header(None),
):
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        _token_service.revoke_token(token)

    if body.refresh_token:
        _token_service.revoke_token(body.refresh_token)

    return {"ok": True}


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = _token_service.validate_token(body.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail={"code": "INVALID_REFRESH", "message": "Invalid or expired refresh token."})

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail={"code": "INVALID_REFRESH", "message": "Not a refresh token."})

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail={"code": "INVALID_REFRESH", "message": "Missing user in token."})

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.is_deleted or not user.is_active:
        raise HTTPException(status_code=401, detail={"code": "INVALID_REFRESH", "message": "User not found or deactivated."})

    # Rotate: revoke old refresh token, issue new pair
    _token_service.revoke_token(body.refresh_token)
    return _issue_tokens(user)


@router.post("/set-password")
def set_password(
    body: SetPasswordRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """For Clerk migrants who have no password yet. Requires a valid access token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header.")

    token = authorization[7:]
    payload = _token_service.validate_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.password_hash:
        raise HTTPException(status_code=409, detail="Password already set. Use forgot-password to change it.")

    errors = _password_service.validate_strength(body.password)
    if errors:
        raise HTTPException(status_code=422, detail={"code": "WEAK_PASSWORD", "message": " ".join(errors)})

    user.password_hash = _password_service.hash_password(body.password)
    db.commit()

    logger.info("Password set for migrated user %s", user.id)
    return {"ok": True}
