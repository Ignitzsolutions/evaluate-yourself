"""Session lifecycle management and state transitions."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from .session_models import (
    SessionData, SessionMeta, SessionCandidate, SessionState, SessionRefs,
    LLMContext, ALLOWED_TRANSITIONS
)
from .session_store import SessionStore

logger = logging.getLogger(__name__)


class SessionManager:
    """Manages session lifecycle and state transitions."""

    def __init__(self, store: SessionStore, default_ttl_hours: int = 1):
        """Initialize with session store."""
        self.store = store
        self.default_ttl_seconds = default_ttl_hours * 3600

    def create_session(
        self,
        candidate_id: str,
        tenant_id: str,
        email: Optional[str] = None,
        name: Optional[str] = None,
        role: str = "candidate",
        locale: str = "en-US"
    ) -> SessionData:
        """Create a new session."""
        now = datetime.now(timezone.utc)
        session = SessionData(
            meta=SessionMeta(
                created_at=now,
                last_seen_at=now,
                expires_at=now + timedelta(seconds=self.default_ttl_seconds)
            ),
            candidate=SessionCandidate(
                candidate_id=candidate_id,
                email=email,
                name=name,
                role=role,
                locale=locale,
                tenant_id=tenant_id
            ),
            state=SessionState(stage="CREATED"),
            refs=SessionRefs()
        )
        self.store.set(session.meta.session_id, session, self.default_ttl_seconds)
        logger.info(f"Created session {session.meta.session_id} for candidate {candidate_id}")
        return session

    def get_session(self, session_id: str) -> Optional[SessionData]:
        """Get session by ID."""
        session = self.store.get(session_id)
        if session and self._is_expired(session):
            self.store.delete(session_id)
            return None
        return session

    def validate_session(self, session_id: str, tenant_id: str) -> bool:
        """Validate session exists and belongs to tenant."""
        session = self.get_session(session_id)
        if not session:
            return False
        if session.candidate.tenant_id != tenant_id:
            logger.warning(f"Tenant mismatch: {tenant_id} != {session.candidate.tenant_id}")
            return False
        return True

    def touch_session(self, session_id: str) -> bool:
        """Refresh session TTL."""
        return self.store.touch(session_id, self.default_ttl_seconds)

    def update_state(self, session_id: str, new_stage: str) -> Optional[SessionData]:
        """Update session stage with validation."""
        session = self.get_session(session_id)
        if not session:
            return None

        current_stage = session.state.stage
        if new_stage not in ALLOWED_TRANSITIONS.get(current_stage, []):
            logger.error(f"Invalid transition: {current_stage} -> {new_stage}")
            return None

        session.state.stage = new_stage
        session.meta.last_seen_at = datetime.now(timezone.utc)
        self.store.set(session_id, session, self.default_ttl_seconds)
        logger.info(f"Updated session {session_id} stage: {current_stage} -> {new_stage}")
        return session

    def build_llm_context(self, session: SessionData) -> LLMContext:
        """Build safe LLM context from session (no PII)."""
        return LLMContext(
            session_id=session.meta.session_id,
            role=session.candidate.role,
            locale=session.candidate.locale,
            previous_feedback_ids=session.refs.feedback_ids,
            interview_type="behavioral"
        )

    def delete_session(self, session_id: str) -> bool:
        """Delete session."""
        return self.store.delete(session_id)

    def _is_expired(self, session: SessionData) -> bool:
        """Check if session is expired."""
        if not session.meta.expires_at:
            return False
        return datetime.now(timezone.utc) > session.meta.expires_at
