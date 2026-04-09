"""Communication-quality analytics derived from trusted transcript evidence."""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List


_USER_SPEAKERS = {"user", "candidate", "you"}
_FILLER_PATTERNS = [
    r"\bum\b",
    r"\buh\b",
    r"\ber\b",
    r"\bah\b",
    r"\blike\b",
    r"\byou know\b",
    r"\bkind of\b",
    r"\bsort of\b",
    r"\bbasically\b",
    r"\bactually\b",
]


def _normalize_speaker(value: Any) -> str:
    return str(value or "").strip().lower()


def _candidate_messages(messages: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        message
        for message in messages
        if isinstance(message, dict)
        and _normalize_speaker(message.get("speaker")) in _USER_SPEAKERS
        and str(message.get("text") or "").strip()
    ]


def count_filler_words(text: str) -> int:
    content = str(text or "").strip().lower()
    if not content:
        return 0
    return sum(len(re.findall(pattern, content, flags=re.IGNORECASE)) for pattern in _FILLER_PATTERNS)


def classify_pacing_band(words_per_minute: int) -> str:
    if words_per_minute <= 0:
        return "insufficient_data"
    if words_per_minute < 110:
        return "slow"
    if words_per_minute <= 160:
        return "ideal"
    return "fast"


def analyze_communication_metrics(
    *,
    trusted_messages: List[Dict[str, Any]],
    total_duration_minutes: int,
    avg_response_time_seconds: float = 0.0,
) -> Dict[str, Any]:
    candidate_messages = _candidate_messages(trusted_messages)
    candidate_turn_count = len(candidate_messages)
    total_words = sum(len(str(message.get("text") or "").split()) for message in candidate_messages)
    filler_word_count = sum(count_filler_words(str(message.get("text") or "")) for message in candidate_messages)
    words_per_minute = round(total_words / max(int(total_duration_minutes or 0), 1)) if total_words > 0 else 0
    filler_words_per_100 = round((filler_word_count * 100) / max(total_words, 1), 2) if total_words > 0 else 0.0
    pacing_band = classify_pacing_band(words_per_minute)

    flags: List[str] = []
    if pacing_band == "slow":
        flags.append("PACE_TOO_SLOW")
    elif pacing_band == "fast":
        flags.append("PACE_TOO_FAST")
    if filler_words_per_100 >= 8:
        flags.append("HIGH_FILLER_DENSITY")
    elif filler_words_per_100 >= 4:
        flags.append("MODERATE_FILLER_DENSITY")
    if avg_response_time_seconds and avg_response_time_seconds >= 12:
        flags.append("SLOW_RESPONSE_LATENCY")

    return {
        "candidate_turn_count": candidate_turn_count,
        "candidate_word_count": total_words,
        "words_per_minute": words_per_minute,
        "pacing_band": pacing_band,
        "avg_response_time_seconds": round(float(avg_response_time_seconds or 0), 2),
        "filler_word_count": filler_word_count,
        "filler_words_per_100": filler_words_per_100,
        "quality_flags": flags,
    }


def compute_confidence_score(
    *,
    trust_level: str,
    contract_passed: bool,
    capture_integrity: Dict[str, Any],
    communication_metrics: Dict[str, Any] | None = None,
    gaze_summary: Dict[str, Any] | None = None,
    turns_evaluated: int = 0,
) -> int:
    if not contract_passed:
        return 20

    communication_metrics = communication_metrics or {}
    gaze_summary = gaze_summary or {}
    trusted_turns = int(capture_integrity.get("trusted_candidate_turn_count") or 0)
    trusted_words = int(capture_integrity.get("trusted_candidate_word_count") or 0)
    fallback_turns = int(capture_integrity.get("fallback_candidate_turn_count") or 0)

    score = 0

    if trust_level == "trusted":
        score += 40
    elif trust_level == "mixed_evidence":
        score += 28
    else:
        score += 16

    score += min(20, trusted_turns * 6)
    score += min(12, trusted_words // 20)
    score += min(10, max(int(turns_evaluated), 0) * 2)

    if communication_metrics.get("words_per_minute", 0) > 0:
        score += 8
    if communication_metrics.get("filler_word_count", 0) >= 0 and communication_metrics.get("candidate_turn_count", 0) > 0:
        score += 6
    if communication_metrics.get("avg_response_time_seconds", 0) > 0:
        score += 4

    if gaze_summary.get("eye_contact_pct") is not None:
        score += 8
    if gaze_summary.get("total_events") is not None:
        score += 2

    if fallback_turns > 0:
        score -= min(14, fallback_turns * 4)
    if trusted_turns == 0:
        score -= 18

    return max(0, min(100, int(score)))
