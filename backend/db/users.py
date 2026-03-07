import json
import os
from sqlalchemy.orm import Session
from .models import User, AuthIdentity, UserEmail, UserPhone, CandidateProfileV2
from datetime import datetime

def get_or_create_user(
    db: Session,
    clerk_user_id: str,
    email: str = None,
    full_name: str = None,
    phone_e164: str = None,
):
    user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    
    if user:
        # Update last login
        user.last_login_at = datetime.utcnow()
        if email:
            user.email = email
        if full_name:
            user.full_name = full_name
        if phone_e164 and phone_e164 != user.phone_e164:
            existing_phone = db.query(User).filter(
                User.phone_e164 == phone_e164,
                User.clerk_user_id != clerk_user_id,
            ).first()
            if not existing_phone:
                user.phone_e164 = phone_e164
        db.commit()
        db.refresh(user)
        return user

    safe_phone = phone_e164
    if phone_e164:
        existing_phone = db.query(User).filter(User.phone_e164 == phone_e164).first()
        if existing_phone and existing_phone.clerk_user_id != clerk_user_id:
            safe_phone = None

    # Create new user
    user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        phone_e164=safe_phone,
        full_name=full_name,
        is_active=True,
        is_deleted=False,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _normalize_email(email: str = None):
    if not email or not isinstance(email, str):
        return None
    value = email.strip().lower()
    return value or None


def _provider_instance_from_env() -> str:
    pk = (os.getenv("CLERK_PUBLISHABLE_KEY") or "").strip()
    if "_" not in pk:
        return ""
    try:
        import base64
        parts = pk.split("_", 2)
        if len(parts) < 3:
            return ""
        raw = base64.urlsafe_b64decode(parts[2] + "==")
        return raw.decode("utf-8").strip().rstrip("$")
    except Exception:
        return ""


def resolve_user_by_clerk_identity(
    db: Session,
    *,
    clerk_user_id: str,
    external_id: str = None,
):
    """Resolve a user using provider mapping first, then fallbacks.

    Compatibility intent:
    - new Clerk subject -> auth_identities.provider_user_id
    - migrated Clerk import externalId -> users.id or auth_identities.external_id
    - legacy behavior -> users.clerk_user_id
    """
    if clerk_user_id:
        try:
            identity = db.query(AuthIdentity).filter(
                AuthIdentity.provider == "clerk",
                AuthIdentity.provider_user_id == clerk_user_id,
            ).first()
        except Exception:
            identity = None
        if identity and identity.user_id:
            user = db.query(User).filter(User.id == identity.user_id).first()
            if user:
                return user

    if external_id:
        # Preferred migration path: Clerk externalId == app users.id
        user = db.query(User).filter(User.id == external_id).first()
        if user:
            return user
        try:
            identity = db.query(AuthIdentity).filter(
                AuthIdentity.provider == "clerk",
                AuthIdentity.external_id == external_id,
            ).first()
        except Exception:
            identity = None
        if identity and identity.user_id:
            user = db.query(User).filter(User.id == identity.user_id).first()
            if user:
                return user

    if clerk_user_id:
        return db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    return None


def sync_user_identity_graph(
    db: Session,
    *,
    user: User,
    clerk_user_id: str,
    external_id: str = None,
    legacy_provider_user_id: str = None,
    email: str = None,
    email_verified: bool = False,
    phone_e164: str = None,
    phone_verified: bool = False,
    raw_claims: dict = None,
):
    """Mirror auth/contact data into provider-agnostic tables (best-effort, additive)."""
    if not user or not clerk_user_id:
        return
    try:
        _sync_user_identity_graph_impl(
            db=db,
            user=user,
            clerk_user_id=clerk_user_id,
            external_id=external_id,
            legacy_provider_user_id=legacy_provider_user_id,
            email=email,
            email_verified=email_verified,
            phone_e164=phone_e164,
            phone_verified=phone_verified,
            raw_claims=raw_claims,
        )
    except Exception:
        # Migration may not be applied yet; do not block login.
        try:
            db.rollback()
        except Exception:
            pass
        return


def _sync_user_identity_graph_impl(
    db: Session,
    *,
    user: User,
    clerk_user_id: str,
    external_id: str = None,
    legacy_provider_user_id: str = None,
    email: str = None,
    email_verified: bool = False,
    phone_e164: str = None,
    phone_verified: bool = False,
    raw_claims: dict = None,
):
    """Internal implementation. Kept separate so outer wrapper can fail-open."""

    provider_instance = _provider_instance_from_env() or None
    identity = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "clerk",
        AuthIdentity.provider_user_id == clerk_user_id,
    ).first()
    if not identity and external_id:
        identity = db.query(AuthIdentity).filter(
            AuthIdentity.provider == "clerk",
            AuthIdentity.external_id == external_id,
        ).first()
    if not identity and legacy_provider_user_id:
        identity = db.query(AuthIdentity).filter(
            AuthIdentity.provider == "clerk",
            AuthIdentity.legacy_provider_user_id == legacy_provider_user_id,
        ).first()

    if not identity:
        identity = AuthIdentity(
            user_id=user.id,
            provider="clerk",
            provider_user_id=clerk_user_id,
            external_id=external_id,
            legacy_provider_user_id=legacy_provider_user_id,
            provider_instance=provider_instance,
            is_primary=True,
        )
        db.add(identity)
    else:
        identity.user_id = user.id
        identity.provider_user_id = clerk_user_id
        if external_id:
            identity.external_id = external_id
        if legacy_provider_user_id and legacy_provider_user_id != clerk_user_id:
            identity.legacy_provider_user_id = legacy_provider_user_id
        if provider_instance:
            identity.provider_instance = provider_instance
    if raw_claims is not None:
        try:
            identity.raw_claims_json = json.dumps(raw_claims)
        except Exception:
            pass

    normalized_email = _normalize_email(email)
    if normalized_email:
        email_row = db.query(UserEmail).filter(UserEmail.normalized_email == normalized_email).first()
        if not email_row:
            email_row = UserEmail(
                user_id=user.id,
                email=email,
                normalized_email=normalized_email,
                is_primary=True,
                is_verified=bool(email_verified),
                source="clerk",
            )
            db.add(email_row)
        else:
            email_row.user_id = user.id
            email_row.email = email
            email_row.is_primary = True
            email_row.is_verified = bool(email_verified) or bool(email_row.is_verified)
            email_row.source = "clerk"

    if phone_e164:
        phone_row = db.query(UserPhone).filter(UserPhone.phone_e164 == phone_e164).first()
        if not phone_row:
            phone_row = UserPhone(
                user_id=user.id,
                phone_e164=phone_e164,
                is_primary=True,
                is_verified=bool(phone_verified),
                source="clerk",
            )
            db.add(phone_row)
        else:
            phone_row.user_id = user.id
            phone_row.is_primary = True
            phone_row.is_verified = bool(phone_verified) or bool(phone_row.is_verified)
            phone_row.source = "clerk"

    # Best-effort denormalization into current users table fields (legacy schema compatible).
    if normalized_email and not user.email:
        user.email = email
    if phone_e164 and not user.phone_e164:
        user.phone_e164 = phone_e164


def candidate_profile_completeness_for_user(db: Session, user: User):
    """Return lightweight profile completeness and interview eligibility snapshot."""
    try:
        profile_v2 = db.query(CandidateProfileV2).filter(CandidateProfileV2.user_id == user.id).first()
    except Exception:
        profile_v2 = None
    reasons = []
    has_email = bool(user.email)
    has_phone = bool(user.phone_e164)
    email_verified = False
    phone_verified = False

    if has_email:
        try:
            email_row = db.query(UserEmail).filter(
                UserEmail.user_id == user.id,
                UserEmail.is_primary == True,  # noqa: E712
            ).first()
        except Exception:
            email_row = None
        email_verified = bool(email_row.is_verified) if email_row else False
    if has_phone:
        try:
            phone_row = db.query(UserPhone).filter(
                UserPhone.user_id == user.id,
                UserPhone.is_primary == True,  # noqa: E712
            ).first()
        except Exception:
            phone_row = None
        phone_verified = bool(phone_row.is_verified) if phone_row else False

    if not has_email:
        reasons.append("missing_email")
    if not has_phone:
        reasons.append("missing_phone")
    if has_email and not email_verified:
        reasons.append("email_not_verified")
    if has_phone and not phone_verified:
        reasons.append("phone_not_verified")

    if profile_v2:
        if not (profile_v2.state_code or "").strip():
            reasons.append("missing_state")
        if not (profile_v2.university_name or "").strip():
            reasons.append("missing_university")
        if not (profile_v2.primary_stream or "").strip():
            reasons.append("missing_primary_stream")
        try:
            target_roles = json.loads(profile_v2.target_roles_json or "[]")
        except Exception:
            target_roles = []
        if not target_roles:
            reasons.append("missing_target_roles")
        if not bool(profile_v2.consent_data_use):
            reasons.append("missing_consent_data_use")
    else:
        reasons.extend(["missing_candidate_profile"])

    score = 100
    if reasons:
        score = max(0, 100 - min(100, len(set(reasons)) * 15))

    return {
        "profile_completed": len(reasons) == 0,
        "profile_completion_score": int(score),
        "email_verified": bool(email_verified),
        "phone_verified": bool(phone_verified),
        "interview_eligibility": {
            "eligible": len(reasons) == 0,
            "reasons": sorted(set(reasons)),
        },
        "candidate_profile_v2_present": bool(profile_v2),
    }
