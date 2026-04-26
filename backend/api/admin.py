"""Admin APIs for candidate management, trial codes, and storage visibility."""

from __future__ import annotations

from collections import Counter
import csv
import io
import json
import os
import re
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from fastapi.params import Param
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, func, inspect, or_
from sqlalchemy.orm import Session

try:
    from db import models
    from db.database import get_db
    from config.eval_flags import EVAL_FLAGS
    from services.interview.admin_question_bank import (
        builtin_question_exists,
        get_effective_track_map,
        is_system_track_id,
        list_effective_track_questions,
        list_effective_tracks,
        track_question_counts,
    )
except Exception:  # pragma: no cover
    from backend.db import models  # type: ignore
    from backend.db.database import get_db  # type: ignore
    from backend.config.eval_flags import EVAL_FLAGS  # type: ignore
    from backend.services.interview.admin_question_bank import (  # type: ignore
        builtin_question_exists,
        get_effective_track_map,
        is_system_track_id,
        list_effective_track_questions,
        list_effective_tracks,
        track_question_counts,
    )


router = APIRouter()

_get_current_user_func: Optional[Callable[..., Any]] = None
_is_admin_func: Optional[Callable[[str], bool]] = None
TRIAL_SUFFIX_PATTERN = re.compile(r"^[A-Z0-9]{2,12}$")


def configure_admin_dependencies(
    *,
    get_current_user_func: Callable[..., Any],
    is_admin_func: Callable[[str], bool],
) -> None:
    """Set runtime dependencies from app bootstrap to avoid circular imports."""
    global _get_current_user_func, _is_admin_func
    _get_current_user_func = get_current_user_func
    _is_admin_func = is_admin_func


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_utc_naive(value: Optional[datetime]) -> Optional[datetime]:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _require_bootstrap() -> None:
    if not _get_current_user_func or not _is_admin_func:
        raise HTTPException(status_code=500, detail="Admin router not initialized")


def _is_entitlement_active(entitlement: models.UserEntitlement) -> bool:
    now = _utcnow()
    if not entitlement.is_active:
        return False
    if entitlement.revoked_at is not None:
        return False
    if entitlement.expires_at and entitlement.expires_at < now:
        return False
    return True


def _ensure_not_expired_trial_code(code: models.TrialCode) -> None:
    if code.status in {"DELETED", "REVOKED"}:
        return
    if code.expires_at and code.expires_at < _utcnow():
        code.status = "EXPIRED"


def _get_admin_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
):
    _require_bootstrap()
    user = _get_current_user_func(authorization=authorization, db=db)
    current_subject = getattr(user, "auth_provider_user_id", None)
    if not (_is_admin_func(user.clerk_user_id) or (current_subject and _is_admin_func(str(current_subject)))):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _get_active_entitlement(db: Session, clerk_user_id: str) -> Optional[models.UserEntitlement]:
    entitlements = db.query(models.UserEntitlement).filter(
        models.UserEntitlement.clerk_user_id == clerk_user_id,
        models.UserEntitlement.is_active == True,  # noqa: E712
    ).order_by(models.UserEntitlement.created_at.desc()).all()
    for entitlement in entitlements:
        if _is_entitlement_active(entitlement):
            return entitlement
    return None


def _revoke_active_entitlements(db: Session, clerk_user_id: str, when: Optional[datetime] = None) -> int:
    revoked_at = when or _utcnow()
    rows = db.query(models.UserEntitlement).filter(
        models.UserEntitlement.clerk_user_id == clerk_user_id,
        models.UserEntitlement.is_active == True,  # noqa: E712
    ).all()
    count = 0
    for row in rows:
        row.is_active = False
        row.revoked_at = revoked_at
        count += 1
    return count


def _generate_trial_code(db: Session, code_suffix: Optional[str] = None) -> str:
    alphabet = string.ascii_uppercase + string.digits
    normalized_suffix = _normalize_trial_code_suffix(code_suffix)
    for _ in range(20):
        token = "TRY-" + "".join(secrets.choice(alphabet) for _ in range(8))
        if normalized_suffix:
            token = f"{token}-{normalized_suffix}"
        exists = db.query(models.TrialCode).filter(models.TrialCode.code == token).first()
        if not exists:
            return token
    fallback = "TRY-" + uuid.uuid4().hex[:8].upper()
    if normalized_suffix:
        fallback = f"{fallback}-{normalized_suffix}"
    return fallback


def _json_loads_safe(raw: Optional[str]) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def _db_engine_name(db: Session) -> str:
    try:
        bind = db.get_bind()
        if bind is not None and getattr(bind, "dialect", None) is not None:
            name = str(getattr(bind.dialect, "name", "") or "").strip().lower()
            if name:
                return name
    except Exception:
        pass
    return "unknown"


def _ensure_trial_code_schema(db: Session) -> None:
    """Fail with an actionable message when trial-code schema migrations are missing."""
    try:
        bind = db.get_bind()
        if bind is None:
            return
        inspector = inspect(bind)
        columns = {col.get("name") for col in inspector.get_columns("trial_codes")}
    except Exception:
        # Let downstream query errors surface if inspection isn't available.
        return
    required_columns = {"display_name", "code_suffix"}
    missing = sorted(col for col in required_columns if col not in columns)
    if missing:
        missing_text = ", ".join(missing)
        raise HTTPException(
            status_code=503,
            detail=(
                f"Database schema is out of date for trial_codes (missing: {missing_text}). "
                "Run database migrations: alembic -c backend/alembic.ini upgrade head"
            ),
        )


def _table_names_safe(db: Session) -> set[str]:
    try:
        bind = db.get_bind()
        if bind is None:
            return set()
        return {str(name) for name in inspect(bind).get_table_names()}
    except Exception:
        return set()


def _optional_table_flags(db: Session) -> Dict[str, bool]:
    table_names = _table_names_safe(db)
    return {
        "launch_waitlist_signups": "launch_waitlist_signups" in table_names,
        "trial_feedback": "trial_feedback" in table_names,
    }


def _normalize_trial_code_suffix(raw_suffix: Optional[str]) -> Optional[str]:
    if raw_suffix is None:
        return None
    suffix = str(raw_suffix).strip().upper()
    if not suffix:
        return None
    if not TRIAL_SUFFIX_PATTERN.match(suffix):
        raise HTTPException(
            status_code=422,
            detail="Invalid code_suffix. Use 2-12 chars, uppercase A-Z and 0-9 only.",
        )
    return suffix


def _normalize_trial_code_display_name(raw_name: Optional[str]) -> Optional[str]:
    if raw_name is None:
        return None
    value = str(raw_name).strip()
    if not value:
        return None
    if len(value) > 80:
        raise HTTPException(status_code=422, detail="display_name must be 80 characters or fewer.")
    return value


def _login_recency(last_login_at: Optional[datetime], now: Optional[datetime] = None) -> str:
    normalized_last_login_at = _normalize_utc_naive(last_login_at)
    if normalized_last_login_at is None:
        return "stale"
    current = _normalize_utc_naive(now) or _utcnow()
    if normalized_last_login_at >= current - timedelta(hours=24):
        return "today"
    if normalized_last_login_at >= current - timedelta(days=7):
        return "7d"
    if normalized_last_login_at >= current - timedelta(days=30):
        return "30d"
    return "stale"


def _top_counter_items(counter: Counter, limit: int = 10) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for key, count in counter.most_common(limit):
        if not key:
            continue
        out.append({"key": str(key), "count": int(count)})
    return out


def _safe_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _normalize_distribution_key(value: Optional[str]) -> str:
    normalized = str(value or "").strip().lower()
    return normalized or "unknown"


def _query_arg_or_default(value: Any, default: Any) -> Any:
    """Return plain argument values when called directly (outside FastAPI request context)."""
    if isinstance(value, Param):
        return default
    return value


def _safe_string(value: Any) -> str:
    text = str(value or "").strip()
    return text


def _safe_json_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        parsed = _json_loads_safe(value)
        if isinstance(parsed, list):
            return parsed
    return []


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _active_user_ids(
    db: Session,
    now: datetime,
    window_minutes: int = 15,
) -> tuple[set[str], set[str], set[str]]:
    safe_window = max(1, int(window_minutes))
    window_start = now - timedelta(minutes=safe_window)
    active_session_user_ids = {
        str(row[0])
        for row in db.query(models.InterviewSession.clerk_user_id)
        .filter(models.InterviewSession.status == "ACTIVE")
        .distinct()
        .all()
        if row and row[0]
    }
    recent_login_user_ids = {
        str(row[0])
        for row in db.query(models.User.clerk_user_id)
        .filter(
            models.User.is_deleted == False,  # noqa: E712
            models.User.last_login_at.isnot(None),
            models.User.last_login_at >= window_start,
        )
        .all()
        if row and row[0]
    }
    active_any = active_session_user_ids | recent_login_user_ids
    return active_any, active_session_user_ids, recent_login_user_ids


def _extract_preinterview_from_session(session_row: Optional[models.InterviewSession]) -> Optional[Dict[str, Any]]:
    if not session_row:
        return None
    meta = _json_loads_safe(session_row.session_meta_json) or {}
    return {
        "session_id": session_row.session_id,
        "interview_type": session_row.interview_type or meta.get("interview_type"),
        "difficulty": session_row.difficulty or meta.get("difficulty"),
        "duration_minutes_requested": session_row.duration_minutes_requested or meta.get("duration_minutes_requested"),
        "duration_minutes_effective": session_row.duration_minutes_effective or meta.get("duration_minutes_effective"),
        "role": meta.get("role"),
        "company": meta.get("company"),
        "question_mix": meta.get("question_mix"),
        "interview_style": meta.get("interview_style"),
        "plan_tier": meta.get("plan_tier"),
        "selected_skills": _safe_json_list(meta.get("selected_skills")),
        "started_at": session_row.started_at,
        "ended_at": session_row.ended_at,
        "status": session_row.status,
    }


def _profile_to_payload(profile: Optional[models.UserProfile]) -> Optional[Dict[str, Any]]:
    if not profile:
        return None
    return {
        "user_category": profile.user_category,
        "primary_goal": profile.primary_goal,
        "target_roles": _json_loads_safe(profile.target_roles) or [],
        "industries": _json_loads_safe(profile.industries) or [],
        "interview_timeline": profile.interview_timeline,
        "prep_intensity": profile.prep_intensity,
        "learning_style": profile.learning_style,
        "consent_data_use": bool(profile.consent_data_use),
        "education_level": profile.education_level,
        "graduation_timeline": profile.graduation_timeline,
        "major_domain": profile.major_domain,
        "placement_readiness": profile.placement_readiness,
        "current_role": profile.current_role,
        "experience_band": profile.experience_band,
        "management_scope": profile.management_scope,
        "domain_expertise": _json_loads_safe(profile.domain_expertise) or [],
        "target_company_type": profile.target_company_type,
        "career_transition_intent": profile.career_transition_intent,
        "notice_period_band": profile.notice_period_band,
        "career_comp_band": profile.career_comp_band,
        "interview_urgency": profile.interview_urgency,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


def _sync_user_from_clerk_if_missing(db: Session, user: models.User) -> bool:
    """No-op: Clerk profile sync removed. User data is self-managed now."""
    return False


class TrialCodeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    duration_minutes: int = Field(default=5, ge=1, le=120)
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=90)
    display_name: Optional[str] = None
    note: Optional[str] = None
    code_suffix: Optional[str] = None


class CandidateBulkActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    clerk_user_ids: List[str] = Field(default_factory=list)
    action: str


class TrialCodeBulkDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code_ids: List[str] = Field(default_factory=list)


@router.get("/summary")
def admin_summary(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    now = _utcnow()
    window_24h = now - timedelta(hours=24)
    window_7d = now - timedelta(days=7)
    window_30d = now - timedelta(days=30)
    total_candidates = db.query(models.User).count()
    active_candidates = db.query(models.User).filter(
        models.User.is_active == True,  # noqa: E712
        models.User.is_deleted == False,  # noqa: E712
    ).count()
    registered_24h = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.created_at >= window_24h,
    ).scalar() or 0
    logged_in_24h = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.last_login_at.isnot(None),
        models.User.last_login_at >= window_24h,
    ).scalar() or 0
    logged_in_7d = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.last_login_at.isnot(None),
        models.User.last_login_at >= window_7d,
    ).scalar() or 0
    logged_in_30d = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.last_login_at.isnot(None),
        models.User.last_login_at >= window_30d,
    ).scalar() or 0
    active_trials = db.query(models.UserEntitlement).filter(
        models.UserEntitlement.is_active == True,  # noqa: E712
        or_(models.UserEntitlement.expires_at.is_(None), models.UserEntitlement.expires_at >= now),
    ).count()
    optional_tables = _optional_table_flags(db)
    waitlist_signups = 0
    if optional_tables["launch_waitlist_signups"]:
        waitlist_signups = db.query(func.count(models.LaunchWaitlistSignup.id)).filter(
            models.LaunchWaitlistSignup.status == "ACTIVE"
        ).scalar() or 0
    feedback_total = 0
    feedback_avg_rating = 0
    if optional_tables["trial_feedback"]:
        feedback_total = db.query(func.count(models.TrialFeedback.id)).scalar() or 0
        feedback_avg_rating = db.query(func.avg(models.TrialFeedback.rating)).scalar() or 0
    total_sessions = db.query(models.InterviewSession).count()
    total_reports = db.query(models.InterviewReport).count()
    avg_score = db.query(func.avg(models.InterviewReport.overall_score)).scalar() or 0
    db_ok = True
    try:
        db.query(models.User.id).limit(1).all()
    except Exception:
        db_ok = False

    return {
        "total_candidates": total_candidates,
        "active_candidates": active_candidates,
        "active_trials": active_trials,
        "waitlist_signups": int(waitlist_signups),
        "trial_feedback_count": int(feedback_total),
        "trial_feedback_avg_rating": round(float(feedback_avg_rating or 0), 2),
        "total_sessions": total_sessions,
        "total_reports": total_reports,
        "avg_score": int(round(float(avg_score or 0))),
        "db_health": "up" if db_ok else "down",
        "db_engine": _db_engine_name(db),
        "registered_24h": int(registered_24h),
        "logged_in_24h": int(logged_in_24h),
        "logged_in_7d": int(logged_in_7d),
        "logged_in_30d": int(logged_in_30d),
    }


@router.get("/candidates")
def list_candidates(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=250),
    q: Optional[str] = Query(None),
    status: str = Query("all"),
):
    query = db.query(models.User)
    status_normalized = str(status or "all").strip().lower()
    if status_normalized == "active":
        query = query.filter(models.User.is_deleted == False)  # noqa: E712
    elif status_normalized == "deleted":
        query = query.filter(models.User.is_deleted == True)  # noqa: E712
    elif status_normalized == "inactive":
        query = query.filter(
            models.User.is_deleted == False,  # noqa: E712
            models.User.is_active == False,  # noqa: E712
        )

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.User.email.ilike(like),
                models.User.full_name.ilike(like),
                models.User.clerk_user_id.ilike(like),
                models.User.phone_e164.ilike(like),
            )
        )

    total = query.count()
    users = query.order_by(models.User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    any_user_changed = False
    for user in users:
        if _sync_user_from_clerk_if_missing(db, user):
            any_user_changed = True
    if any_user_changed:
        db.commit()

    rows: List[Dict[str, Any]] = []
    for user in users:
        profile = db.query(models.UserProfile).filter(
            models.UserProfile.clerk_user_id == user.clerk_user_id
        ).first()
        profile_completed = profile is not None
        session_count = db.query(func.count(models.InterviewSession.id)).filter(
            models.InterviewSession.clerk_user_id == user.clerk_user_id
        ).scalar() or 0
        latest_session = db.query(models.InterviewSession).filter(
            models.InterviewSession.clerk_user_id == user.clerk_user_id
        ).order_by(models.InterviewSession.started_at.desc()).first()
        latest_preinterview = _extract_preinterview_from_session(latest_session)
        report_count = db.query(func.count(models.InterviewReport.id)).filter(
            models.InterviewReport.user_id == user.clerk_user_id
        ).scalar() or 0
        latest_report = db.query(models.InterviewReport).filter(
            models.InterviewReport.user_id == user.clerk_user_id
        ).order_by(models.InterviewReport.date.desc()).first()
        entitlement = _get_active_entitlement(db, user.clerk_user_id)
        rows.append(
            {
                "clerk_user_id": user.clerk_user_id,
                "email": user.email,
                "phone_e164": user.phone_e164,
                "full_name": user.full_name,
                "is_active": bool(user.is_active),
                "is_deleted": bool(user.is_deleted),
                "created_at": user.created_at,
                "last_login_at": user.last_login_at,
                "login_recency": _login_recency(user.last_login_at),
                "profile_completed": profile_completed,
                "profile_primary_goal": profile.primary_goal if profile else None,
                "profile_target_roles": (_json_loads_safe(profile.target_roles) or []) if profile else [],
                "profile_domain_expertise": (_json_loads_safe(profile.domain_expertise) or []) if profile else [],
                "session_count": int(session_count),
                "report_count": int(report_count),
                "latest_score": latest_report.overall_score if latest_report else None,
                "latest_report_date": latest_report.date if latest_report else None,
                "latest_session_started_at": latest_session.started_at if latest_session else None,
                "latest_session_status": latest_session.status if latest_session else None,
                "latest_interview_type": latest_session.interview_type if latest_session else None,
                "primary_goal": profile.primary_goal if profile else None,
                "current_role": profile.current_role if profile else None,
                "target_roles": (_json_loads_safe(profile.target_roles) or []) if profile else [],
                "latest_preinterview": latest_preinterview,
                "latest_role": latest_preinterview.get("role") if latest_preinterview else None,
                "latest_company": latest_preinterview.get("company") if latest_preinterview else None,
                "latest_selected_skills": latest_preinterview.get("selected_skills") if latest_preinterview else [],
                "latest_plan_tier": latest_preinterview.get("plan_tier") if latest_preinterview else None,
                "current_entitlement": (
                    {
                        "plan_tier": entitlement.plan_tier,
                        "expires_at": entitlement.expires_at,
                        "is_active": entitlement.is_active,
                    }
                    if entitlement
                    else None
                ),
            }
        )

    return {
        "items": rows,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/candidates/{clerk_user_id}")
def candidate_detail(
    clerk_user_id: str,
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.clerk_user_id == clerk_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if _sync_user_from_clerk_if_missing(db, user):
        db.commit()
        db.refresh(user)

    profile = db.query(models.UserProfile).filter(models.UserProfile.clerk_user_id == clerk_user_id).first()
    sessions = db.query(models.InterviewSession).filter(
        models.InterviewSession.clerk_user_id == clerk_user_id
    ).order_by(models.InterviewSession.started_at.desc()).limit(20).all()
    reports = db.query(models.InterviewReport).filter(
        models.InterviewReport.user_id == clerk_user_id
    ).order_by(models.InterviewReport.date.desc()).limit(20).all()
    entitlements = db.query(models.UserEntitlement).filter(
        models.UserEntitlement.clerk_user_id == clerk_user_id
    ).order_by(models.UserEntitlement.created_at.desc()).all()

    trial_codes = []
    for entitlement in entitlements:
        code = db.query(models.TrialCode).filter(models.TrialCode.id == entitlement.source_id).first()
        trial_codes.append(
            {
                "entitlement_id": entitlement.id,
                "is_active": entitlement.is_active,
                "plan_tier": entitlement.plan_tier,
                "starts_at": entitlement.starts_at,
                "expires_at": entitlement.expires_at,
                "revoked_at": entitlement.revoked_at,
                "trial_code_display_name": code.display_name if code else None,
                "trial_code": code.code if code else None,
                "trial_code_suffix": code.code_suffix if code else None,
                "trial_code_status": code.status if code else None,
            }
        )

    profile_payload = _profile_to_payload(profile)
    latest_preinterview = _extract_preinterview_from_session(sessions[0] if sessions else None)

    return {
        "candidate": {
            "clerk_user_id": user.clerk_user_id,
            "email": user.email,
            "phone_e164": user.phone_e164,
            "full_name": user.full_name,
            "is_active": bool(user.is_active),
            "is_deleted": bool(user.is_deleted),
            "created_at": user.created_at,
            "last_login_at": user.last_login_at,
        },
        "profile": profile_payload,
        "latest_preinterview": latest_preinterview,
        "sessions": [
            {
                "session_id": s.session_id,
                "status": s.status,
                "interview_type": s.interview_type,
                "difficulty": s.difficulty,
                "duration_minutes_requested": s.duration_minutes_requested,
                "duration_minutes_effective": s.duration_minutes_effective,
                "started_at": s.started_at,
                "ended_at": s.ended_at,
                "report_id": s.report_id,
                "preinterview": _extract_preinterview_from_session(s),
            }
            for s in sessions
        ],
        "reports": [
            {
                "id": r.id,
                "session_id": r.session_id,
                "date": r.date,
                "overall_score": r.overall_score,
                "type": r.type,
                "mode": r.mode,
                "questions": r.questions,
            }
            for r in reports
        ],
        "trial_history": trial_codes,
    }


def _deactivate_candidate_record(db: Session, user: models.User, when: Optional[datetime] = None) -> Dict[str, Any]:
    now = when or _utcnow()
    user.is_active = False
    revoked_count = _revoke_active_entitlements(db, user.clerk_user_id, when=now)
    return {
        "clerk_user_id": user.clerk_user_id,
        "is_active": False,
        "revoked_entitlements": revoked_count,
    }


def _soft_delete_candidate_record(db: Session, user: models.User, when: Optional[datetime] = None) -> Dict[str, Any]:
    now = when or _utcnow()
    user.is_active = False
    user.is_deleted = True
    user.deleted_at = now
    revoked_count = _revoke_active_entitlements(db, user.clerk_user_id, when=now)
    return {
        "clerk_user_id": user.clerk_user_id,
        "is_deleted": True,
        "deleted_at": now,
        "revoked_entitlements": revoked_count,
    }


def _delete_trial_code_record(db: Session, trial_code: models.TrialCode, when: Optional[datetime] = None) -> Dict[str, Any]:
    now = when or _utcnow()
    trial_code.status = "DELETED"
    trial_code.deleted_at = now
    trial_code.revoked_at = now

    revoked = 0
    entitlements = db.query(models.UserEntitlement).filter(
        models.UserEntitlement.source_id == trial_code.id,
        models.UserEntitlement.is_active == True,  # noqa: E712
    ).all()
    for entitlement in entitlements:
        entitlement.is_active = False
        entitlement.revoked_at = now
        revoked += 1

    return {"code_id": trial_code.id, "status": "DELETED", "revoked_entitlements": revoked}


@router.post("/candidates/{clerk_user_id}/deactivate")
def deactivate_candidate(
    clerk_user_id: str,
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.clerk_user_id == clerk_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")
    payload = _deactivate_candidate_record(db, user)
    db.commit()
    return payload


@router.delete("/candidates/{clerk_user_id}")
def soft_delete_candidate(
    clerk_user_id: str,
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.clerk_user_id == clerk_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")
    payload = _soft_delete_candidate_record(db, user)
    db.commit()
    return payload


@router.post("/candidates/bulk-action")
def bulk_candidate_action(
    payload: CandidateBulkActionRequest,
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    action = str(payload.action or "").strip().lower()
    if action not in {"deactivate", "delete"}:
        raise HTTPException(status_code=422, detail="action must be 'deactivate' or 'delete'.")
    clerk_user_ids = []
    seen_ids = set()
    for raw_id in payload.clerk_user_ids or []:
        value = str(raw_id or "").strip()
        if not value or value in seen_ids:
            continue
        seen_ids.add(value)
        clerk_user_ids.append(value)
    if not clerk_user_ids:
        raise HTTPException(status_code=422, detail="At least one clerk_user_id is required.")

    users = db.query(models.User).filter(models.User.clerk_user_id.in_(clerk_user_ids)).all()
    user_map = {user.clerk_user_id: user for user in users}
    now = _utcnow()
    results = []
    missing_ids = []
    for clerk_user_id in clerk_user_ids:
        user = user_map.get(clerk_user_id)
        if not user:
            missing_ids.append(clerk_user_id)
            continue
        if action == "delete":
            results.append(_soft_delete_candidate_record(db, user, when=now))
        else:
            results.append(_deactivate_candidate_record(db, user, when=now))

    db.commit()
    return {
        "action": action,
        "requested_count": len(clerk_user_ids),
        "processed_count": len(results),
        "missing_ids": missing_ids,
        "results": results,
    }


@router.post("/trial-codes")
def create_trial_code(
    payload: TrialCodeCreateRequest,
    admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    _ensure_trial_code_schema(db)
    normalized_suffix = _normalize_trial_code_suffix(payload.code_suffix)
    display_name = _normalize_trial_code_display_name(payload.display_name)
    code_value = _generate_trial_code(db, normalized_suffix)
    now = _utcnow()
    meta_payload: Dict[str, Any] = {}
    if payload.note:
        meta_payload["note"] = payload.note
    if normalized_suffix:
        meta_payload["code_suffix"] = normalized_suffix
    trial_code = models.TrialCode(
        id=str(uuid.uuid4()),
        code=code_value,
        display_name=display_name or f"Trial {code_value[-6:]}",
        code_suffix=normalized_suffix,
        status="ACTIVE",
        duration_minutes=payload.duration_minutes,
        expires_at=None,
        created_by_clerk_user_id=admin_user.clerk_user_id,
        meta_json=json.dumps(meta_payload) if meta_payload else None,
    )
    db.add(trial_code)
    db.commit()
    db.refresh(trial_code)
    return {
        "id": trial_code.id,
        "code": trial_code.code,
        "display_name": trial_code.display_name,
        "status": trial_code.status,
        "duration_minutes": trial_code.duration_minutes,
        "expires_at": trial_code.expires_at,
        "expires_policy": "manual_revoke_or_delete_only",
        "code_suffix": trial_code.code_suffix,
        "code_format_version": "v2_suffix_optional",
        "note": payload.note,
    }


@router.get("/trial-codes")
def list_trial_codes(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    suffix: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    include_deleted: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    _ensure_trial_code_schema(db)
    status_value = _query_arg_or_default(status, None)
    suffix_value = _query_arg_or_default(suffix, None)
    query_value = str(_query_arg_or_default(q, None) or "").strip()
    include_deleted_value = bool(_query_arg_or_default(include_deleted, False))
    page_value = _query_arg_or_default(page, 1)
    page_size_value = _query_arg_or_default(page_size, 20)

    query = db.query(models.TrialCode)
    normalized_status = str(status_value or "").strip().upper()
    if not include_deleted_value and normalized_status != "DELETED":
        query = query.filter(models.TrialCode.status != "DELETED")
    if normalized_status:
        query = query.filter(models.TrialCode.status == normalized_status)
    normalized_suffix = _normalize_trial_code_suffix(suffix_value) if suffix_value is not None else None
    if normalized_suffix:
        query = query.filter(models.TrialCode.code_suffix == normalized_suffix)
    if query_value:
        like = f"%{query_value}%"
        query = query.filter(
            or_(
                models.TrialCode.code.ilike(like),
                models.TrialCode.display_name.ilike(like),
                models.TrialCode.redeemed_by_clerk_user_id.ilike(like),
            )
        )
    total = query.count()
    rows = (
        query.order_by(models.TrialCode.created_at.desc())
        .offset((int(page_value) - 1) * int(page_size_value))
        .limit(int(page_size_value))
        .all()
    )
    items: List[Dict[str, Any]] = []
    for row in rows:
        _ensure_not_expired_trial_code(row)
        meta_payload = _json_loads_safe(row.meta_json) or {}
        items.append(
            {
                "id": row.id,
                "code": row.code,
                "display_name": row.display_name,
                "code_suffix": row.code_suffix,
                "status": row.status,
                "duration_minutes": row.duration_minutes,
                "expires_at": row.expires_at,
                "expires_policy": "manual_revoke_or_delete_only" if row.expires_at is None else "fixed_date",
                "created_by_clerk_user_id": row.created_by_clerk_user_id,
                "redeemed_by_clerk_user_id": row.redeemed_by_clerk_user_id,
                "redeemed_at": row.redeemed_at,
                "revoked_at": row.revoked_at,
                "deleted_at": row.deleted_at,
                "created_at": row.created_at,
                "note": meta_payload.get("note") if isinstance(meta_payload, dict) else None,
            }
        )
    db.commit()
    return {"items": items, "page": int(page_value), "page_size": int(page_size_value), "total": total}


@router.get("/trials")
def list_trials_alias(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    suffix: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    include_deleted: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    return list_trial_codes(
        _admin_user=_admin_user,
        db=db,
        status=status,
        suffix=suffix,
        q=q,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
    )


@router.get("/dashboard/overview")
def admin_dashboard_overview(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    now = _utcnow()
    window_24h = now - timedelta(hours=24)
    window_7d = now - timedelta(days=7)
    window_30d = now - timedelta(days=30)

    db_ok = True
    try:
        db.query(models.User.id).limit(1).all()
    except Exception:
        db_ok = False

    users_total = db.query(func.count(models.User.id)).scalar() or 0
    users_active = db.query(func.count(models.User.id)).filter(
        models.User.is_active == True,  # noqa: E712
        models.User.is_deleted == False,  # noqa: E712
    ).scalar() or 0
    users_deleted = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == True,  # noqa: E712
    ).scalar() or 0

    user_profiles_total = db.query(func.count(models.UserProfile.id)).scalar() or 0
    sessions_total = db.query(func.count(models.InterviewSession.id)).scalar() or 0
    sessions_active = db.query(func.count(models.InterviewSession.id)).filter(
        models.InterviewSession.status == "ACTIVE"
    ).scalar() or 0
    sessions_completed = db.query(func.count(models.InterviewSession.id)).filter(
        models.InterviewSession.status == "COMPLETED"
    ).scalar() or 0
    sessions_failed = db.query(func.count(models.InterviewSession.id)).filter(
        models.InterviewSession.status == "FAILED"
    ).scalar() or 0
    reports_total = db.query(func.count(models.InterviewReport.id)).scalar() or 0

    trial_codes_total = db.query(func.count(models.TrialCode.id)).scalar() or 0
    trial_codes_active = db.query(func.count(models.TrialCode.id)).filter(
        models.TrialCode.status == "ACTIVE",
        or_(models.TrialCode.expires_at.is_(None), models.TrialCode.expires_at >= now),
    ).scalar() or 0
    trial_codes_redeemed = db.query(func.count(models.TrialCode.id)).filter(
        models.TrialCode.status == "REDEEMED"
    ).scalar() or 0
    trial_codes_revoked = db.query(func.count(models.TrialCode.id)).filter(
        models.TrialCode.status == "REVOKED"
    ).scalar() or 0
    trial_codes_deleted = db.query(func.count(models.TrialCode.id)).filter(
        models.TrialCode.status == "DELETED"
    ).scalar() or 0
    trial_codes_expired = db.query(func.count(models.TrialCode.id)).filter(
        or_(
            models.TrialCode.status == "EXPIRED",
            and_(
                models.TrialCode.expires_at < now,
                models.TrialCode.status.in_(["ACTIVE", "REDEEMED"]),
            ),
        )
    ).scalar() or 0

    entitlements_total = db.query(func.count(models.UserEntitlement.id)).scalar() or 0
    entitlements_active = db.query(func.count(models.UserEntitlement.id)).filter(
        models.UserEntitlement.is_active == True,  # noqa: E712
        models.UserEntitlement.revoked_at.is_(None),
        or_(models.UserEntitlement.expires_at.is_(None), models.UserEntitlement.expires_at >= now),
    ).scalar() or 0
    gaze_events_total = db.query(func.count(models.InterviewGazeEvent.id)).scalar() or 0
    optional_tables = _optional_table_flags(db)
    waitlist_total = 0
    waitlist_24h = 0
    waitlist_source_counter: Counter = Counter()
    if optional_tables["launch_waitlist_signups"]:
        waitlist_total = db.query(func.count(models.LaunchWaitlistSignup.id)).scalar() or 0
        waitlist_24h = db.query(func.count(models.LaunchWaitlistSignup.id)).filter(
            models.LaunchWaitlistSignup.created_at >= window_24h
        ).scalar() or 0
        for row in db.query(
            models.LaunchWaitlistSignup.source_page,
            func.count(models.LaunchWaitlistSignup.id),
        ).group_by(models.LaunchWaitlistSignup.source_page).all():
            waitlist_source_counter[_normalize_distribution_key(row[0])] = int(row[1] or 0)

    feedback_total = 0
    feedback_7d = 0
    feedback_avg_rating = 0
    if optional_tables["trial_feedback"]:
        feedback_total = db.query(func.count(models.TrialFeedback.id)).scalar() or 0
        feedback_7d = db.query(func.count(models.TrialFeedback.id)).filter(
            models.TrialFeedback.submitted_at >= window_7d
        ).scalar() or 0
        feedback_avg_rating = db.query(func.avg(models.TrialFeedback.rating)).scalar() or 0

    registered_total = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
    ).scalar() or 0
    registered_24h = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.created_at >= window_24h,
    ).scalar() or 0
    registered_7d = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.created_at >= window_7d,
    ).scalar() or 0
    registered_30d = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.created_at >= window_30d,
    ).scalar() or 0

    logged_in_24h = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.last_login_at.isnot(None),
        models.User.last_login_at >= window_24h,
    ).scalar() or 0
    logged_in_7d = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.last_login_at.isnot(None),
        models.User.last_login_at >= window_7d,
    ).scalar() or 0
    logged_in_30d = db.query(func.count(models.User.id)).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.last_login_at.isnot(None),
        models.User.last_login_at >= window_30d,
    ).scalar() or 0

    interview_type_counter: Counter = Counter()
    difficulty_counter: Counter = Counter()
    question_mix_counter: Counter = Counter()
    interview_style_counter: Counter = Counter()
    selected_skills_counter: Counter = Counter()
    target_companies_counter: Counter = Counter()

    recent_sessions = db.query(models.InterviewSession).order_by(
        models.InterviewSession.started_at.desc()
    ).limit(1000).all()
    for session in recent_sessions:
        meta = _json_loads_safe(session.session_meta_json) or {}
        if not isinstance(meta, dict):
            meta = {}
        interview_type_counter[_normalize_distribution_key(session.interview_type or meta.get("interview_type"))] += 1
        difficulty_counter[_normalize_distribution_key(session.difficulty or meta.get("difficulty"))] += 1
        question_mix_counter[_normalize_distribution_key(meta.get("question_mix"))] += 1
        interview_style_counter[_normalize_distribution_key(meta.get("interview_style"))] += 1
        for skill in _safe_json_list(meta.get("selected_skills")):
            skill_key = _safe_string(skill).lower()
            if skill_key:
                selected_skills_counter[skill_key] += 1
        company = _safe_string(meta.get("company"))
        if company:
            target_companies_counter[company] += 1

    target_roles_counter: Counter = Counter()
    profile_rows = db.query(models.UserProfile.target_roles).all()
    for profile_row in profile_rows:
        roles = _safe_json_list(getattr(profile_row, "target_roles", None))
        for role in roles:
            role_key = _safe_string(role)
            if role_key:
                target_roles_counter[role_key] += 1

    report_counts_by_user: Dict[str, int] = {}
    for report_user_id, count in db.query(
        models.InterviewReport.user_id, func.count(models.InterviewReport.id)
    ).group_by(models.InterviewReport.user_id).all():
        if report_user_id:
            report_counts_by_user[str(report_user_id)] = int(count or 0)

    all_users = db.query(models.User).all()
    missing_profile_count = 0
    stale_login_count = 0
    missing_contact_count = 0
    no_reports_count = 0
    has_profile_ids = {
        str(row[0])
        for row in db.query(models.UserProfile.clerk_user_id).all()
        if row and row[0]
    }
    for user in all_users:
        normalized_last_login_at = _normalize_utc_naive(user.last_login_at)
        if user.clerk_user_id not in has_profile_ids:
            missing_profile_count += 1
        if not user.email and not user.phone_e164:
            missing_contact_count += 1
        if normalized_last_login_at is None or normalized_last_login_at < window_30d:
            stale_login_count += 1
        if report_counts_by_user.get(str(user.clerk_user_id), 0) <= 0:
            no_reports_count += 1

    recent_sessions_raw = db.query(models.InterviewSession).order_by(
        models.InterviewSession.started_at.desc()
    ).limit(12).all()
    recent_reports_raw = db.query(models.InterviewReport).order_by(
        models.InterviewReport.date.desc()
    ).limit(12).all()
    user_map = {
        user.clerk_user_id: user
        for user in all_users
        if user.clerk_user_id
    }

    recent_sessions: List[Dict[str, Any]] = []
    for row in recent_sessions_raw:
        meta = _safe_dict(_json_loads_safe(row.session_meta_json))
        user_row = user_map.get(row.clerk_user_id)
        recent_sessions.append(
            {
                "session_id": row.session_id,
                "clerk_user_id": row.clerk_user_id,
                "name": user_row.full_name if user_row else None,
                "email": user_row.email if user_row else None,
                "interview_type": row.interview_type,
                "status": row.status,
                "difficulty": row.difficulty,
                "question_mix": meta.get("question_mix"),
                "interview_style": meta.get("interview_style"),
                "selected_skills": _safe_json_list(meta.get("selected_skills")),
                "started_at": row.started_at,
                "ended_at": row.ended_at,
            }
        )

    recent_reports: List[Dict[str, Any]] = []
    for row in recent_reports_raw:
        metrics = _safe_dict(_json_loads_safe(row.metrics))
        explainability = _safe_dict(metrics.get("evaluation_explainability"))
        user_row = user_map.get(row.user_id)
        recent_reports.append(
            {
                "report_id": row.id,
                "session_id": row.session_id,
                "clerk_user_id": row.user_id,
                "name": user_row.full_name if user_row else None,
                "email": user_row.email if user_row else None,
                "overall_score": row.overall_score,
                "interview_type": row.type,
                "capture_status": metrics.get("capture_status"),
                "evaluation_source": explainability.get("source") or metrics.get("evaluation_source"),
                "created_at": row.date,
            }
        )

    recent_waitlist_rows = []
    if optional_tables["launch_waitlist_signups"]:
        recent_waitlist_rows = db.query(models.LaunchWaitlistSignup).order_by(
            models.LaunchWaitlistSignup.created_at.desc()
        ).limit(8).all()
    recent_waitlist = [
        {
            "id": row.id,
            "email": row.email,
            "source_page": row.source_page,
            "intent": row.intent,
            "status": row.status,
            "created_at": row.created_at,
        }
        for row in recent_waitlist_rows
    ]

    recent_feedback_rows = []
    if optional_tables["trial_feedback"]:
        recent_feedback_rows = db.query(models.TrialFeedback).order_by(
            models.TrialFeedback.submitted_at.desc()
        ).limit(8).all()
    recent_feedback = [
        {
            "id": row.id,
            "report_id": row.report_id,
            "session_id": row.session_id,
            "clerk_user_id": row.clerk_user_id,
            "rating": row.rating,
            "comment": row.comment,
            "plan_tier": row.plan_tier,
            "trial_mode": bool(row.trial_mode),
            "submitted_at": row.submitted_at,
        }
        for row in recent_feedback_rows
    ]

    active_any_ids, active_session_ids, recent_login_ids = _active_user_ids(
        db=db,
        now=now,
        window_minutes=15,
    )

    trials_created_24h = db.query(func.count(models.TrialCode.id)).filter(
        models.TrialCode.created_at >= window_24h,
    ).scalar() or 0
    trials_created_7d = db.query(func.count(models.TrialCode.id)).filter(
        models.TrialCode.created_at >= window_7d,
    ).scalar() or 0
    trials_redeemed_24h = db.query(func.count(models.TrialCode.id)).filter(
        models.TrialCode.redeemed_at.isnot(None),
        models.TrialCode.redeemed_at >= window_24h,
    ).scalar() or 0
    trials_redeemed_7d = db.query(func.count(models.TrialCode.id)).filter(
        models.TrialCode.redeemed_at.isnot(None),
        models.TrialCode.redeemed_at >= window_7d,
    ).scalar() or 0
    redeem_rate_7d = round((float(trials_redeemed_7d) / float(trials_created_7d)) * 100.0, 2) if trials_created_7d else 0.0

    quality_full = evaluation_quality_summary(_admin_user=_admin_user, db=db)

    return {
        "active_users_now": int(len(active_session_ids)),
        "active_users_last_15m_count": int(len(active_any_ids)),
        "db": {
            "health": "up" if db_ok else "down",
            "engine": _db_engine_name(db),
            "generated_at": now,
        },
        "table_counts": {
            "users_total": int(users_total),
            "users_active": int(users_active),
            "users_deleted": int(users_deleted),
            "user_profiles_total": int(user_profiles_total),
            "interview_sessions_total": int(sessions_total),
            "interview_sessions_active": int(sessions_active),
            "interview_sessions_completed": int(sessions_completed),
            "interview_sessions_failed": int(sessions_failed),
            "interview_reports_total": int(reports_total),
            "trial_codes_total": int(trial_codes_total),
            "trial_codes_active": int(trial_codes_active),
            "trial_codes_redeemed": int(trial_codes_redeemed),
            "trial_codes_revoked": int(trial_codes_revoked),
            "trial_codes_expired": int(trial_codes_expired),
            "trial_codes_deleted": int(trial_codes_deleted),
            "user_entitlements_total": int(entitlements_total),
            "user_entitlements_active": int(entitlements_active),
            "interview_gaze_events_total": int(gaze_events_total),
            "launch_waitlist_signups_total": int(waitlist_total),
            "trial_feedback_total": int(feedback_total),
        },
        "candidate_funnel": {
            "registered_total": int(registered_total),
            "registered_24h": int(registered_24h),
            "registered_7d": int(registered_7d),
            "registered_30d": int(registered_30d),
            "logged_in_24h": int(logged_in_24h),
            "logged_in_7d": int(logged_in_7d),
            "logged_in_30d": int(logged_in_30d),
            "onboarded_profiles_total": int(user_profiles_total),
            "active_users_now": int(len(active_session_ids)),
            "active_users_last_15m_count": int(len(active_any_ids)),
        },
        "candidate_health": {
            "missing_profile_count": int(missing_profile_count),
            "missing_contact_count": int(missing_contact_count),
            "stale_login_count_30d": int(stale_login_count),
            "no_reports_count": int(no_reports_count),
        },
        "interview_metadata": {
            "interview_type_distribution": dict(interview_type_counter),
            "difficulty_distribution": dict(difficulty_counter),
            "question_mix_distribution": dict(question_mix_counter),
            "interview_style_distribution": dict(interview_style_counter),
            "selected_skills_top": _top_counter_items(selected_skills_counter, limit=10),
            "target_roles_top": _top_counter_items(target_roles_counter, limit=10),
            "target_companies_top": _top_counter_items(target_companies_counter, limit=10),
        },
        "trials": {
            "created_24h": int(trials_created_24h),
            "created_7d": int(trials_created_7d),
            "redeemed_24h": int(trials_redeemed_24h),
            "redeemed_7d": int(trials_redeemed_7d),
            "redeem_rate_7d": float(redeem_rate_7d),
            "active_trial_entitlements": int(entitlements_active),
        },
        "waitlist": {
            "total": int(waitlist_total),
            "joined_24h": int(waitlist_24h),
            "source_distribution": dict(waitlist_source_counter),
        },
        "feedback": {
            "total": int(feedback_total),
            "submitted_7d": int(feedback_7d),
            "avg_rating": round(float(feedback_avg_rating or 0), 2),
        },
        "quality": {
            "invalid_contract_reports": quality_full.get("invalid_contract_reports", 0),
            "zero_score_without_evidence_attempts_blocked": quality_full.get(
                "zero_score_without_evidence_attempts_blocked", 0
            ),
            "source_distribution_last_7_days": quality_full.get("source_distribution_last_7_days", {}),
            "contract_failed_reasons": quality_full.get("contract_failed_reasons", {}),
            "score_percentiles_by_interview_type_last_7_days": quality_full.get(
                "score_percentiles_by_interview_type_last_7_days", {}
            ),
        },
        "recent_activity": {
            "sessions": recent_sessions,
            "reports": recent_reports,
            "waitlist_signups": recent_waitlist,
            "trial_feedback": recent_feedback,
        },
    }


@router.get("/dashboard/funnel")
def admin_dashboard_funnel(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    overview = admin_dashboard_overview(_admin_user=_admin_user, db=db)
    return {
        "candidate_funnel": overview.get("candidate_funnel", {}),
        "candidate_health": overview.get("candidate_health", {}),
        "active_users_now": overview.get("active_users_now", 0),
        "active_users_last_15m_count": overview.get("active_users_last_15m_count", 0),
        "generated_at": _safe_dict(overview.get("db")).get("generated_at"),
    }


@router.get("/active-users")
def admin_active_users(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
    window_minutes: int = Query(15, ge=1, le=1440),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    q: Optional[str] = Query(None),
):
    now = _utcnow()
    active_any_ids, active_session_ids, recent_login_ids = _active_user_ids(
        db=db,
        now=now,
        window_minutes=window_minutes,
    )
    if not active_any_ids:
        return {
            "count_now": 0,
            "count_window": 0,
            "window_minutes": int(window_minutes),
            "items": [],
            "page": page,
            "page_size": page_size,
            "total": 0,
        }

    query = db.query(models.User).filter(
        models.User.is_deleted == False,  # noqa: E712
        models.User.clerk_user_id.in_(list(active_any_ids)),
    )
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.User.email.ilike(like),
                models.User.full_name.ilike(like),
                models.User.clerk_user_id.ilike(like),
                models.User.phone_e164.ilike(like),
            )
        )

    total = query.count()
    users = (
        query.order_by(models.User.last_login_at.desc(), models.User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    active_session_count_map = {
        str(row[0]): int(row[1] or 0)
        for row in db.query(
            models.InterviewSession.clerk_user_id,
            func.count(models.InterviewSession.id),
        )
        .filter(
            models.InterviewSession.status == "ACTIVE",
            models.InterviewSession.clerk_user_id.in_(list(active_any_ids)),
        )
        .group_by(models.InterviewSession.clerk_user_id)
        .all()
        if row and row[0]
    }
    latest_session_map = {
        str(row[0]): row[1]
        for row in db.query(
            models.InterviewSession.clerk_user_id,
            func.max(models.InterviewSession.started_at),
        )
        .filter(models.InterviewSession.clerk_user_id.in_(list(active_any_ids)))
        .group_by(models.InterviewSession.clerk_user_id)
        .all()
        if row and row[0]
    }

    items: List[Dict[str, Any]] = []
    for user in users:
        if _sync_user_from_clerk_if_missing(db, user):
            db.commit()
            db.refresh(user)
        reasons: List[str] = []
        if user.clerk_user_id in active_session_ids:
            reasons.append("active_session")
        if user.clerk_user_id in recent_login_ids:
            reasons.append("recent_login")
        items.append(
            {
                "clerk_user_id": user.clerk_user_id,
                "full_name": user.full_name,
                "email": user.email,
                "phone_e164": user.phone_e164,
                "last_login_at": user.last_login_at,
                "active_reasons": reasons,
                "active_session_count": int(active_session_count_map.get(user.clerk_user_id, 0)),
                "latest_session_started_at": latest_session_map.get(user.clerk_user_id),
                "login_recency": _login_recency(user.last_login_at, now=now),
            }
        )

    return {
        "count_now": int(len(active_session_ids)),
        "count_window": int(len(active_any_ids)),
        "window_minutes": int(window_minutes),
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/interviews")
def admin_interviews(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    status: Optional[str] = Query(None),
    interview_type: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    window_days: int = Query(30, ge=1, le=365),
    skill: Optional[str] = Query(None),
):
    now = _utcnow()
    query = db.query(models.InterviewSession, models.User).outerjoin(
        models.User,
        models.User.clerk_user_id == models.InterviewSession.clerk_user_id,
    )
    if status and str(status).strip().lower() != "all":
        query = query.filter(models.InterviewSession.status == str(status).strip().upper())
    if interview_type and str(interview_type).strip().lower() != "all":
        query = query.filter(models.InterviewSession.interview_type == str(interview_type).strip().lower())
    if window_days > 0:
        query = query.filter(models.InterviewSession.started_at >= now - timedelta(days=window_days))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.InterviewSession.session_id.ilike(like),
                models.InterviewSession.clerk_user_id.ilike(like),
                models.User.full_name.ilike(like),
                models.User.email.ilike(like),
                models.User.phone_e164.ilike(like),
            )
        )

    rows = query.order_by(models.InterviewSession.started_at.desc()).all()
    report_ids = [session_row.report_id for session_row, _ in rows if getattr(session_row, "report_id", None)]
    session_ids = [session_row.session_id for session_row, _ in rows if getattr(session_row, "session_id", None)]
    reports = db.query(models.InterviewReport).filter(
        or_(
            models.InterviewReport.id.in_(report_ids or [""]),
            models.InterviewReport.session_id.in_(session_ids or [""]),
        )
    ).all()
    report_by_id = {report.id: report for report in reports if report.id}
    report_by_session = {report.session_id: report for report in reports if report.session_id}

    skill_token = str(skill or "").strip().lower()
    items: List[Dict[str, Any]] = []
    for session_row, user_row in rows:
        meta = _safe_dict(_json_loads_safe(session_row.session_meta_json))
        selected_skills = [str(v) for v in _safe_json_list(meta.get("selected_skills")) if str(v).strip()]
        if skill_token and skill_token not in [s.lower() for s in selected_skills]:
            continue

        report = report_by_id.get(session_row.report_id) or report_by_session.get(session_row.session_id)
        report_metrics = _safe_dict(_json_loads_safe(report.metrics) if report else {})
        explainability = _safe_dict(report_metrics.get("evaluation_explainability"))
        items.append(
            {
                "session_id": session_row.session_id,
                "clerk_user_id": session_row.clerk_user_id,
                "name": user_row.full_name if user_row else None,
                "email": user_row.email if user_row else None,
                "phone_e164": user_row.phone_e164 if user_row else None,
                "status": session_row.status,
                "interview_type": session_row.interview_type,
                "difficulty": session_row.difficulty,
                "duration_minutes_requested": session_row.duration_minutes_requested,
                "duration_minutes_effective": session_row.duration_minutes_effective,
                "report_id": session_row.report_id,
                "capture_status": report_metrics.get("capture_status"),
                "evaluation_source": explainability.get("source"),
                "overall_score": report.overall_score if report else None,
                "question_mix": meta.get("question_mix"),
                "interview_style": meta.get("interview_style"),
                "role": meta.get("role"),
                "company": meta.get("company"),
                "selected_skills": selected_skills,
                "started_at": session_row.started_at,
                "ended_at": session_row.ended_at,
            }
        )

    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/reports")
def admin_reports(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    interview_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    capture_status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    window_days: int = Query(30, ge=1, le=365),
):
    now = _utcnow()
    query = db.query(models.InterviewReport, models.User).outerjoin(
        models.User,
        models.User.clerk_user_id == models.InterviewReport.user_id,
    )
    if interview_type and str(interview_type).strip().lower() != "all":
        query = query.filter(models.InterviewReport.type == str(interview_type).strip().lower())
    if window_days > 0:
        query = query.filter(models.InterviewReport.date >= now - timedelta(days=window_days))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.InterviewReport.id.ilike(like),
                models.InterviewReport.session_id.ilike(like),
                models.InterviewReport.user_id.ilike(like),
                models.User.full_name.ilike(like),
                models.User.email.ilike(like),
                models.User.phone_e164.ilike(like),
            )
        )

    rows = query.order_by(models.InterviewReport.date.desc()).all()
    source_token = str(source or "").strip().lower()
    capture_token = str(capture_status or "").strip().upper()
    items: List[Dict[str, Any]] = []
    for report_row, user_row in rows:
        metrics = _safe_dict(_json_loads_safe(report_row.metrics))
        explainability = _safe_dict(metrics.get("evaluation_explainability"))
        row_source = str(explainability.get("source") or metrics.get("evaluation_source") or "").strip().lower()
        row_capture = str(metrics.get("capture_status") or "").strip().upper()
        if source_token and row_source != source_token:
            continue
        if capture_token and row_capture != capture_token:
            continue
        items.append(
            {
                "report_id": report_row.id,
                "session_id": report_row.session_id,
                "clerk_user_id": report_row.user_id,
                "name": user_row.full_name if user_row else None,
                "email": user_row.email if user_row else None,
                "phone_e164": user_row.phone_e164 if user_row else None,
                "overall_score": report_row.overall_score,
                "interview_type": report_row.type,
                "mode": report_row.mode,
                "questions": report_row.questions,
                "capture_status": row_capture or None,
                "evaluation_source": row_source or None,
                "created_at": report_row.date,
            }
        )
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/config")
def admin_config(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    now = _utcnow()
    db_ok = True
    try:
        db.query(models.User.id).limit(1).all()
    except Exception:
        db_ok = False

    raw_allowlist = str(os.getenv("ADMIN_CLERK_USER_IDS", "") or "").strip()
    allowlist_items = [item.strip() for item in raw_allowlist.split(",") if item.strip()]
    allow_all_local = "*" in allowlist_items
    allowlist_count = len([item for item in allowlist_items if item != "*"])
    env_value = str(
        os.getenv("ENV", os.getenv("ENVIRONMENT", os.getenv("PYTHON_ENV", "development")))
    ).strip().lower()
    allowed_origins_env = str(os.getenv("ALLOWED_ORIGINS", "") or "").strip()
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

    return {
        "generated_at": now.isoformat(),
        "environment": env_value or "development",
        "db": {
            "health": "up" if db_ok else "down",
            "engine": _db_engine_name(db),
        },
        "admin_access": {
            "mode": "allow_all_local" if allow_all_local else "allowlist",
            "allowlist_count": int(allowlist_count),
            "wildcard_enabled": bool(allow_all_local),
        },
        "flags": {
            "trial_mode_enabled": _env_bool("TRIAL_MODE_ENABLED", True),
            "trial_code_enforcement": _env_bool("TRIAL_CODE_ENFORCEMENT", True),
            "interview_server_control_enabled": _env_bool("INTERVIEW_SERVER_CONTROL_ENABLED", True),
            "interview_skill_tracks_enabled": _env_bool("INTERVIEW_SKILL_TRACKS_ENABLED", True),
            "interview_prompt_injection_guard_enabled": _env_bool("INTERVIEW_PROMPT_INJECTION_GUARD_ENABLED", True),
            "eval": {
                "hard_guards": EVAL_FLAGS.hard_guards,
                "client_turns_trusted": EVAL_FLAGS.client_turns_trusted,
                "deterministic_rubric": EVAL_FLAGS.deterministic_rubric,
                "contract_mode": EVAL_FLAGS.contract_mode,
                "report_post_mode": EVAL_FLAGS.report_post_mode,
                "scorer_mode": EVAL_FLAGS.scorer_mode,
                "rubric_version": EVAL_FLAGS.rubric_version,
                "scorer_version": EVAL_FLAGS.scorer_version,
            },
        },
        "cors": {
            "is_configured": bool(allowed_origins_env),
            "wildcard": allowed_origins_env == "*",
            "configured_origin_count": int(len(allowed_origins)),
            "uses_dev_defaults": not bool(allowed_origins_env),
        },
    }


@router.delete("/trial-codes/{code_id}")
def delete_trial_code(
    code_id: str,
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    _ensure_trial_code_schema(db)
    trial_code = db.query(models.TrialCode).filter(models.TrialCode.id == code_id).first()
    if not trial_code:
        raise HTTPException(status_code=404, detail="Trial code not found")
    payload = _delete_trial_code_record(db, trial_code)
    db.commit()
    return payload


@router.post("/trial-codes/bulk-delete")
def bulk_delete_trial_codes(
    payload: TrialCodeBulkDeleteRequest,
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    _ensure_trial_code_schema(db)
    code_ids = []
    seen_ids = set()
    for raw_id in payload.code_ids or []:
        value = str(raw_id or "").strip()
        if not value or value in seen_ids:
            continue
        seen_ids.add(value)
        code_ids.append(value)
    if not code_ids:
        raise HTTPException(status_code=422, detail="At least one code_id is required.")

    codes = db.query(models.TrialCode).filter(models.TrialCode.id.in_(code_ids)).all()
    code_map = {code.id: code for code in codes}
    now = _utcnow()
    results = []
    missing_ids = []
    for code_id in code_ids:
        trial_code = code_map.get(code_id)
        if not trial_code:
            missing_ids.append(code_id)
            continue
        results.append(_delete_trial_code_record(db, trial_code, when=now))

    db.commit()
    return {
        "requested_count": len(code_ids),
        "processed_count": len(results),
        "missing_ids": missing_ids,
        "results": results,
    }


@router.get("/evaluation/quality-summary")
def evaluation_quality_summary(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    def _as_dt(value: Optional[datetime]) -> Optional[datetime]:
        return _normalize_utc_naive(value)

    def _percentile(values: List[int], pct: float) -> Optional[float]:
        if not values:
            return None
        ordered = sorted(values)
        rank = max(0, min(len(ordered) - 1, int(round((pct / 100.0) * (len(ordered) - 1)))))
        return float(ordered[rank])

    def _failure_bucket(flag: str) -> str:
        token = str(flag or "")
        if "CANDIDATE_WORDS_ZERO" in token or "NO_CANDIDATE_AUDIO" in token:
            return "missing_audio"
        if "LOW_EVIDENCE_WORDS" in token or "WORDS_BELOW_MIN" in token:
            return "low_evidence_words"
        if "TURNS_ZERO" in token or "NO_TURN" in token:
            return "no_turns"
        if "UNAPPROVED_SCORE_SOURCE" in token or "INVALID_SOURCE" in token:
            return "untrusted_source"
        if "MISSING_TURN_EXCERPT" in token:
            return "missing_excerpt"
        return "other"

    now = _utcnow()
    today_start = datetime(now.year, now.month, now.day)
    last_7_days_start = now - timedelta(days=7)

    reports = db.query(models.InterviewReport).all()
    invalid_contract_reports = 0
    forced_zero_count = 0
    source_distribution: Dict[str, int] = {}
    source_distribution_last_7_days: Dict[str, int] = {}
    invalid_contract_blocked_today = 0
    zero_score_forced_today = 0
    contract_failed_reasons: Dict[str, int] = {}
    scores_by_type: Dict[str, List[int]] = {}
    shadow_total = 0
    shadow_within_tolerance = 0
    false_valid_count = 0

    for report in reports:
        report_dt = _as_dt(report.date) or now
        in_today = report_dt >= today_start
        in_last_7_days = report_dt >= last_7_days_start

        metrics = _json_loads_safe(report.metrics) or {}
        if not isinstance(metrics, dict):
            metrics = {}
        contract_passed = metrics.get("contract_passed")
        validation_flags = metrics.get("validation_flags") or []
        score_provenance = metrics.get("score_provenance") or {}
        explainability = metrics.get("evaluation_explainability") or {}
        source = None
        if isinstance(score_provenance, dict):
            source = score_provenance.get("source")
            if score_provenance.get("forced_zero_reason"):
                forced_zero_count += 1
        if not source and isinstance(explainability, dict):
            source = explainability.get("source")
        source_key = str(source or "unknown")
        source_distribution[source_key] = source_distribution.get(source_key, 0) + 1
        if in_last_7_days:
            source_distribution_last_7_days[source_key] = source_distribution_last_7_days.get(source_key, 0) + 1

        if contract_passed is False or (isinstance(validation_flags, list) and len(validation_flags) > 0):
            invalid_contract_reports += 1
            if in_today:
                invalid_contract_blocked_today += 1
            if isinstance(validation_flags, list):
                for flag in validation_flags:
                    bucket = _failure_bucket(str(flag))
                    contract_failed_reasons[bucket] = contract_failed_reasons.get(bucket, 0) + 1
                if int(report.overall_score or 0) > 0:
                    false_valid_count += 1
        if report.overall_score == 0 and isinstance(validation_flags, list):
            if any(str(flag).startswith("HARD_GUARD_") for flag in validation_flags):
                forced_zero_count += 1
                if in_today:
                    zero_score_forced_today += 1

        if in_last_7_days:
            interview_type = str(report.type or "unknown").lower()
            scores_by_type.setdefault(interview_type, []).append(int(report.overall_score or 0))

        shadow_summary = metrics.get("deterministic_rubric_shadow_summary")
        if isinstance(shadow_summary, dict) and isinstance(shadow_summary.get("abs_score_delta"), (int, float)):
            shadow_total += 1
            if float(shadow_summary.get("abs_score_delta")) <= 10:
                shadow_within_tolerance += 1

    score_percentiles_by_interview_type: Dict[str, Dict[str, Optional[float]]] = {}
    for interview_type, values in scores_by_type.items():
        score_percentiles_by_interview_type[interview_type] = {
            "p50": _percentile(values, 50),
            "p95": _percentile(values, 95),
            "count": len(values),
        }

    complete_session_count = sum(
        1
        for report in reports
        if (
            isinstance((_json_loads_safe(report.metrics) or {}), dict)
            and ((_json_loads_safe(report.metrics) or {}).get("capture_status") in {"COMPLETE", "INCOMPLETE_PARTIAL_CAPTURE"})
        )
    )
    complete_session_contract_pass_count = sum(
        1
        for report in reports
        if (
            isinstance((_json_loads_safe(report.metrics) or {}), dict)
            and ((_json_loads_safe(report.metrics) or {}).get("capture_status") in {"COMPLETE", "INCOMPLETE_PARTIAL_CAPTURE"})
            and bool((_json_loads_safe(report.metrics) or {}).get("contract_passed")) is True
        )
    )
    contract_pass_rate_complete_sessions = (
        round((complete_session_contract_pass_count / complete_session_count) * 100, 2)
        if complete_session_count > 0
        else None
    )
    shadow_agreement_within_10_pct = (
        round((shadow_within_tolerance / shadow_total) * 100, 2) if shadow_total > 0 else None
    )

    return {
        "total_reports": len(reports),
        "invalid_contract_reports": invalid_contract_reports,
        "zero_score_without_evidence_attempts_blocked": forced_zero_count,
        "source_distribution": source_distribution,
        "invalid_contract_blocked_today": invalid_contract_blocked_today,
        "zero_score_forced_today": zero_score_forced_today,
        "source_distribution_last_7_days": source_distribution_last_7_days,
        "score_percentiles_by_interview_type_last_7_days": score_percentiles_by_interview_type,
        "contract_failed_reasons": contract_failed_reasons,
        "shadow_mode": {
            "total_compared_sessions": shadow_total,
            "agreement_within_10_points_pct": shadow_agreement_within_10_pct,
        },
        "phase_c_readiness": {
            "shadow_agreement_target_pct": EVAL_FLAGS.shadow_agreement_target_pct,
            "shadow_agreement_tolerance_points": EVAL_FLAGS.shadow_agreement_tolerance_points,
            "contract_pass_rate_target_pct": EVAL_FLAGS.contract_pass_rate_target_pct,
            "no_p0_days_target": EVAL_FLAGS.no_p0_days_target,
            "current": {
                "shadow_agreement_within_target": (
                    shadow_agreement_within_10_pct is not None
                    and shadow_agreement_within_10_pct >= EVAL_FLAGS.shadow_agreement_target_pct
                ),
                "contract_pass_rate_complete_sessions": contract_pass_rate_complete_sessions,
                "contract_pass_rate_within_target": (
                    contract_pass_rate_complete_sessions is not None
                    and contract_pass_rate_complete_sessions >= EVAL_FLAGS.contract_pass_rate_target_pct
                ),
                "false_valid_count": false_valid_count,
                "false_valid_rate_target_zero": false_valid_count == 0,
            },
        },
    }


@router.get("/dashboard/quality")
def admin_dashboard_quality(
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    return evaluation_quality_summary(_admin_user=_admin_user, db=db)


class AdminExportCreateRequest(BaseModel):
    export_type: str = Field(pattern="^(candidates|interviews|reports|trials)$")
    filters: Dict[str, Any] = Field(default_factory=dict)
    columns: List[str] = Field(default_factory=list)


def _dt_iso(value: Any) -> Optional[str]:
    return value.isoformat() if isinstance(value, datetime) else None


def _json_text(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return str(value or "")


def _candidate_export_rows(db: Session, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    q = db.query(models.User).filter(models.User.is_deleted == False)  # noqa: E712
    search = str((filters or {}).get("q") or "").strip()
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                models.User.full_name.ilike(like),
                models.User.email.ilike(like),
                models.User.phone_e164.ilike(like),
                models.User.clerk_user_id.ilike(like),
            )
        )
    users = q.order_by(models.User.created_at.desc()).limit(min(100000, int(filters.get("limit") or 10000))).all()
    report_counts = dict(
        db.query(models.InterviewReport.user_id, func.count(models.InterviewReport.id))
        .group_by(models.InterviewReport.user_id)
        .all()
    )
    session_counts = dict(
        db.query(models.InterviewSession.clerk_user_id, func.count(models.InterviewSession.id))
        .group_by(models.InterviewSession.clerk_user_id)
        .all()
    )
    profile_v2_map: Dict[str, Any] = {}
    try:
        for p in db.query(models.CandidateProfileV2).all():
            profile_v2_map[str(p.user_id)] = p
    except Exception:
        profile_v2_map = {}
    rows: List[Dict[str, Any]] = []
    for u in users:
        p2 = profile_v2_map.get(str(u.id))
        rows.append(
            {
                "user_id": u.id,
                "clerk_user_id": u.clerk_user_id,
                "name": u.full_name or "",
                "email": u.email or "",
                "phone_e164": u.phone_e164 or "",
                "is_active": bool(u.is_active),
                "is_deleted": bool(u.is_deleted),
                "registered_at": _dt_iso(u.created_at),
                "last_login_at": _dt_iso(u.last_login_at),
                "state_code": getattr(p2, "state_code", None) or "",
                "university_name": getattr(p2, "university_name", None) or "",
                "primary_stream": getattr(p2, "primary_stream", None) or "",
                "profile_completion_score": int(getattr(p2, "profile_completion_score", 0) or 0),
                "session_count": int(session_counts.get(u.clerk_user_id, 0)),
                "report_count": int(report_counts.get(u.clerk_user_id, 0)),
            }
        )
    return rows


def _interview_export_rows(db: Session, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    q = db.query(models.InterviewSession)
    search = str((filters or {}).get("q") or "").strip()
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                models.InterviewSession.session_id.ilike(like),
                models.InterviewSession.clerk_user_id.ilike(like),
                models.InterviewSession.interview_type.ilike(like),
            )
        )
    status = str((filters or {}).get("status") or "").strip().upper()
    if status and status != "ALL":
        q = q.filter(models.InterviewSession.status == status)
    rows = []
    for s in q.order_by(models.InterviewSession.created_at.desc()).limit(min(100000, int(filters.get("limit") or 10000))).all():
        meta = _json_loads_safe(s.session_meta_json) or {}
        rows.append(
            {
                "interview_session_id": s.id,
                "session_public_id": s.session_id,
                "clerk_user_id": s.clerk_user_id,
                "status": s.status,
                "interview_type": s.interview_type or "",
                "difficulty": s.difficulty or "",
                "duration_minutes_requested": s.duration_minutes_requested,
                "duration_minutes_effective": s.duration_minutes_effective,
                "started_at": _dt_iso(s.started_at),
                "ended_at": _dt_iso(s.ended_at),
                "report_id": s.report_id or "",
                "selected_skills": _json_text((meta or {}).get("selected_skills") or []),
                "role": str((meta or {}).get("role") or ""),
                "company": str((meta or {}).get("company") or ""),
                "plan_tier": str((meta or {}).get("plan_tier") or ""),
            }
        )
    return rows


def _report_export_rows(db: Session, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    q = db.query(models.InterviewReport)
    source = str((filters or {}).get("source") or "").strip()
    capture_status = str((filters or {}).get("capture_status") or "").strip()
    interview_type = str((filters or {}).get("interview_type") or "").strip()
    if interview_type and interview_type != "all":
        q = q.filter(func.lower(models.InterviewReport.type) == interview_type.lower())
    reports = q.order_by(models.InterviewReport.date.desc()).limit(min(100000, int(filters.get("limit") or 10000))).all()
    out = []
    for r in reports:
        metrics = _json_loads_safe(r.metrics) or {}
        if not isinstance(metrics, dict):
            metrics = {}
        prov = metrics.get("score_provenance") or metrics.get("evaluation_explainability") or {}
        prov_source = str((prov or {}).get("source") or "")
        cs = str(metrics.get("capture_status") or "")
        if source and source.lower() != prov_source.lower():
            continue
        if capture_status and capture_status.lower() != cs.lower():
            continue
        out.append(
            {
                "report_id": r.id,
                "session_public_id": r.session_id or "",
                "user_ref": r.user_id,
                "title": r.title or "",
                "date": _dt_iso(r.date),
                "type": r.type or "",
                "mode": r.mode or "",
                "overall_score": int(r.overall_score or 0),
                "questions": int(r.questions or 0),
                "capture_status": cs,
                "evaluation_source": prov_source,
                "confidence": str((prov or {}).get("confidence") or ""),
                "contract_passed": metrics.get("contract_passed"),
                "candidate_word_count": metrics.get("candidate_word_count"),
                "candidate_turn_count": metrics.get("candidate_turn_count"),
            }
        )
    return out


def _trial_export_rows(db: Session, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    q = db.query(models.TrialCode)
    suffix = _normalize_trial_code_suffix((filters or {}).get("suffix")) if (filters or {}).get("suffix") else None
    if suffix:
        q = q.filter(models.TrialCode.code_suffix == suffix)
    status = str((filters or {}).get("status") or "").strip().upper()
    if status and status != "ALL":
        q = q.filter(models.TrialCode.status == status)
    rows = []
    for t in q.order_by(models.TrialCode.created_at.desc()).limit(min(100000, int(filters.get("limit") or 10000))).all():
        rows.append(
            {
                "trial_code_id": t.id,
                "code": t.code,
                "display_name": t.display_name or "",
                "code_suffix": t.code_suffix or "",
                "status": t.status,
                "duration_minutes": int(t.duration_minutes or 0),
                "expires_at": _dt_iso(t.expires_at),
                "created_at": _dt_iso(t.created_at),
                "redeemed_at": _dt_iso(t.redeemed_at),
                "revoked_at": _dt_iso(t.revoked_at),
                "deleted_at": _dt_iso(t.deleted_at),
                "created_by_clerk_user_id": t.created_by_clerk_user_id or "",
                "redeemed_by_clerk_user_id": t.redeemed_by_clerk_user_id or "",
            }
        )
    return rows


def _rows_for_export(db: Session, export_type: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    if export_type == "candidates":
        return _candidate_export_rows(db, filters)
    if export_type == "interviews":
        return _interview_export_rows(db, filters)
    if export_type == "reports":
        return _report_export_rows(db, filters)
    if export_type == "trials":
        return _trial_export_rows(db, filters)
    raise HTTPException(status_code=422, detail="Unsupported export_type")


def _csv_from_rows(rows: List[Dict[str, Any]], requested_columns: List[str]) -> tuple[str, List[str]]:
    if not rows:
        columns = requested_columns or []
        if not columns:
            return "", []
    all_columns = list(rows[0].keys()) if rows else []
    columns = [c for c in (requested_columns or all_columns) if c in all_columns] or all_columns
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({k: row.get(k, "") for k in columns})
    return buffer.getvalue(), columns


@router.post("/exports")
def create_admin_export(
    payload: AdminExportCreateRequest,
    admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    rows = _rows_for_export(db, payload.export_type, payload.filters or {})
    csv_text, columns = _csv_from_rows(rows, payload.columns or [])
    now = _utcnow()
    job = models.AdminExportJob(
        created_by_user_id=str(getattr(admin_user, "id")),
        export_type=payload.export_type,
        filters_json=_json_text(payload.filters or {}),
        columns_json=_json_text(columns),
        status="completed",
        row_count=len(rows),
        file_storage_kind="db_blob",
        file_name=f"{payload.export_type}-export-{now.strftime('%Y%m%d-%H%M%S')}.csv",
        mime_type="text/csv",
        file_content_text=csv_text,
        expires_at=now + timedelta(days=7),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {
        "id": job.id,
        "status": job.status,
        "export_type": job.export_type,
        "row_count": job.row_count,
        "file_name": job.file_name,
        "expires_at": job.expires_at,
        "columns": columns,
    }


@router.get("/exports")
def list_admin_exports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    export_type: Optional[str] = Query(default=None),
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.AdminExportJob)
    if export_type:
        q = q.filter(models.AdminExportJob.export_type == export_type)
    total = q.count()
    rows = (
        q.order_by(models.AdminExportJob.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [
            {
                "id": row.id,
                "export_type": row.export_type,
                "status": row.status,
                "row_count": row.row_count,
                "file_name": row.file_name,
                "created_by_user_id": row.created_by_user_id,
                "created_at": row.created_at,
                "expires_at": row.expires_at,
                "has_download": bool(row.file_content_text),
            }
            for row in rows
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
        },
    }


@router.get("/exports/{export_id}")
def get_admin_export(
    export_id: str,
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    row = db.query(models.AdminExportJob).filter(models.AdminExportJob.id == export_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Export not found")
    return {
        "id": row.id,
        "export_type": row.export_type,
        "status": row.status,
        "row_count": row.row_count,
        "filters": _json_loads_safe(row.filters_json) or {},
        "columns": _json_loads_safe(row.columns_json) or [],
        "file_name": row.file_name,
        "mime_type": row.mime_type,
        "created_by_user_id": row.created_by_user_id,
        "error_message": row.error_message,
        "created_at": row.created_at,
        "expires_at": row.expires_at,
    }


@router.get("/exports/{export_id}/download")
def download_admin_export(
    export_id: str,
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    row = db.query(models.AdminExportJob).filter(models.AdminExportJob.id == export_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Export not found")
    if row.status != "completed" or not row.file_content_text:
        raise HTTPException(status_code=409, detail="Export file not ready")
    if row.expires_at and row.expires_at < _utcnow():
        raise HTTPException(status_code=410, detail="Export expired")
    return Response(
        content=row.file_content_text,
        media_type=row.mime_type or "text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{row.file_name or "export.csv"}"',
            "Cache-Control": "no-store",
        },
    )


def _question_bank_vertical(raw: Optional[str]) -> str:
    value = str(raw or "").strip().lower()
    if value not in {"technical", "behavioral"}:
        raise HTTPException(status_code=422, detail="interview_type must be technical or behavioral")
    return value


def _slugify_track_id(label: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", str(label or "").strip().lower()).strip("_")
    return base or f"track_{uuid.uuid4().hex[:8]}"


def _track_payload_for_admin(db: Session, interview_type: str, track: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(track)
    payload["counts"] = track_question_counts(
        db,
        interview_type=interview_type,
        track_id=str(track.get("id") or ""),
    )
    return payload


class AdminQuestionBankTrackCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    track_type: str
    label: str
    description: Optional[str] = None
    is_active: bool = True


class AdminQuestionBankTrackUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class AdminQuestionBankQuestionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    track_id: str
    interview_type: str
    text: str
    is_active: bool = True


class AdminQuestionBankQuestionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/question-bank/tracks")
def admin_question_bank_tracks(
    interview_type: str = Query("technical"),
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    vertical = _question_bank_vertical(interview_type)
    tracks = list_effective_tracks(db, vertical, include_inactive=True)
    return {
        "interview_type": vertical,
        "items": [_track_payload_for_admin(db, vertical, track) for track in tracks],
    }


@router.post("/question-bank/tracks")
def admin_question_bank_create_track(
    payload: AdminQuestionBankTrackCreateRequest,
    admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    track_type = _question_bank_vertical(payload.track_type)
    label = str(payload.label or "").strip()
    if not label:
        raise HTTPException(status_code=422, detail="label is required")

    existing_effective = get_effective_track_map(db)
    base_slug = _slugify_track_id(label)
    candidate = base_slug
    counter = 2
    while candidate in existing_effective or db.query(models.AdminSkillTrack).filter(models.AdminSkillTrack.id == candidate).first():
        candidate = f"{base_slug}_{counter}"
        counter += 1

    row = models.AdminSkillTrack(
        id=candidate,
        track_type=track_type,
        source_kind="custom",
        label=label,
        description=(payload.description or "").strip() or None,
        is_active=bool(payload.is_active),
        created_by_clerk_user_id=getattr(admin_user, "clerk_user_id", None),
        updated_by_clerk_user_id=getattr(admin_user, "clerk_user_id", None),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    track = next((t for t in list_effective_tracks(db, track_type, include_inactive=True) if t["id"] == candidate), None)
    if not track:
        raise HTTPException(status_code=500, detail="Track created but could not be loaded")
    return _track_payload_for_admin(db, track_type, track)


@router.patch("/question-bank/tracks/{track_id}")
def admin_question_bank_update_track(
    track_id: str,
    payload: AdminQuestionBankTrackUpdateRequest,
    admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    if payload.label is None and payload.description is None and payload.is_active is None:
        raise HTTPException(status_code=422, detail="Provide at least one of: label, description, is_active")

    tid = str(track_id or "").strip().lower()
    effective = get_effective_track_map(db)
    current = effective.get(tid)
    if not current:
        raise HTTPException(status_code=404, detail="Track not found")

    is_system = is_system_track_id(tid)
    if is_system:
        row = db.query(models.AdminSkillTrack).filter(models.AdminSkillTrack.id == tid).first()
        if row and row.source_kind != "system_override":
            raise HTTPException(status_code=409, detail="Invalid system override row")
        if not row:
            row = models.AdminSkillTrack(
                id=tid,
                track_type=str(current.get("track_type") or ""),
                source_kind="system_override",
                label=str(current.get("label") or tid),
                description=str(current.get("description") or "") or None,
                is_active=bool(current.get("is_active", True)),
                created_by_clerk_user_id=getattr(admin_user, "clerk_user_id", None),
            )
            db.add(row)
        row.updated_by_clerk_user_id = getattr(admin_user, "clerk_user_id", None)
    else:
        row = db.query(models.AdminSkillTrack).filter(
            models.AdminSkillTrack.id == tid,
            models.AdminSkillTrack.source_kind == "custom",
        ).first()
        if not row:
            raise HTTPException(status_code=404, detail="Custom track not found")
        row.updated_by_clerk_user_id = getattr(admin_user, "clerk_user_id", None)

    if payload.label is not None:
        label = str(payload.label or "").strip()
        if not label:
            raise HTTPException(status_code=422, detail="label cannot be empty")
        row.label = label
    if payload.description is not None:
        row.description = str(payload.description or "").strip() or None
    if payload.is_active is not None:
        row.is_active = bool(payload.is_active)

    db.commit()

    vertical = "technical" if str(current.get("track_type") or "") == "technical" else "behavioral"
    updated_track = next((t for t in list_effective_tracks(db, vertical, include_inactive=True) if t["id"] == tid), None)
    if not updated_track:
        raise HTTPException(status_code=500, detail="Track updated but could not be loaded")
    return _track_payload_for_admin(db, vertical, updated_track)


@router.get("/question-bank/questions")
def admin_question_bank_questions(
    track_id: str = Query(...),
    interview_type: str = Query("technical"),
    include_inactive: bool = Query(True),
    _admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    vertical = _question_bank_vertical(interview_type)
    tid = str(track_id or "").strip().lower()
    track_map = get_effective_track_map(db)
    track = track_map.get(tid)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if str(track.get("track_type") or "") != vertical:
        raise HTTPException(status_code=422, detail="track_id does not belong to requested interview_type")

    return {
        "track_id": tid,
        "interview_type": vertical,
        "items": list_effective_track_questions(
            db,
            interview_type=vertical,
            track_id=tid,
            include_inactive=bool(include_inactive),
        ),
    }


@router.post("/question-bank/questions")
def admin_question_bank_create_question(
    payload: AdminQuestionBankQuestionCreateRequest,
    admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    vertical = _question_bank_vertical(payload.interview_type)
    tid = str(payload.track_id or "").strip().lower()
    track = get_effective_track_map(db).get(tid)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    if str(track.get("track_type") or "") != vertical:
        raise HTTPException(status_code=422, detail="track_id does not belong to requested interview_type")

    text = str(payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="text is required")

    row = models.AdminCustomQuestion(
        track_id=tid,
        track_type=vertical,
        text=text,
        difficulty_scope="all",
        is_active=bool(payload.is_active),
        created_by_clerk_user_id=getattr(admin_user, "clerk_user_id", None),
        updated_by_clerk_user_id=getattr(admin_user, "clerk_user_id", None),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "track_id": tid,
        "track_type": vertical,
        "source_kind": "custom",
        "text": row.text,
        "is_active": bool(row.is_active),
    }


@router.patch("/question-bank/custom-questions/{question_id}")
def admin_question_bank_update_custom_question(
    question_id: str,
    payload: AdminQuestionBankQuestionUpdateRequest,
    admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    if payload.text is None and payload.is_active is None:
        raise HTTPException(status_code=422, detail="Provide at least one of: text, is_active")

    row = db.query(models.AdminCustomQuestion).filter(models.AdminCustomQuestion.id == question_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Custom question not found")

    if payload.text is not None:
        text = str(payload.text or "").strip()
        if not text:
            raise HTTPException(status_code=422, detail="text cannot be empty")
        row.text = text
    if payload.is_active is not None:
        row.is_active = bool(payload.is_active)
    row.updated_by_clerk_user_id = getattr(admin_user, "clerk_user_id", None)
    db.commit()
    db.refresh(row)

    return {
        "id": row.id,
        "source_kind": "custom",
        "text": row.text,
        "is_active": bool(row.is_active),
        "track_id": row.track_id,
        "track_type": row.track_type,
    }


@router.patch("/question-bank/builtin-questions/{builtin_question_id}")
def admin_question_bank_update_builtin_question(
    builtin_question_id: str,
    payload: AdminQuestionBankQuestionUpdateRequest,
    admin_user=Depends(_get_admin_user),
    db: Session = Depends(get_db),
):
    qid = str(builtin_question_id or "").strip()
    if not qid:
        raise HTTPException(status_code=422, detail="builtin_question_id is required")
    if payload.text is None and payload.is_active is None:
        raise HTTPException(status_code=422, detail="Provide at least one of: text, is_active")
    if not builtin_question_exists(qid):
        raise HTTPException(status_code=404, detail="Builtin question not found")

    row = db.query(models.AdminQuestionOverride).filter(models.AdminQuestionOverride.builtin_question_id == qid).first()
    if not row:
        row = models.AdminQuestionOverride(builtin_question_id=qid)
        db.add(row)

    if payload.text is not None:
        text = str(payload.text or "").strip()
        if not text:
            raise HTTPException(status_code=422, detail="text cannot be empty")
        row.override_text = text
    if payload.is_active is not None:
        row.is_active = bool(payload.is_active)
    row.updated_by_clerk_user_id = getattr(admin_user, "clerk_user_id", None)
    db.commit()
    db.refresh(row)

    return {
        "builtin_question_id": qid,
        "source_kind": "builtin",
        "override_text": row.override_text,
        "is_active": row.is_active,
        "updated_at": row.updated_at,
    }
