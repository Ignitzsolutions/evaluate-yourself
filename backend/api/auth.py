"""Self-hosted authentication endpoints: register, login, MFA, refresh, sessions, audit."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from db.database import get_db
from db import models
from services.auth import lockout_service, mfa_service, refresh_token_store
from services.auth import audit_log as audit

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
    device_label: Optional[str] = None


class MFALoginRequest(BaseModel):
    mfa_token: str
    code: str


class RefreshRequest(BaseModel):
    refresh_token: str


class SetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)
    setup_token: Optional[str] = None


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class MFAEnrollResponse(BaseModel):
    provisioning_uri: str
    secret: str


class MFAConfirmRequest(BaseModel):
    code: str


class MFAConfirmResponse(BaseModel):
    ok: bool
    recovery_codes: List[str]


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class MFARequiredResponse(BaseModel):
    mfa_required: bool = True
    mfa_token: str


class SessionInfo(BaseModel):
    jti: str
    device_label: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    issued_at: Optional[str]
    last_used_at: Optional[str]
    expires_at: Optional[str]


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


def _client_meta(request: Optional[Request]) -> tuple[Optional[str], Optional[str]]:
    if request is None:
        return None, None
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")) or None
    if ip and "," in ip:
        ip = ip.split(",", 1)[0].strip()
    ua = request.headers.get("user-agent")
    return ip, ua


def _issue_tokens(
    user: models.User,
    db: Session,
    *,
    device_label: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    family_id: Optional[str] = None,
    parent_jti: Optional[str] = None,
) -> AuthTokenResponse:
    access = _token_service.create_user_token(
        user_id=user.id,
        email=user.email or "",
        is_admin=bool(user.is_admin),
    )
    refresh_rec = refresh_token_store.issue(
        db,
        user_id=user.id,
        family_id=family_id,
        parent_jti=parent_jti,
        device_label=device_label,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    refresh = _token_service.create_user_refresh_token(user_id=user.id, jti=refresh_rec.jti)
    return AuthTokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=_token_service.token_lifetime_seconds,
        user=_user_dict(user),
    )


def _require_bearer_user(authorization: Optional[str], db: Session) -> models.User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header.")
    payload = _token_service.validate_token(authorization[7:])
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
    if not user or user.is_deleted or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or deactivated.")
    return user


def _require_password_setup_user(
    *,
    authorization: Optional[str],
    setup_token: Optional[str],
    db: Session,
) -> models.User:
    if authorization and authorization.startswith("Bearer "):
        return _require_bearer_user(authorization, db)

    if not setup_token:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "MISSING_SETUP_TOKEN",
                "message": "Use a valid password setup link to set your password.",
            },
        )

    payload = _token_service.validate_token(setup_token)
    if not payload or payload.get("type") != "password_setup":
        raise HTTPException(
            status_code=401,
            detail={
                "code": "INVALID_SETUP_TOKEN",
                "message": "This password setup link is invalid or expired.",
            },
        )

    user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
    if not user or user.is_deleted or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "INVALID_SETUP_TOKEN",
                "message": "This password setup link is invalid or expired.",
            },
        )
    return user


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthTokenResponse)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    ip, ua = _client_meta(request)
    errors = _password_service.validate_strength(body.password)
    if errors:
        raise HTTPException(status_code=422, detail={"code": "WEAK_PASSWORD", "message": " ".join(errors)})

    existing = db.query(models.User).filter(models.User.email == body.email.lower()).first()
    if existing:
        audit.log_event("register_failure", outcome="failure", email=body.email,
                        ip_address=ip, user_agent=ua, detail={"reason": "email_taken"})
        raise HTTPException(status_code=409, detail={"code": "EMAIL_TAKEN", "message": "An account with this email already exists."})

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

    audit.log_event("register_success", user_id=user.id, email=user.email, ip_address=ip, user_agent=ua)
    logger.info("Registered user %s (%s)", user.id, user.email)
    return _issue_tokens(user, db, ip_address=ip, user_agent=ua)


@router.post("/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip, ua = _client_meta(request)
    email_norm = body.email.lower()

    from services.feature_flags import auth_lockout_enabled as _lo
    lockout_on = _lo()
    if lockout_on:
        locked, ttl = lockout_service.is_locked(email_norm, ip)
        if locked:
            audit.log_event("login_blocked", outcome="failure", email=email_norm,
                            ip_address=ip, user_agent=ua, detail={"seconds_remaining": ttl})
            raise HTTPException(status_code=429, detail={
                "code": "ACCOUNT_LOCKED",
                "message": f"Too many failed attempts. Try again in {ttl} seconds.",
                "retry_after_seconds": ttl,
            })

    user = db.query(models.User).filter(models.User.email == email_norm).first()

    def _fail(reason: str, status: int = 401, code: str = "INVALID_CREDENTIALS", msg: str = "Invalid email or password."):
        locked_now, lock_ttl = (False, 0)
        if lockout_on:
            locked_now, lock_ttl = lockout_service.record_failure(email_norm, ip)
        audit.log_event("login_failure", outcome="failure", email=email_norm, user_id=(user.id if user else None),
                        ip_address=ip, user_agent=ua, detail={"reason": reason, "locked": locked_now})
        if locked_now:
            raise HTTPException(status_code=429, detail={
                "code": "ACCOUNT_LOCKED",
                "message": f"Too many failed attempts. Try again in {lock_ttl} seconds.",
                "retry_after_seconds": lock_ttl,
            })
        raise HTTPException(status_code=status, detail={"code": code, "message": msg})

    if not user:
        _fail("user_not_found")
    if user.is_deleted:
        _fail("account_deleted", status=403, code="ACCOUNT_DELETED", msg="This account has been deleted.")
    if not user.is_active:
        _fail("account_deactivated", status=403, code="ACCOUNT_DEACTIVATED", msg="This account has been deactivated.")
    if not user.password_hash:
        audit.log_event("login_failure", outcome="failure", email=email_norm, user_id=user.id,
                        ip_address=ip, user_agent=ua, detail={"reason": "password_not_set"})
        raise HTTPException(status_code=403, detail={
            "code": "PASSWORD_NOT_SET",
            "message": "You haven't set a password yet. Please set one to continue.",
        })
    if not _password_service.verify_password(body.password, user.password_hash):
        _fail("bad_password")

    # MFA gate
    from services.feature_flags import auth_mfa_enabled, auth_lockout_enabled
    if auth_mfa_enabled() and mfa_service.is_enabled(db, user.id):
        # Issue short-lived MFA challenge token; not a full session token.
        mfa_token = _token_service.create_user_token(user_id=user.id, email=user.email or "", is_admin=False)
        audit.log_event("mfa_challenge", user_id=user.id, email=user.email, ip_address=ip, user_agent=ua)
        return MFARequiredResponse(mfa_token=mfa_token)

    # Admin without MFA: force enrollment by responding with a marker.
    if auth_mfa_enabled() and user.is_admin and not mfa_service.is_enabled(db, user.id):
        mfa_token = _token_service.create_user_token(user_id=user.id, email=user.email or "", is_admin=True)
        audit.log_event("login_admin_mfa_required", user_id=user.id, email=user.email, ip_address=ip, user_agent=ua)
        # Return same shape as MFA challenge but with mfa_enroll_required hint.
        return {"mfa_required": True, "mfa_enroll_required": True, "mfa_token": mfa_token}

    lockout_service.clear(email_norm, ip)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    audit.log_event("login_success", user_id=user.id, email=user.email, ip_address=ip, user_agent=ua)
    return _issue_tokens(user, db, device_label=body.device_label, ip_address=ip, user_agent=ua)


@router.post("/login/mfa", response_model=AuthTokenResponse)
def login_mfa(body: MFALoginRequest, request: Request, db: Session = Depends(get_db)):
    ip, ua = _client_meta(request)
    payload = _token_service.validate_token(body.mfa_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail={"code": "INVALID_MFA_TOKEN", "message": "Invalid MFA challenge."})
    user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail={"code": "INVALID_MFA_TOKEN", "message": "User not found."})

    if not mfa_service.is_enabled(db, user.id):
        raise HTTPException(status_code=400, detail={"code": "MFA_NOT_ENROLLED", "message": "MFA is not enabled for this account."})

    if not mfa_service.verify(db, user.id, body.code):
        audit.log_event("mfa_fail", outcome="failure", user_id=user.id, email=user.email,
                        ip_address=ip, user_agent=ua)
        lockout_service.record_failure((user.email or "").lower(), ip)
        raise HTTPException(status_code=401, detail={"code": "INVALID_MFA_CODE", "message": "Invalid MFA code."})

    lockout_service.clear((user.email or "").lower(), ip)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    audit.log_event("mfa_pass", user_id=user.id, email=user.email, ip_address=ip, user_agent=ua)
    return _issue_tokens(user, db, ip_address=ip, user_agent=ua)


@router.post("/logout")
def logout(
    request: Request,
    body: LogoutRequest = LogoutRequest(),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    ip, ua = _client_meta(request)
    user_id: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        payload = _token_service.validate_token(token)
        if payload:
            user_id = payload.get("sub")
        _token_service.revoke_token(token)

    if body.refresh_token:
        rpayload = _token_service.validate_token(body.refresh_token)
        if rpayload and rpayload.get("jti"):
            refresh_token_store.revoke(db, rpayload["jti"], reason="logout")
        _token_service.revoke_token(body.refresh_token)

    audit.log_event("logout", user_id=user_id, ip_address=ip, user_agent=ua)
    return {"ok": True}


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh(body: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    ip, ua = _client_meta(request)
    payload = _token_service.validate_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail={"code": "INVALID_REFRESH", "message": "Invalid or expired refresh token."})

    user_id = payload.get("sub")
    jti = payload.get("jti")
    if not user_id or not jti:
        raise HTTPException(status_code=401, detail={"code": "INVALID_REFRESH", "message": "Malformed refresh token."})

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.is_deleted or not user.is_active:
        raise HTTPException(status_code=401, detail={"code": "INVALID_REFRESH", "message": "User not found or deactivated."})

    new_rec, err = refresh_token_store.rotate(db, presented_jti=jti, ip_address=ip, user_agent=ua)
    if err is not None:
        audit.log_event("refresh_failure", outcome="failure", user_id=user_id,
                        ip_address=ip, user_agent=ua, detail={"reason": err})
        # Always revoke the presented JWT regardless of reason.
        _token_service.revoke_token(body.refresh_token)
        raise HTTPException(status_code=401, detail={"code": "INVALID_REFRESH", "message": "Refresh rejected."})

    # Old JWT is now revoked DB-side; also blocklist it in the token service.
    _token_service.revoke_token(body.refresh_token)

    access = _token_service.create_user_token(user_id=user.id, email=user.email or "", is_admin=bool(user.is_admin))
    refresh_jwt = _token_service.create_user_refresh_token(user_id=user.id, jti=new_rec.jti)
    audit.log_event("refresh_success", user_id=user.id, ip_address=ip, user_agent=ua)
    return AuthTokenResponse(
        access_token=access,
        refresh_token=refresh_jwt,
        expires_in=_token_service.token_lifetime_seconds,
        user=_user_dict(user),
    )


@router.post("/set-password")
def set_password(
    body: SetPasswordRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """For migrated users who have no password yet.

    Accepts either an authenticated bearer session or a short-lived setup token.
    Login must not mint this token from email alone, because that would let
    anyone who knows a migrated user's email claim the account.
    """
    ip, ua = _client_meta(request)
    user = _require_password_setup_user(
        authorization=authorization,
        setup_token=body.setup_token,
        db=db,
    )

    if user.password_hash:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "PASSWORD_ALREADY_SET",
                "message": "Password already set. Use forgot-password to change it.",
            },
        )

    errors = _password_service.validate_strength(body.password)
    if errors:
        raise HTTPException(status_code=422, detail={"code": "WEAK_PASSWORD", "message": " ".join(errors)})

    user.password_hash = _password_service.hash_password(body.password)
    db.commit()
    if body.setup_token:
        _token_service.revoke_token(body.setup_token)
    audit.log_event("password_set", user_id=user.id, email=user.email, ip_address=ip, user_agent=ua)
    return {"ok": True}


# ── MFA management ────────────────────────────────────────────────────

@router.post("/mfa/enroll", response_model=MFAEnrollResponse)
def mfa_enroll(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    ip, ua = _client_meta(request)
    user = _require_bearer_user(authorization, db)
    uri, secret = mfa_service.begin_enrollment(db, user.id, account_label=user.email or user.id)
    audit.log_event("mfa_enroll_begin", user_id=user.id, email=user.email, ip_address=ip, user_agent=ua)
    return MFAEnrollResponse(provisioning_uri=uri, secret=secret)


@router.post("/mfa/confirm", response_model=MFAConfirmResponse)
def mfa_confirm(
    body: MFAConfirmRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    ip, ua = _client_meta(request)
    user = _require_bearer_user(authorization, db)
    ok, recovery = mfa_service.confirm_enrollment(db, user.id, body.code)
    audit.log_event(
        "mfa_enroll_confirm",
        outcome="success" if ok else "failure",
        user_id=user.id, email=user.email, ip_address=ip, user_agent=ua,
    )
    if not ok:
        raise HTTPException(status_code=400, detail={"code": "INVALID_MFA_CODE", "message": "Code did not match."})
    return MFAConfirmResponse(ok=True, recovery_codes=recovery)


@router.post("/mfa/disable")
def mfa_disable(
    body: MFAConfirmRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    ip, ua = _client_meta(request)
    user = _require_bearer_user(authorization, db)
    if not mfa_service.is_enabled(db, user.id):
        return {"ok": True}
    if not mfa_service.verify(db, user.id, body.code):
        raise HTTPException(status_code=401, detail={"code": "INVALID_MFA_CODE", "message": "Invalid MFA code."})
    if user.is_admin:
        raise HTTPException(status_code=403, detail={"code": "ADMIN_MFA_REQUIRED", "message": "Admins must keep MFA enabled."})
    mfa_service.disable(db, user.id)
    audit.log_event("mfa_disable", user_id=user.id, email=user.email, ip_address=ip, user_agent=ua)
    return {"ok": True}


@router.get("/mfa/status")
def mfa_status(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user = _require_bearer_user(authorization, db)
    return {"enabled": mfa_service.is_enabled(db, user.id), "required": bool(user.is_admin)}


# ── Session (refresh-token) management ────────────────────────────────

@router.get("/sessions")
def list_sessions(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user = _require_bearer_user(authorization, db)
    recs = refresh_token_store.list_active_sessions(db, user.id)
    return {
        "items": [
            SessionInfo(
                jti=r.jti,
                device_label=r.device_label,
                ip_address=r.ip_address,
                user_agent=r.user_agent,
                issued_at=r.issued_at.isoformat() if r.issued_at else None,
                last_used_at=r.last_used_at.isoformat() if r.last_used_at else None,
                expires_at=r.expires_at.isoformat() if r.expires_at else None,
            ).model_dump()
            for r in recs
        ]
    }


@router.delete("/sessions/{jti}")
def revoke_session(
    jti: str,
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    ip, ua = _client_meta(request)
    user = _require_bearer_user(authorization, db)
    rec = db.query(models.RefreshTokenRecord).filter(models.RefreshTokenRecord.jti == jti).first()
    if rec is None or rec.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found.")
    refresh_token_store.revoke(db, jti, reason="user_revoke")
    audit.log_event("session_revoke", user_id=user.id, email=user.email, ip_address=ip, user_agent=ua,
                    detail={"jti": jti})
    return {"ok": True}
