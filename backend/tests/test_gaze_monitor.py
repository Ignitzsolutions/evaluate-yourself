try:
    from services.gaze_monitor import (
        GAZE_EVENT_FACE_NOT_VISIBLE,
        GAZE_EVENT_OFF_SCREEN,
        GazeSessionTracker,
        map_direction_to_flag,
    )
except Exception:
    from backend.services.gaze_monitor import (  # pragma: no cover - fallback import path
        GAZE_EVENT_FACE_NOT_VISIBLE,
        GAZE_EVENT_OFF_SCREEN,
        GazeSessionTracker,
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
        eye_contact=True,
        confidence=0.0,
        detector_ready=False,
    )
    tracker.process_sample(
        t_ms=2500,
        gaze_direction="DETECTOR_UNAVAILABLE",
        eye_contact=True,
        confidence=0.0,
        detector_ready=False,
    )
    tracker.finalize(t_ms=2600)

    assert payload["detectorReady"] is False
    assert payload["activeFlag"] is None
    assert tracker.events == []


def test_summary_has_no_eye_contact_pct_without_samples():
    tracker = GazeSessionTracker()
    tracker.finalize(t_ms=1000)
    summary = tracker.summary()
    assert summary["eye_contact_pct"] is None
