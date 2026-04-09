"""Helpers for building replay payloads from persisted report evidence."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

try:
    from backend.services.interview.communication_analytics import count_filler_words
except Exception:  # pragma: no cover
    from services.interview.communication_analytics import count_filler_words  # type: ignore


def _safe_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _safe_text(value: Any) -> str:
    return str(value or "").strip()


def _word_count(text: str) -> int:
    return len(_safe_text(text).split())


def _normalize_speaker(value: Any) -> str:
    speaker = str(value or "").strip().lower()
    if speaker in {"ai", "interviewer", "sonia"}:
        return "ai"
    if speaker in {"user", "candidate", "you"}:
        return "user"
    return speaker or "unknown"


def _offset_ms(ts: Optional[datetime], base_ts: Optional[datetime]) -> Optional[int]:
    if not ts or not base_ts:
        return None
    return max(0, int((ts - base_ts).total_seconds() * 1000))


def _segment_end_ms(
    index: int,
    transcript: List[Dict[str, Any]],
    current_offset_ms: Optional[int],
    total_duration_ms: int,
) -> Optional[int]:
    if current_offset_ms is None:
        return None
    for next_message in transcript[index + 1 :]:
        next_dt = _safe_dt(next_message.get("timestamp"))
        if not next_dt:
            continue
        next_offset_ms = _offset_ms(next_dt, _safe_dt(transcript[0].get("timestamp")))
        if next_offset_ms is not None and next_offset_ms > current_offset_ms:
            return next_offset_ms
    estimated = current_offset_ms + max(2200, _word_count(_safe_text(transcript[index].get("text"))) * 340)
    if total_duration_ms > 0:
        return min(total_duration_ms, estimated)
    return estimated


def _build_transcript_segments(
    transcript: List[Dict[str, Any]],
    *,
    total_duration_ms: int,
    trusted_lookup: set[tuple[str, str]],
    fallback_lookup: set[tuple[str, str]],
) -> List[Dict[str, Any]]:
    if not transcript:
        return []

    base_ts = _safe_dt(transcript[0].get("timestamp"))
    segments: List[Dict[str, Any]] = []
    for index, item in enumerate(transcript):
        text = _safe_text(item.get("text"))
        if not text:
            continue
        ts = _safe_dt(item.get("timestamp"))
        start_ms = _offset_ms(ts, base_ts)
        speaker = _normalize_speaker(item.get("speaker"))
        lookup_key = (speaker, text)
        evidence_kind = "trusted"
        if lookup_key in fallback_lookup:
            evidence_kind = "fallback"
        elif trusted_lookup and lookup_key not in trusted_lookup:
            evidence_kind = "derived"
        segments.append(
            {
                "segment_id": f"segment_{index + 1}",
                "speaker": speaker,
                "text": text,
                "timestamp": item.get("timestamp"),
                "start_ms": start_ms,
                "end_ms": _segment_end_ms(index, transcript, start_ms, total_duration_ms),
                "word_count": _word_count(text),
                "evidence_kind": evidence_kind,
                "transcript_origin": item.get("transcript_origin"),
            }
        )
    return segments


def _build_pacing_samples(transcript_segments: List[Dict[str, Any]], default_wpm: int) -> List[Dict[str, Any]]:
    samples: List[Dict[str, Any]] = []
    previous_user_start_ms: Optional[int] = None
    for segment in transcript_segments:
        if segment.get("speaker") != "user":
            continue
        start_ms = segment.get("start_ms")
        words = int(segment.get("word_count") or 0)
        estimated_wpm = default_wpm
        if previous_user_start_ms is not None and isinstance(start_ms, int) and start_ms > previous_user_start_ms:
            delta_minutes = (start_ms - previous_user_start_ms) / 60000.0
            if delta_minutes > 0:
                estimated_wpm = int(round(words / delta_minutes)) if words > 0 else 0
        samples.append(
            {
                "time_ms": start_ms,
                "words_per_minute": estimated_wpm,
                "word_count": words,
                "speaker": "user",
            }
        )
        previous_user_start_ms = start_ms if isinstance(start_ms, int) else previous_user_start_ms
    return samples


def _build_filler_density_markers(transcript_segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    markers: List[Dict[str, Any]] = []
    for segment in transcript_segments:
        if segment.get("speaker") != "user":
            continue
        text = _safe_text(segment.get("text"))
        filler_count = count_filler_words(text)
        words = max(_word_count(text), 1)
        if filler_count <= 0:
            continue
        markers.append(
            {
                "time_ms": segment.get("start_ms"),
                "filler_word_count": filler_count,
                "filler_words_per_100": round((filler_count * 100) / words, 2),
                "excerpt": text[:160],
            }
        )
    return markers


def _build_gaze_windows(
    *,
    gaze_events: Iterable[Dict[str, Any]],
    base_ts: Optional[datetime],
) -> List[Dict[str, Any]]:
    windows: List[Dict[str, Any]] = []
    for event in gaze_events:
        started_at = _safe_dt(event.get("started_at"))
        ended_at = _safe_dt(event.get("ended_at"))
        windows.append(
            {
                "event_type": event.get("event_type"),
                "description": event.get("description"),
                "start_ms": _offset_ms(started_at, base_ts),
                "end_ms": _offset_ms(ended_at, base_ts),
                "duration_ms": event.get("duration_ms"),
                "confidence": event.get("confidence"),
            }
        )
    return windows


def build_report_replay_payload(
    *,
    session_id: str,
    report: Dict[str, Any],
    metrics: Dict[str, Any],
    latest_capture_artifact: Optional[Dict[str, Any]] = None,
    gaze_events: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    transcript = report.get("transcript") if isinstance(report.get("transcript"), list) else []
    total_duration_minutes = int(metrics.get("total_duration") or 0)
    total_duration_ms = max(0, total_duration_minutes * 60 * 1000)
    artifact_payload = latest_capture_artifact.get("payload", {}) if isinstance(latest_capture_artifact, dict) else {}
    trusted_lookup = {
        (_normalize_speaker(item.get("speaker")), _safe_text(item.get("text")))
        for item in artifact_payload.get("trusted_transcript", []) or []
        if _safe_text(item.get("text"))
    }
    fallback_lookup = {
        (_normalize_speaker(item.get("speaker")), _safe_text(item.get("text")))
        for item in artifact_payload.get("fallback_transcript", []) or []
        if _safe_text(item.get("text"))
    }

    transcript_segments = _build_transcript_segments(
        transcript,
        total_duration_ms=total_duration_ms,
        trusted_lookup=trusted_lookup,
        fallback_lookup=fallback_lookup,
    )
    base_ts = _safe_dt(transcript[0].get("timestamp")) if transcript else None
    pacing_samples = _build_pacing_samples(
        transcript_segments,
        int(metrics.get("words_per_minute") or 0),
    )
    filler_markers = _build_filler_density_markers(transcript_segments)
    confidence_annotations = [
        {
            "kind": "session_trust",
            "time_ms": 0,
            "score_trust_level": metrics.get("score_trust_level", "trusted"),
            "capture_status": metrics.get("capture_status", "COMPLETE"),
            "confidence_score": metrics.get("confidence_score"),
        }
    ]
    if metrics.get("score_trust_level") == "mixed_evidence":
        confidence_annotations.append(
            {
                "kind": "mixed_evidence",
                "time_ms": 0,
                "message": "Browser fallback transcript was excluded from trusted scoring.",
            }
        )
    if metrics.get("capture_status") == "INCOMPLETE_FALLBACK_ONLY_CAPTURE":
        confidence_annotations.append(
            {
                "kind": "fallback_only_capture",
                "time_ms": 0,
                "message": "Replay is available, but fallback-only candidate capture reduced score trust.",
            }
        )

    return {
        "session_id": session_id,
        "replay_available": bool(transcript_segments),
        "provider_trace": metrics.get("provider_trace"),
        "agent_handoff_summary": metrics.get("agent_handoff_summary"),
        "memory_summary": metrics.get("memory_summary"),
        "segments": transcript_segments,
        "word_timestamps": artifact_payload.get("word_timestamps", []),
        "gaze_windows": _build_gaze_windows(gaze_events=gaze_events or [], base_ts=base_ts),
        "pacing_samples": pacing_samples,
        "filler_density_markers": filler_markers,
        "confidence_annotations": confidence_annotations,
        "capture_integrity": metrics.get("capture_integrity", {}),
        "score_trust_level": metrics.get("score_trust_level", "trusted"),
        "evaluation_channels": metrics.get("evaluation_channels", {}),
    }
