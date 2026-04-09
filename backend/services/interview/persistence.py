"""Lightweight persistence helpers for interview rounds, snapshots, and evidence."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from backend.db import models


def persist_interview_round(
    db: Session,
    *,
    session_id: str,
    clerk_user_id: str,
    round_index: int,
    agent_owner: str,
    phase: str,
    question_id: Optional[str],
    question_text: Optional[str],
    handoff_reason: Optional[str],
    summary: Optional[Dict[str, Any]] = None,
) -> models.InterviewRound:
    row = (
        db.query(models.InterviewRound)
        .filter(
            models.InterviewRound.session_id == session_id,
            models.InterviewRound.round_index == round_index,
        )
        .first()
    )
    if not row:
        row = models.InterviewRound(
            session_id=session_id,
            clerk_user_id=clerk_user_id,
            round_index=round_index,
            agent_owner=agent_owner,
            phase=phase,
            question_id=question_id,
            question_text=question_text,
            handoff_reason=handoff_reason,
            started_at=datetime.utcnow(),
            summary_json=json.dumps(summary or {}),
        )
        db.add(row)
    else:
        row.clerk_user_id = clerk_user_id
        row.agent_owner = agent_owner
        row.phase = phase
        row.question_id = question_id
        row.question_text = question_text
        row.handoff_reason = handoff_reason
        row.summary_json = json.dumps(summary or {})
    db.commit()
    db.refresh(row)
    return row


def persist_session_memory_snapshot(
    db: Session,
    *,
    session_id: str,
    clerk_user_id: str,
    round_index: int,
    snapshot_kind: str,
    memory: Dict[str, Any],
    resume_token: Optional[str] = None,
) -> models.SessionMemorySnapshot:
    row = models.SessionMemorySnapshot(
        session_id=session_id,
        clerk_user_id=clerk_user_id,
        round_index=round_index,
        snapshot_kind=snapshot_kind,
        resume_token=resume_token,
        memory_json=json.dumps(memory or {}),
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def persist_evidence_artifact(
    db: Session,
    *,
    session_id: str,
    clerk_user_id: str,
    artifact_type: str,
    source: str,
    trust_level: str,
    payload: Dict[str, Any],
    word_timestamps: Optional[Any] = None,
    capture_integrity: Optional[Dict[str, Any]] = None,
) -> models.EvidenceArtifact:
    row = models.EvidenceArtifact(
        session_id=session_id,
        clerk_user_id=clerk_user_id,
        artifact_type=artifact_type,
        source=source,
        trust_level=trust_level,
        payload_json=json.dumps(payload or {}),
        word_timestamps_json=json.dumps(word_timestamps or []),
        capture_integrity_json=json.dumps(capture_integrity or {}),
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def load_latest_evidence_artifact(
    db: Session,
    *,
    session_id: str,
    artifact_type: str = "capture_bundle",
) -> Optional[Dict[str, Any]]:
    row = (
        db.query(models.EvidenceArtifact)
        .filter(
            models.EvidenceArtifact.session_id == session_id,
            models.EvidenceArtifact.artifact_type == artifact_type,
        )
        .order_by(models.EvidenceArtifact.created_at.desc())
        .first()
    )
    if not row:
        return None
    try:
        payload = json.loads(row.payload_json or "{}")
    except Exception:
        payload = {}
    try:
        word_timestamps = json.loads(row.word_timestamps_json or "[]")
    except Exception:
        word_timestamps = []
    try:
        capture_integrity = json.loads(row.capture_integrity_json or "{}")
    except Exception:
        capture_integrity = {}
    return {
        "artifact_id": row.id,
        "session_id": row.session_id,
        "clerk_user_id": row.clerk_user_id,
        "artifact_type": row.artifact_type,
        "source": row.source,
        "trust_level": row.trust_level,
        "payload": payload,
        "word_timestamps": word_timestamps,
        "capture_integrity": capture_integrity,
    }


def load_latest_memory_snapshot(
    db: Session,
    *,
    session_id: str,
    snapshot_kind: Optional[str] = None,
    before_round_index: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    query = db.query(models.SessionMemorySnapshot).filter(
        models.SessionMemorySnapshot.session_id == session_id
    )
    if snapshot_kind:
        query = query.filter(models.SessionMemorySnapshot.snapshot_kind == snapshot_kind)
    if before_round_index is not None:
        query = query.filter(models.SessionMemorySnapshot.round_index < int(before_round_index))
    row = query.order_by(
        models.SessionMemorySnapshot.round_index.desc(),
        models.SessionMemorySnapshot.created_at.desc(),
    ).first()
    if not row:
        return None
    try:
        memory = json.loads(row.memory_json or "{}")
    except Exception:
        memory = {}
    return {
        "snapshot_id": row.id,
        "session_id": row.session_id,
        "clerk_user_id": row.clerk_user_id,
        "round_index": row.round_index,
        "snapshot_kind": row.snapshot_kind,
        "resume_token": row.resume_token,
        "memory": memory,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
