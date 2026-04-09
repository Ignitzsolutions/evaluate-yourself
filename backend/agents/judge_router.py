"""Evaluation channel routing helpers."""

from __future__ import annotations

from typing import Any, Dict, List


def build_evaluation_channel_plan() -> Dict[str, Any]:
    return {
        "technical_semantic": {
            "enabled": True,
            "trusted_source": "server_transcript",
            "rubric_bound": True,
        },
        "english_communication": {
            "enabled": True,
            "signals": ["wpm", "filler_words", "grammar", "response_latency"],
        },
        "gaze_behavioral": {
            "enabled": True,
            "signals": ["gaze_vectors", "eye_contact", "offscreen_windows"],
        },
    }


def route_evaluation_channels(
    *,
    trusted_transcript: List[Dict[str, Any]],
    capture_integrity: Dict[str, Any],
    gaze_summary: Dict[str, Any] | None = None,
    communication_metrics: Dict[str, Any] | None = None,
    turns_evaluated: int = 0,
    trust_level: str | None = None,
) -> Dict[str, Any]:
    communication_metrics = communication_metrics or {}
    return {
        "technical_semantic": {
            "trusted_turns": len(trusted_transcript),
            "turns_evaluated": int(turns_evaluated or 0),
            "capture_integrity": capture_integrity,
            "trust_level": trust_level or "trusted",
        },
        "english_communication": {
            "candidate_turns": capture_integrity.get("trusted_candidate_turn_count", 0),
            "words_per_minute": communication_metrics.get("words_per_minute"),
            "pacing_band": communication_metrics.get("pacing_band"),
            "filler_word_count": communication_metrics.get("filler_word_count"),
            "filler_words_per_100": communication_metrics.get("filler_words_per_100"),
            "avg_response_time_seconds": communication_metrics.get("avg_response_time_seconds"),
            "quality_flags": communication_metrics.get("quality_flags", []),
        },
        "gaze_behavioral": {
            "eye_contact_pct": (gaze_summary or {}).get("eye_contact_pct"),
            "flags": (gaze_summary or {}).get("total_events", 0),
        },
    }
