try:
    from services.gaze_monitor import (
        GAZE_EVENT_FACE_NOT_VISIBLE,
        GAZE_EVENT_OFF_SCREEN,
        GazeSessionTracker,
        aggregate_gaze_events,
        map_direction_to_flag,
    )
except Exception:
    from backend.services.gaze_monitor import (  # pragma: no cover - fallback import path
        GAZE_EVENT_FACE_NOT_VISIBLE,
        GAZE_EVENT_OFF_SCREEN,
        GazeSessionTracker,
        aggregate_gaze_events,
        map_direction_to_flag,
    )


def test_map_direction_to_flag():
    assert map_direction_to_flag("LEFT") == "OFF_SCREEN"
    assert map_direction_to_flag("RIGHT") == "OFF_SCREEN"
    assert map_direction_to_flag("UP") == "LOOKING_UP"
    assert map_direction_to_flag("DOWN") == "LOOKING_DOWN"
    assert map_direction_to_flag("NO_FACE") == "FACE_NOT_VISIBLE"
    assert map_direction_to_flag("ON_SCREEN") is None


def test_off_screen_event_opens_after_sustain_and_closes():
    tracker = GazeSessionTracker()

    tracker.process_sample(t_ms=0, gaze_direction="LEFT", eye_contact=False, confidence=0.9)
    tracker.process_sample(t_ms=600, gaze_direction="LEFT", eye_contact=False, confidence=0.9)
    tracker.process_sample(t_ms=1200, gaze_direction="LEFT", eye_contact=False, confidence=0.9)
    tracker.process_sample(t_ms=1500, gaze_direction="ON_SCREEN", eye_contact=True, confidence=0.9)

    assert len(tracker.events) == 1
    event = tracker.events[0]
    assert event["event_type"] == GAZE_EVENT_OFF_SCREEN
    assert event["started_ms"] == 0
    assert event["ended_ms"] == 1500
    assert event["duration_ms"] == 1500


def test_low_confidence_off_screen_does_not_open_event():
    tracker = GazeSessionTracker()

    tracker.process_sample(t_ms=0, gaze_direction="LEFT", eye_contact=False, confidence=0.2)
    tracker.process_sample(t_ms=1400, gaze_direction="LEFT", eye_contact=False, confidence=0.2)
    tracker.process_sample(t_ms=1800, gaze_direction="ON_SCREEN", eye_contact=True, confidence=0.2)
    tracker.finalize(t_ms=1900)

    assert tracker.events == []


def test_same_type_events_merge_when_gap_small():
    tracker = GazeSessionTracker()

    tracker.process_sample(t_ms=0, gaze_direction="LEFT", eye_contact=False, confidence=0.9)
    tracker.process_sample(t_ms=1200, gaze_direction="LEFT", eye_contact=False, confidence=0.9)
    tracker.process_sample(t_ms=1500, gaze_direction="ON_SCREEN", eye_contact=True, confidence=0.9)

    tracker.process_sample(t_ms=1700, gaze_direction="RIGHT", eye_contact=False, confidence=0.9)
    tracker.process_sample(t_ms=2900, gaze_direction="RIGHT", eye_contact=False, confidence=0.9)
    tracker.process_sample(t_ms=3200, gaze_direction="ON_SCREEN", eye_contact=True, confidence=0.9)

    assert len(tracker.events) == 1
    event = tracker.events[0]
    assert event["event_type"] == GAZE_EVENT_OFF_SCREEN
    assert event["started_ms"] == 0
    assert event["ended_ms"] == 3200
    assert event["duration_ms"] == 3200


def test_camera_toggle_creates_face_not_visible_event_immediately():
    tracker = GazeSessionTracker()

    tracker.set_camera_enabled(enabled=False, t_ms=1000)
    tracker.set_camera_enabled(enabled=True, t_ms=1500)

    assert len(tracker.events) == 1
    event = tracker.events[0]
    assert event["event_type"] == GAZE_EVENT_FACE_NOT_VISIBLE
    assert event["started_ms"] == 1000
    assert event["ended_ms"] == 1500
    assert event["duration_ms"] == 500
    assert event["confidence"] == 100


def test_detector_unavailable_does_not_create_false_face_not_visible_flags():
    tracker = GazeSessionTracker()

    payload = tracker.process_sample(
        t_ms=1000,
        gaze_direction="DETECTOR_UNAVAILABLE",
        eye_contact=False,
        confidence=0.0,
        detector_ready=False,
    )
    tracker.process_sample(
        t_ms=2500,
        gaze_direction="DETECTOR_UNAVAILABLE",
        eye_contact=False,
        confidence=0.0,
        detector_ready=False,
    )
    tracker.finalize(t_ms=2600)

    assert payload["detectorReady"] is False
    assert payload["eyeContact"] is False
    assert payload["gazeDirection"] == "DETECTOR_UNAVAILABLE"
    assert payload["activeFlag"] is None
    assert tracker.events == []


def test_summary_has_no_eye_contact_pct_without_samples():
    tracker = GazeSessionTracker()
    tracker.finalize(t_ms=1000)
    summary = tracker.summary()
    assert summary["eye_contact_pct"] is None


def test_calibrating_samples_do_not_count_toward_eye_contact_or_create_flags():
    tracker = GazeSessionTracker()

    payload = tracker.process_sample(
        t_ms=1000,
        gaze_direction="CALIBRATING",
        eye_contact=False,
        confidence=0.75,
        detector_ready=True,
        tracking_active=False,
        source="mediapipe_face_landmarker_v1",
        algorithm_version="mediapipe_face_landmarker_v1",
    )
    tracker.finalize(t_ms=1600)

    assert payload["trackingActive"] is False
    assert payload["gazeDirection"] == "CALIBRATING"
    assert payload["eyeContactPct"] is None
    assert tracker.events == []
    assert tracker.summary()["algorithm_version"] == "mediapipe_face_landmarker_v1"


def test_aggregate_gaze_events_uses_rows_for_monitoring_window_and_fallback_for_eye_contact():
    rows = [
        {
            "event_type": GAZE_EVENT_OFF_SCREEN,
            "duration_ms": 1400,
            "started_at": "2026-04-06T10:00:00+00:00",
            "ended_at": "2026-04-06T10:00:01.400000+00:00",
        },
        {
            "event_type": GAZE_EVENT_FACE_NOT_VISIBLE,
            "duration_ms": 500,
            "started_at": "2026-04-06T10:00:02+00:00",
            "ended_at": "2026-04-06T10:00:02.500000+00:00",
        },
    ]
    fallback = {
        "eye_contact_pct": 61.4,
        "algorithm_version": "mediapipe_face_landmarker_v1",
        "calibration_valid": True,
    }

    summary = aggregate_gaze_events(rows, fallback_summary=fallback)

    assert summary["total_events"] == 2
    assert summary["events_by_type"][GAZE_EVENT_OFF_SCREEN] == 1
    assert summary["events_by_type"][GAZE_EVENT_FACE_NOT_VISIBLE] == 1
    assert summary["total_off_screen_ms"] == 1900
    assert summary["longest_event_ms"] == 1400
    assert summary["eye_contact_pct"] == 61.4
    assert summary["monitoring_started_at"] == "2026-04-06T10:00:00+00:00"
    assert summary["monitoring_ended_at"] == "2026-04-06T10:00:02.500000+00:00"
    assert summary["algorithm_version"] == "mediapipe_face_landmarker_v1"
