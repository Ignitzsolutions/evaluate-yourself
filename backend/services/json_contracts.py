"""Typed validators for high-value JSON blobs stored in Text columns."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class ConfidenceField(BaseModel):
    model_config = ConfigDict(extra="allow")

    value: Any = None
    confidence: float = Field(default=0, ge=0, le=1)


class ResumeDraftContract(BaseModel):
    model_config = ConfigDict(extra="allow")

    rawText: str = ""
    fields: Dict[str, ConfidenceField] = Field(default_factory=dict)

    @field_validator("rawText", mode="before")
    @classmethod
    def _coerce_raw_text(cls, value: Any) -> str:
        return str(value or "")


class BaselineCaptureContract(BaseModel):
    model_config = ConfigDict(extra="allow")

    status: str
    capturedAt: Optional[datetime] = None
    skippedAt: Optional[datetime] = None
    durationSeconds: Optional[int] = Field(default=None, ge=0, le=60)
    audio: Optional[bool] = None
    video: Optional[bool] = None

    @field_validator("status")
    @classmethod
    def _valid_status(cls, value: str) -> str:
        status = str(value or "").strip().lower()
        if status not in {"captured", "skipped", "failed"}:
            raise ValueError("status must be captured, skipped, or failed")
        return status


class ReportMetricsContract(BaseModel):
    model_config = ConfigDict(extra="allow")

    confidence_score: Optional[int] = Field(default=None, ge=0, le=100)
    filler_words_per_100: Optional[float] = Field(default=None, ge=0)
    avg_response_latency_ms: Optional[float] = Field(default=None, ge=0)
    score_ledger: List[Dict[str, Any]] = Field(default_factory=list)


class SessionMetaContract(BaseModel):
    model_config = ConfigDict(extra="allow")

    track: Optional[str] = None
    primary_stream: Optional[str] = None
    difficulty: Optional[str] = None
    asked_question_ids: List[str] = Field(default_factory=list)
    resume_token: Optional[str] = None


def validate_resume_draft(payload: Any) -> Dict[str, Any]:
    return ResumeDraftContract.model_validate(payload or {}).model_dump(mode="json")


def validate_baseline_capture(payload: Any) -> Dict[str, Any]:
    return BaselineCaptureContract.model_validate(payload or {}).model_dump(mode="json", exclude_none=True)


def normalize_report_metrics(payload: Any) -> Dict[str, Any]:
    try:
        return ReportMetricsContract.model_validate(payload or {}).model_dump(mode="json", exclude_none=True)
    except ValidationError:
        return dict(payload) if isinstance(payload, dict) else {}


def normalize_session_meta(payload: Any) -> Dict[str, Any]:
    try:
        return SessionMetaContract.model_validate(payload or {}).model_dump(mode="json", exclude_none=True)
    except ValidationError:
        return dict(payload) if isinstance(payload, dict) else {}
