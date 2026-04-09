from backend.services.interview.replay import build_report_replay_payload


def test_build_report_replay_payload_marks_fallback_segments_and_overlay_markers():
    payload = build_report_replay_payload(
        session_id="session_replay",
        report={
            "transcript": [
                {"speaker": "ai", "text": "Question", "timestamp": "2026-04-09T09:00:00Z"},
                {"speaker": "user", "text": "Um I built a service", "timestamp": "2026-04-09T09:00:09Z"},
            ]
        },
        metrics={
            "total_duration": 2,
            "words_per_minute": 135,
            "score_trust_level": "mixed_evidence",
            "capture_status": "COMPLETE",
            "confidence_score": 68,
        },
        latest_capture_artifact={
            "payload": {
                "trusted_transcript": [{"speaker": "ai", "text": "Question"}],
                "fallback_transcript": [{"speaker": "user", "text": "Um I built a service"}],
                "word_timestamps": [{"word": "built", "start_ms": 0, "end_ms": 100}],
            }
        },
        gaze_events=[
            {
                "event_type": "LOOKING_DOWN",
                "description": "Looking down",
                "started_at": "2026-04-09T09:00:10Z",
                "ended_at": "2026-04-09T09:00:12Z",
                "duration_ms": 2000,
                "confidence": 82,
            }
        ],
    )

    assert payload["replay_available"] is True
    assert payload["segments"][1]["evidence_kind"] == "fallback"
    assert payload["gaze_windows"][0]["event_type"] == "LOOKING_DOWN"
    assert payload["filler_density_markers"][0]["filler_word_count"] >= 1
    assert payload["confidence_annotations"][1]["kind"] == "mixed_evidence"
