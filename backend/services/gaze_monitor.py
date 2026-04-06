"""Lightweight gaze classification and event tracking helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import base64
import math

try:
    import numpy as np

    NP_AVAILABLE = True
except ImportError:  # pragma: no cover - runtime optional
    np = None
    NP_AVAILABLE = False

try:
    import cv2

    CV2_AVAILABLE = True
except ImportError:  # pragma: no cover - runtime optional
    cv2 = None
    CV2_AVAILABLE = False


GAZE_EVENT_OFF_SCREEN = "OFF_SCREEN"
GAZE_EVENT_LOOKING_UP = "LOOKING_UP"
GAZE_EVENT_LOOKING_DOWN = "LOOKING_DOWN"
GAZE_EVENT_FACE_NOT_VISIBLE = "FACE_NOT_VISIBLE"

VERTICAL_UP_THRESHOLD = -0.22
VERTICAL_DOWN_THRESHOLD = 0.24
HORIZONTAL_LEFT_THRESHOLD = -0.28
HORIZONTAL_RIGHT_THRESHOLD = 0.28

EVENT_DESCRIPTIONS = {
    GAZE_EVENT_OFF_SCREEN: "Candidate looked away from screen",
    GAZE_EVENT_LOOKING_UP: "Candidate looked up away from primary screen focus",
    GAZE_EVENT_LOOKING_DOWN: "Candidate looked down away from primary screen focus",
    GAZE_EVENT_FACE_NOT_VISIBLE: "Candidate face not visible in camera view",
}

DEFAULT_GAZE_SOURCE = "opencv_haar_v1"

FLAG_SUSTAIN_MS = 1200
FLAG_MERGE_GAP_MS = 400
FLAG_COOLDOWN_MS = 500
CONFIDENCE_FLOOR = 0.45

_FACE_CASCADE = None


def _get_face_cascade():
    global _FACE_CASCADE
    if not CV2_AVAILABLE:
        return None
    if _FACE_CASCADE is None:
        _FACE_CASCADE = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    return _FACE_CASCADE


def _iso_from_ms(ts_ms: Optional[int]) -> Optional[str]:
    if ts_ms is None:
        return None
    return datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc).isoformat()


def map_direction_to_flag(gaze_direction: str) -> Optional[str]:
    direction = str(gaze_direction or "").upper()
    if direction in {"LEFT", "RIGHT"}:
        return GAZE_EVENT_OFF_SCREEN
    if direction == "UP":
        return GAZE_EVENT_LOOKING_UP
    if direction == "DOWN":
        return GAZE_EVENT_LOOKING_DOWN
    if direction == "NO_FACE":
        return GAZE_EVENT_FACE_NOT_VISIBLE
    return None


def detect_gaze_metrics(frame) -> Dict[str, Any]:
    """Run lightweight face-position based gaze direction detection."""
    unavailable_payload = {
        "eyeContact": False,
        "gazeDirection": "DETECTOR_UNAVAILABLE",
        "conf": 0.0,
        "faceDetected": False,
        "detectorReady": False,
        "trackingActive": False,
        "algorithmVersion": DEFAULT_GAZE_SOURCE,
        "source": DEFAULT_GAZE_SOURCE,
    }
    default_payload = {
        "eyeContact": False,
        "gazeDirection": "NO_FACE",
        "conf": 0.0,
        "faceDetected": False,
        "detectorReady": True,
        "trackingActive": True,
        "algorithmVersion": DEFAULT_GAZE_SOURCE,
        "source": DEFAULT_GAZE_SOURCE,
    }
    if not CV2_AVAILABLE or not NP_AVAILABLE:
        return unavailable_payload
    if frame is None:
        return default_payload

    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        cascade = _get_face_cascade()
        if cascade is None or (hasattr(cascade, "empty") and cascade.empty()):
            return unavailable_payload

        faces = cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)
        if len(faces) == 0:
            return default_payload

        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        fh, fw = frame.shape[:2]
        if fw <= 0 or fh <= 0:
            return default_payload

        face_cx = x + (w / 2.0)
        face_cy = y + (h / 2.0)
        norm_dx = (face_cx - (fw / 2.0)) / max(fw / 2.0, 1.0)
        norm_dy = (face_cy - (fh / 2.0)) / max(fh / 2.0, 1.0)

        direction = "ON_SCREEN"
        # Vertical first so down/up takes precedence when both are significant.
        if norm_dy < VERTICAL_UP_THRESHOLD:
            direction = "UP"
        elif norm_dy > VERTICAL_DOWN_THRESHOLD:
            direction = "DOWN"
        elif norm_dx < HORIZONTAL_LEFT_THRESHOLD:
            direction = "LEFT"
        elif norm_dx > HORIZONTAL_RIGHT_THRESHOLD:
            direction = "RIGHT"

        face_area_ratio = float((w * h) / max(fw * fh, 1.0))
        # Confidence grows with usable face size and center proximity.
        center_penalty = min(1.0, math.sqrt((norm_dx**2) + (norm_dy**2)))
        conf = min(1.0, max(0.0, (face_area_ratio * 6.5) * (1.0 - 0.45 * center_penalty)))

        return {
            "eyeContact": direction == "ON_SCREEN",
            "gazeDirection": direction,
            "conf": round(float(conf), 4),
            "faceDetected": True,
            "detectorReady": True,
            "trackingActive": True,
            "algorithmVersion": DEFAULT_GAZE_SOURCE,
            "source": DEFAULT_GAZE_SOURCE,
        }
    except Exception:
        return default_payload


def decode_data_url_to_frame(data_url: str):
    if not CV2_AVAILABLE or not NP_AVAILABLE:
        return None
    if not data_url or "," not in data_url:
        return None
    try:
        b64 = data_url.split(",", 1)[1]
        buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
        return cv2.imdecode(buf, cv2.IMREAD_COLOR)
    except Exception:
        return None


class GazeSessionTracker:
    """Tracks gaze samples and emits debounced flag events."""

    def __init__(self):
        self.monitoring_started_ms: Optional[int] = None
        self.monitoring_ended_ms: Optional[int] = None
        self.total_samples = 0
        self.in_contact_samples = 0
        self.eye_contact_pct = 0.0
        self.latest_direction = "NO_FACE"
        self.latest_confidence = 0.0
        self.camera_enabled = True

        self.pending_flag: Optional[str] = None
        self.pending_since_ms: Optional[int] = None
        self.pending_confidence: float = 0.0

        self.active_event: Optional[Dict[str, Any]] = None
        self.events: List[Dict[str, Any]] = []
        self.last_closed_by_type: Dict[str, int] = {}
        self.source_name = DEFAULT_GAZE_SOURCE
        self.algorithm_version = DEFAULT_GAZE_SOURCE

    def _clear_pending(self) -> None:
        self.pending_flag = None
        self.pending_since_ms = None
        self.pending_confidence = 0.0

    def set_camera_enabled(self, enabled: bool, t_ms: int) -> None:
        enabled = bool(enabled)
        if self.camera_enabled == enabled:
            return
        self.camera_enabled = enabled
        if not enabled:
            # Immediate hard flag when user explicitly turns off camera.
            self._transition(
                t_ms=t_ms,
                next_flag=GAZE_EVENT_FACE_NOT_VISIBLE,
                confidence=1.0,
                direction="NO_FACE",
                force_open=True,
            )
        else:
            # Close FORCE no-face flag quickly when camera returns.
            self._transition(
                t_ms=t_ms,
                next_flag=None,
                confidence=1.0,
                direction="ON_SCREEN",
                force_open=False,
            )

    def _merge_or_append(self, event: Dict[str, Any]) -> None:
        if self.events:
            prev = self.events[-1]
            if (
                prev.get("event_type") == event.get("event_type")
                and int(event["started_ms"]) - int(prev["ended_ms"]) <= FLAG_MERGE_GAP_MS
            ):
                prev["ended_ms"] = event["ended_ms"]
                prev["duration_ms"] = int(prev["ended_ms"]) - int(prev["started_ms"])
                prev["confidence"] = max(int(prev.get("confidence") or 0), int(event.get("confidence") or 0))
                return
        self.events.append(event)

    def _close_active(self, t_ms: int) -> None:
        if not self.active_event:
            return
        started_ms = int(self.active_event["started_ms"])
        ended_ms = max(int(t_ms), started_ms + 1)
        confidence = int(round(float(self.active_event.get("confidence") or 0.0) * 100))
        event = {
            "event_type": self.active_event["event_type"],
            "description": EVENT_DESCRIPTIONS.get(self.active_event["event_type"], "Gaze flag event"),
            "started_ms": started_ms,
            "ended_ms": ended_ms,
            "duration_ms": ended_ms - started_ms,
            "confidence": max(0, min(100, confidence)),
            "source": self.source_name,
            "extra": {
                "direction_open": self.active_event.get("direction"),
                "camera_enabled": self.camera_enabled,
                "algorithm_version": self.algorithm_version,
            },
        }
        self._merge_or_append(event)
        self.last_closed_by_type[event["event_type"]] = ended_ms
        self.active_event = None

    def _open_active(self, t_ms: int, event_type: str, confidence: float, direction: str) -> None:
        self.active_event = {
            "event_type": event_type,
            "started_ms": int(t_ms),
            "confidence": float(confidence),
            "direction": direction,
        }

    def _transition(
        self,
        t_ms: int,
        next_flag: Optional[str],
        confidence: float,
        direction: str,
        force_open: bool = False,
    ) -> None:
        if self.active_event:
            active_type = self.active_event["event_type"]
            if next_flag == active_type:
                self.active_event["confidence"] = max(float(self.active_event.get("confidence") or 0.0), float(confidence))
                return
            self._close_active(t_ms)

        if not next_flag:
            self._clear_pending()
            return

        cooldown_ok = (t_ms - int(self.last_closed_by_type.get(next_flag, -10_000))) >= FLAG_COOLDOWN_MS
        if force_open and cooldown_ok:
            self._clear_pending()
            self._open_active(t_ms=t_ms, event_type=next_flag, confidence=confidence, direction=direction)
            return

        if self.pending_flag != next_flag:
            self.pending_flag = next_flag
            self.pending_since_ms = int(t_ms)
            self.pending_confidence = float(confidence)
            return

        if self.pending_since_ms is None:
            self.pending_since_ms = int(t_ms)
            self.pending_confidence = float(confidence)
            return

        self.pending_confidence = max(self.pending_confidence, float(confidence))
        sustained_ms = int(t_ms) - int(self.pending_since_ms)
        if sustained_ms < FLAG_SUSTAIN_MS:
            return
        if not cooldown_ok:
            return
        if next_flag != GAZE_EVENT_FACE_NOT_VISIBLE and float(self.pending_confidence) < CONFIDENCE_FLOOR:
            return

        self._open_active(
            t_ms=int(self.pending_since_ms),
            event_type=next_flag,
            confidence=self.pending_confidence,
            direction=direction,
        )
        self._clear_pending()

    def process_sample(
        self,
        t_ms: int,
        gaze_direction: str,
        eye_contact: bool,
        confidence: float,
        detector_ready: bool = True,
        tracking_active: bool = True,
        source: str = DEFAULT_GAZE_SOURCE,
        algorithm_version: str = DEFAULT_GAZE_SOURCE,
    ) -> Dict[str, Any]:
        t_ms = int(t_ms)
        if self.monitoring_started_ms is None:
            self.monitoring_started_ms = t_ms
        self.monitoring_ended_ms = t_ms
        self.source_name = str(source or DEFAULT_GAZE_SOURCE)
        self.algorithm_version = str(algorithm_version or self.source_name or DEFAULT_GAZE_SOURCE)

        if not detector_ready:
            self.latest_direction = "DETECTOR_UNAVAILABLE"
            self.latest_confidence = 0.0
            self._transition(
                t_ms=t_ms,
                next_flag=None,
                confidence=0.0,
                direction="DETECTOR_UNAVAILABLE",
                force_open=False,
            )
            return {
                "t": t_ms,
                "eyeContact": False,
                "eyeContactPct": self.eye_contact_pct if self.total_samples > 0 else None,
                "gazeDirection": "DETECTOR_UNAVAILABLE",
                "conf": 0.0,
                "faceDetected": False,
                "activeFlag": None,
                "cameraEnabled": self.camera_enabled,
                "detectorReady": False,
                "trackingActive": False,
                "algorithmVersion": self.algorithm_version,
                "source": self.source_name,
            }

        if not tracking_active:
            direction = str(gaze_direction or "CALIBRATING").upper()
            self.latest_direction = direction
            self.latest_confidence = float(confidence or 0.0)
            self._transition(
                t_ms=t_ms,
                next_flag=None,
                confidence=0.0,
                direction=direction,
                force_open=False,
            )
            return {
                "t": t_ms,
                "eyeContact": False,
                "eyeContactPct": self.eye_contact_pct if self.total_samples > 0 else None,
                "gazeDirection": direction,
                "conf": round(float(confidence or 0.0), 4),
                "faceDetected": direction not in {"NO_FACE", "DETECTOR_UNAVAILABLE"},
                "activeFlag": None,
                "cameraEnabled": self.camera_enabled,
                "detectorReady": True,
                "trackingActive": False,
                "algorithmVersion": self.algorithm_version,
                "source": self.source_name,
            }

        direction = str(gaze_direction or "NO_FACE").upper()
        self.latest_direction = direction
        self.latest_confidence = float(confidence or 0.0)

        self.total_samples += 1
        if eye_contact:
            self.in_contact_samples += 1
        self.eye_contact_pct = round((self.in_contact_samples / max(1, self.total_samples)) * 100.0, 2)

        flag = GAZE_EVENT_FACE_NOT_VISIBLE if not self.camera_enabled else map_direction_to_flag(direction)
        self._transition(
            t_ms=t_ms,
            next_flag=flag,
            confidence=float(confidence or 0.0),
            direction=direction,
            force_open=False,
        )

        return {
            "t": t_ms,
            "eyeContact": bool(eye_contact),
            "eyeContactPct": self.eye_contact_pct,
            "gazeDirection": direction,
            "conf": round(float(confidence or 0.0), 4),
            "faceDetected": direction != "NO_FACE",
            "activeFlag": self.active_event["event_type"] if self.active_event else None,
            "cameraEnabled": self.camera_enabled,
            "detectorReady": True,
            "trackingActive": True,
            "algorithmVersion": self.algorithm_version,
            "source": self.source_name,
        }

    def finalize(self, t_ms: Optional[int] = None) -> None:
        if t_ms is None:
            t_ms = self.monitoring_ended_ms or self.monitoring_started_ms or int(datetime.now(tz=timezone.utc).timestamp() * 1000)
        t_ms = int(t_ms)
        self._close_active(t_ms)
        self._clear_pending()
        self.monitoring_ended_ms = t_ms

    def summary(self) -> Dict[str, Any]:
        counts: Dict[str, int] = {}
        total_off_screen_ms = 0
        longest_event_ms = 0
        for event in self.events:
            et = str(event.get("event_type") or "")
            counts[et] = counts.get(et, 0) + 1
            duration = int(event.get("duration_ms") or 0)
            longest_event_ms = max(longest_event_ms, duration)
            if et in {
                GAZE_EVENT_OFF_SCREEN,
                GAZE_EVENT_LOOKING_UP,
                GAZE_EVENT_LOOKING_DOWN,
                GAZE_EVENT_FACE_NOT_VISIBLE,
            }:
                total_off_screen_ms += duration

        return {
            "total_events": len(self.events),
            "events_by_type": counts,
            "total_off_screen_ms": total_off_screen_ms,
            "longest_event_ms": longest_event_ms,
            "eye_contact_pct": self.eye_contact_pct if self.total_samples > 0 else None,
            "monitoring_started_at": _iso_from_ms(self.monitoring_started_ms),
            "monitoring_ended_at": _iso_from_ms(self.monitoring_ended_ms),
            "algorithm_version": self.algorithm_version,
        }


def aggregate_gaze_events(rows: List[Dict[str, Any]], fallback_summary: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    counts: Dict[str, int] = {}
    longest = 0
    total_ms = 0
    started_at_values = []
    ended_at_values = []
    for row in rows:
        et = str(row.get("event_type") or "")
        duration = int(row.get("duration_ms") or 0)
        counts[et] = counts.get(et, 0) + 1
        longest = max(longest, duration)
        total_ms += max(0, duration)
        started_at = row.get("started_at")
        ended_at = row.get("ended_at")
        if started_at:
            started_at_values.append(started_at)
        if ended_at:
            ended_at_values.append(ended_at)

    eye_contact_pct = None
    if isinstance(fallback_summary, dict):
        eye_contact_pct = fallback_summary.get("eye_contact_pct")

    return {
        "total_events": len(rows),
        "events_by_type": counts,
        "total_off_screen_ms": total_ms,
        "longest_event_ms": longest,
        "eye_contact_pct": eye_contact_pct,
        "monitoring_started_at": min(started_at_values).isoformat() if started_at_values else (
            fallback_summary.get("monitoring_started_at") if isinstance(fallback_summary, dict) else None
        ),
        "monitoring_ended_at": max(ended_at_values).isoformat() if ended_at_values else (
            fallback_summary.get("monitoring_ended_at") if isinstance(fallback_summary, dict) else None
        ),
        "algorithm_version": (
            str((fallback_summary or {}).get("algorithm_version") or DEFAULT_GAZE_SOURCE)
            if isinstance(fallback_summary, dict)
            else DEFAULT_GAZE_SOURCE
        ),
    }
