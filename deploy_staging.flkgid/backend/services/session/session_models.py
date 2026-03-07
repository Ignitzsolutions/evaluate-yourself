"""Pydantic models for session management with strict validation."""

from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, ConfigDict
import uuid


class SessionMeta(BaseModel):
    """Session metadata."""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    schema_version: int = 1

    model_config = ConfigDict(extra="forbid")


class SessionCandidate(BaseModel):
    """Candidate information within session."""
    candidate_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    role: str = "candidate"
    locale: str = "en-US"
    tenant_id: str

    model_config = ConfigDict(extra="forbid")


class SessionState(BaseModel):
    """Current interview state."""
    stage: str = "CREATED"  # CREATED, TRANSCRIPT_ATTACHED, SCORING_STARTED, FEEDBACK_STARTED, FEEDBACK_GENERATED, ERROR, COMPLETED
    transcript_status: str = "PENDING"  # PENDING, ATTACHED, STORED
    scoring_status: str = "PENDING"  # PENDING, STARTED, COMPLETED
    feedback_status: str = "PENDING"  # PENDING, STARTED, COMPLETED
    error_message: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class SessionRefs(BaseModel):
    """References to related resources."""
    transcript_ids: List[str] = Field(default_factory=list, max_length=100)
    scorecard_id: Optional[str] = None
    feedback_id: Optional[str] = None
    feedback_ids: List[str] = Field(default_factory=list, max_length=100)
    event_ids: List[str] = Field(default_factory=list, max_length=1000)

    model_config = ConfigDict(extra="forbid")


class SessionData(BaseModel):
    """Complete session data structure."""
    meta: SessionMeta
    candidate: SessionCandidate
    state: SessionState
    refs: SessionRefs
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="forbid")


class LLMContext(BaseModel):
    """Minimal, safe context for LLM operations (no PII)."""
    session_id: str
    role: str = "candidate"
    locale: str = "en-US"
    previous_feedback_ids: List[str] = Field(default_factory=list)
    rubric_config: Optional[Dict[str, Any]] = None
    interview_type: str = "behavioral"

    model_config = ConfigDict(extra="forbid")


# Valid state transitions
ALLOWED_TRANSITIONS = {
    "CREATED": ["TRANSCRIPT_ATTACHED", "COMPLETED"],
    "TRANSCRIPT_ATTACHED": ["SCORING_STARTED", "COMPLETED"],
    "SCORING_STARTED": ["FEEDBACK_STARTED", "COMPLETED", "ERROR"],
    "FEEDBACK_STARTED": ["FEEDBACK_GENERATED", "COMPLETED", "ERROR"],
    "FEEDBACK_GENERATED": ["COMPLETED"],
    "ERROR": ["CREATED"],
    "COMPLETED": [],
}
