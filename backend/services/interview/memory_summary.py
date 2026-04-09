"""Round-summary helpers for carry-forward interview memory."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional


def _safe_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_skill(skill: Any) -> str:
    return _safe_text(skill).lower()


def _collect_demonstrated_skills(
    *,
    selected_skills: Iterable[Any],
    trusted_messages: Iterable[Dict[str, Any]],
) -> List[str]:
    selected = [_safe_text(skill) for skill in selected_skills if _safe_text(skill)]
    transcript_blob = " ".join(_safe_text(message.get("text")) for message in trusted_messages).lower()
    demonstrated = [skill for skill in selected if _normalize_skill(skill) in transcript_blob]
    if demonstrated:
        return demonstrated[:5]
    return selected[:3]


def _derive_weak_areas(
    *,
    turn_evaluations: Iterable[Dict[str, Any]],
    communication_metrics: Dict[str, Any],
) -> List[str]:
    weaknesses: List[str] = []
    for evaluation in turn_evaluations:
        if not isinstance(evaluation, dict):
            continue
        if isinstance(evaluation.get("clarity"), (int, float)) and evaluation.get("clarity") <= 3:
            weaknesses.append("clarity")
        if isinstance(evaluation.get("depth"), (int, float)) and evaluation.get("depth") <= 3:
            weaknesses.append("technical_depth")
        if isinstance(evaluation.get("relevance"), (int, float)) and evaluation.get("relevance") <= 3:
            weaknesses.append("relevance")
    for flag in communication_metrics.get("quality_flags", []) or []:
        if flag == "PACE_TOO_FAST":
            weaknesses.append("pacing_fast")
        elif flag == "PACE_TOO_SLOW":
            weaknesses.append("pacing_slow")
        elif "FILLER" in str(flag):
            weaknesses.append("filler_words")
    return list(dict.fromkeys(weaknesses))


def build_round_memory_summary(
    *,
    session_id: str,
    round_index: int,
    trusted_messages: List[Dict[str, Any]],
    selected_skills: Optional[List[str]],
    turn_evaluations: Optional[List[Dict[str, Any]]],
    communication_metrics: Optional[Dict[str, Any]],
    handoff_summary: Optional[Dict[str, Any]],
    capture_integrity: Optional[Dict[str, Any]],
    score_trust_level: str,
) -> Dict[str, Any]:
    trusted_messages = trusted_messages or []
    turn_evaluations = turn_evaluations or []
    communication_metrics = communication_metrics or {}
    capture_integrity = capture_integrity or {}
    last_user_answer = ""
    for message in reversed(trusted_messages):
        speaker = str(message.get("speaker") or "").strip().lower()
        if speaker in {"user", "candidate", "you"} and _safe_text(message.get("text")):
            last_user_answer = _safe_text(message.get("text"))
            break

    unresolved_followups: List[str] = []
    if last_user_answer:
        unresolved_followups.append(last_user_answer[:180])

    return {
        "session_id": session_id,
        "round_index": int(round_index or 0),
        "score_trust_level": score_trust_level,
        "degraded_memory": score_trust_level != "trusted"
        or int(capture_integrity.get("fallback_candidate_turn_count") or 0) > 0,
        "skills_demonstrated": _collect_demonstrated_skills(
            selected_skills=selected_skills or [],
            trusted_messages=trusted_messages,
        ),
        "weak_areas": _derive_weak_areas(
            turn_evaluations=turn_evaluations,
            communication_metrics=communication_metrics,
        ),
        "unresolved_follow_ups": unresolved_followups[:3],
        "handoff_context": handoff_summary or {},
        "trusted_candidate_turn_count": int(capture_integrity.get("trusted_candidate_turn_count") or 0),
    }
