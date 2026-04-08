"""Helpers for aggregating multi-channel evaluation output."""

from __future__ import annotations

from typing import Any, Dict, List


def aggregate_evaluation_channels(
    *,
    technical: Dict[str, Any] | None = None,
    communication: Dict[str, Any] | None = None,
    gaze: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    technical = technical or {}
    communication = communication or {}
    gaze = gaze or {}
    return {
        "technical_semantic": technical,
        "english_communication": communication,
        "gaze_behavioral": gaze,
        "confidence_score": communication.get("confidence_score")
        or technical.get("confidence_score")
        or gaze.get("confidence_score")
        or 0,
    }

