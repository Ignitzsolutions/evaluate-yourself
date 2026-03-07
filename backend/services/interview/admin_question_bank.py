"""Admin-managed question bank overlays and effective catalog helpers."""

from __future__ import annotations

import copy
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

try:
    from db import models
except Exception:  # pragma: no cover
    from backend.db import models  # type: ignore

try:
    from data.interview_questions import (
        ALL_QUESTIONS,
        QUESTIONS_BY_ID,
        get_questions_by_type_and_difficulty,
    )
except Exception:  # pragma: no cover
    from backend.data.interview_questions import (  # type: ignore
        ALL_QUESTIONS,
        QUESTIONS_BY_ID,
        get_questions_by_type_and_difficulty,
    )

try:
    from services.interview.skill_tracks import (
        TRACKS_BY_ID,
        catalog_for_interview_type,
        normalize_track_ids,
        question_matches_track,
        skill_selection_rules,
        track_label,
        track_opening_question,
    )
except Exception:  # pragma: no cover
    from backend.services.interview.skill_tracks import (  # type: ignore
        TRACKS_BY_ID,
        catalog_for_interview_type,
        normalize_track_ids,
        question_matches_track,
        skill_selection_rules,
        track_label,
        track_opening_question,
    )


TRACK_TYPES = {"technical", "behavioral"}


def _copy_track(track: Dict[str, Any]) -> Dict[str, Any]:
    item = dict(track)
    if isinstance(item.get("domains"), set):
        item["domains"] = set(item["domains"])
    if isinstance(item.get("tags_any"), set):
        item["tags_any"] = set(item["tags_any"])
    return item


def _query_track_rows(db: Session) -> List[models.AdminSkillTrack]:
    return db.query(models.AdminSkillTrack).all()


def _question_override_map(db: Session) -> Dict[str, models.AdminQuestionOverride]:
    rows = db.query(models.AdminQuestionOverride).all()
    return {str(row.builtin_question_id): row for row in rows if row.builtin_question_id}


def _custom_question_rows(db: Session) -> List[models.AdminCustomQuestion]:
    return db.query(models.AdminCustomQuestion).all()


def get_effective_track_map(db: Session) -> Dict[str, Dict[str, Any]]:
    track_map: Dict[str, Dict[str, Any]] = {
        track_id: {
            **_copy_track(track),
            "source_kind": "system",
            "is_active": True,
        }
        for track_id, track in TRACKS_BY_ID.items()
    }

    for row in _query_track_rows(db):
        tid = str(row.id or "").strip().lower()
        if not tid:
            continue
        if row.source_kind == "system_override":
            base = track_map.get(tid)
            if not base:
                continue
            if row.label:
                base["label"] = row.label
            if row.description is not None:
                base["description"] = row.description
            base["is_active"] = bool(row.is_active)
            base["source_kind"] = "system"
            continue

        if row.source_kind == "custom":
            track_map[tid] = {
                "id": tid,
                "label": row.label,
                "description": row.description or "",
                "track_type": str(row.track_type or "").strip().lower(),
                "domains": set(),
                "tags_any": set(),
                "opening_question": None,
                "source_kind": "custom",
                "is_active": bool(row.is_active),
            }

    return track_map


def list_effective_tracks(
    db: Session,
    interview_type: str,
    *,
    include_inactive: bool = False,
) -> List[Dict[str, Any]]:
    interview = str(interview_type or "technical").strip().lower()
    allowed_type = "technical" if interview in {"technical", "mixed"} else "behavioral"
    effective = get_effective_track_map(db)
    out: List[Dict[str, Any]] = []
    for track in effective.values():
        if str(track.get("track_type") or "").strip().lower() != allowed_type:
            continue
        if (not include_inactive) and (not bool(track.get("is_active", True))):
            continue
        out.append(
            {
                "id": str(track.get("id")),
                "label": str(track.get("label") or ""),
                "description": str(track.get("description") or ""),
                "track_type": allowed_type,
                "source_kind": "custom" if track.get("source_kind") == "custom" else "system",
                "is_active": bool(track.get("is_active", True)),
            }
        )
    out.sort(key=lambda item: (item["source_kind"] != "system", item["label"].lower(), item["id"]))
    return out


def validate_selected_skills_effective(
    db: Session,
    interview_type: str,
    selected_skills: Optional[List[str]],
) -> Tuple[List[str], Optional[str]]:
    selected = normalize_track_ids(selected_skills)
    rules = skill_selection_rules(interview_type)
    allowed_type = rules["allowed_track_type"]

    if len(selected) < rules["min"] or len(selected) > rules["max"]:
        return [], (
            f"Invalid selectedSkills count for {interview_type}. "
            f"Expected between {rules['min']} and {rules['max']} selections."
        )

    track_map = get_effective_track_map(db)
    for track_id in selected:
        track = track_map.get(track_id)
        if not track:
            return [], f"Unknown skill track: {track_id}"
        if not bool(track.get("is_active", True)):
            return [], f"Skill track {track_id} is inactive."
        if track.get("track_type") != allowed_type:
            return [], f"Skill track {track_id} is not valid for {interview_type} interviews."
    return selected, None


def track_label_effective(db: Session, track_id: str) -> str:
    track = get_effective_track_map(db).get(str(track_id or "").strip().lower())
    if not track:
        return track_label(track_id)
    return str(track.get("label") or track_id)


def track_opening_question_effective(db: Session, track_id: str) -> Optional[str]:
    track = get_effective_track_map(db).get(str(track_id or "").strip().lower())
    if not track:
        return track_opening_question(track_id)
    opening = track.get("opening_question")
    if isinstance(opening, str) and opening.strip():
        return opening.strip()
    return None


def _question_family_type(interview_type: str) -> str:
    value = str(interview_type or "technical").strip().lower()
    if value in {"technical", "behavioral"}:
        return value
    return "mixed"


def _static_questions_for_family(interview_type: str) -> List[Dict[str, Any]]:
    return list(get_questions_by_type_and_difficulty(_question_family_type(interview_type), difficulty=None))


def _apply_builtin_overrides_to_question(
    question: Dict[str, Any],
    override_map: Dict[str, models.AdminQuestionOverride],
) -> Optional[Dict[str, Any]]:
    qid = str(question.get("id") or "")
    row = override_map.get(qid)
    if row and row.is_active is False:
        return None
    cloned = copy.deepcopy(question)
    if row and isinstance(row.override_text, str) and row.override_text.strip():
        cloned["text"] = row.override_text.strip()
    if row:
        cloned["_admin_overridden"] = True
    return cloned


def _include_custom_question_for_difficulty(row: models.AdminCustomQuestion, difficulty: Optional[str]) -> bool:
    scope = str(row.difficulty_scope or "all").strip().lower()
    if scope in {"", "all"}:
        return True
    if not difficulty:
        return True
    return scope == str(difficulty).strip().lower()


def _custom_question_to_runtime_dict(row: models.AdminCustomQuestion, difficulty: Optional[str]) -> Dict[str, Any]:
    q_difficulty = str(difficulty or "mid").strip().lower() or "mid"
    track_id = str(row.track_id or "").strip().lower()
    track_type = str(row.track_type or "").strip().lower()
    return {
        "id": f"custom_{row.id}",
        "text": str(row.text or "").strip(),
        "difficulty": q_difficulty,
        "domain": "behavioral" if track_type == "behavioral" else "custom_admin",
        "topic_tags": ["admin_custom", f"track:{track_id}"],
        "expected_signals": [],
        "followups_ref": [],
        "_admin_track_id": track_id,
        "_source_kind": "custom",
    }


def get_effective_questions_by_type_and_difficulty(
    db: Session,
    interview_type: str,
    difficulty: Optional[str] = "mid",
) -> List[Dict[str, Any]]:
    family = _question_family_type(interview_type)
    override_map = _question_override_map(db)
    static_pool = get_questions_by_type_and_difficulty(family, difficulty) if family in {"technical", "behavioral", "mixed"} else []

    merged: List[Dict[str, Any]] = []
    for q in static_pool:
        updated = _apply_builtin_overrides_to_question(q, override_map)
        if updated:
            merged.append(updated)

    track_types: set[str]
    if family == "mixed":
        track_types = {"technical", "behavioral"}
    else:
        track_types = {family}

    for row in _custom_question_rows(db):
        if not bool(row.is_active):
            continue
        row_track_type = str(row.track_type or "").strip().lower()
        if row_track_type not in track_types:
            continue
        if not _include_custom_question_for_difficulty(row, difficulty):
            continue
        text = str(row.text or "").strip()
        if not text:
            continue
        merged.append(_custom_question_to_runtime_dict(row, difficulty))

    return merged


def list_effective_track_questions(
    db: Session,
    *,
    interview_type: str,
    track_id: str,
    include_inactive: bool = True,
) -> List[Dict[str, Any]]:
    family = "technical" if str(interview_type).strip().lower() == "technical" else "behavioral"
    normalized_track_id = str(track_id or "").strip().lower()
    override_map = _question_override_map(db)

    items: List[Dict[str, Any]] = []
    for q in _static_questions_for_family(family):
        if not question_matches_track(q, normalized_track_id):
            continue
        qid = str(q.get("id") or "")
        ov = override_map.get(qid)
        is_active = True if ov is None or ov.is_active is None else bool(ov.is_active)
        if not include_inactive and not is_active:
            continue
        text = str(q.get("text") or "").strip()
        if ov and isinstance(ov.override_text, str) and ov.override_text.strip():
            text = ov.override_text.strip()
        items.append(
            {
                "id": qid,
                "source_kind": "builtin",
                "text": text,
                "is_active": is_active,
                "overridden": bool(ov and ((ov.override_text and ov.override_text.strip()) or ov.is_active is not None)),
                "editable_fields": ["text", "is_active"],
                "difficulty": q.get("difficulty"),
                "domain": q.get("domain"),
            }
        )

    for row in db.query(models.AdminCustomQuestion).filter(
        models.AdminCustomQuestion.track_id == normalized_track_id,
        models.AdminCustomQuestion.track_type == family,
    ).order_by(models.AdminCustomQuestion.sort_order.asc(), models.AdminCustomQuestion.created_at.asc()).all():
        is_active = bool(row.is_active)
        if not include_inactive and not is_active:
            continue
        items.append(
            {
                "id": row.id,
                "source_kind": "custom",
                "text": str(row.text or "").strip(),
                "is_active": is_active,
                "overridden": False,
                "editable_fields": ["text", "is_active"],
                "difficulty": row.difficulty_scope,
                "domain": "behavioral" if family == "behavioral" else "custom_admin",
            }
        )

    items.sort(key=lambda item: (item["source_kind"] != "builtin", str(item["text"]).lower()))
    return items


def track_question_counts(db: Session, *, interview_type: str, track_id: str) -> Dict[str, int]:
    questions = list_effective_track_questions(
        db,
        interview_type=interview_type,
        track_id=track_id,
        include_inactive=True,
    )
    builtin_questions = sum(1 for q in questions if q["source_kind"] == "builtin")
    custom_questions = sum(1 for q in questions if q["source_kind"] == "custom")
    active_total = sum(1 for q in questions if q.get("is_active"))
    return {
        "builtin_questions": int(builtin_questions),
        "custom_questions": int(custom_questions),
        "active_total": int(active_total),
    }


def is_system_track_id(track_id: str) -> bool:
    return str(track_id or "").strip().lower() in TRACKS_BY_ID


def builtin_question_exists(question_id: str) -> bool:
    return str(question_id or "").strip() in QUESTIONS_BY_ID


def list_system_tracks_for_admin(interview_type: str) -> List[Dict[str, Any]]:
    """Convenience passthrough used by admin/UI code when DB is unavailable in tests."""
    return catalog_for_interview_type(interview_type)
