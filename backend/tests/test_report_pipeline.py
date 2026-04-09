from backend.services.interview.report_pipeline import (
    build_candidate_turn_pairs_for_evaluation,
    determine_score_trust_level,
    normalize_transcript_payload,
)
from backend.services.interview.communication_analytics import (
    analyze_communication_metrics,
    compute_confidence_score,
)


def test_normalize_transcript_payload_separates_trusted_and_fallback_candidate_messages():
    payload = normalize_transcript_payload(
        {
            "mode": "hybrid",
            "raw_messages": [
                {
                    "speaker": "ai",
                    "text": "Tell me about a recent production incident.",
                    "timestamp": "2026-04-08T10:00:00Z",
                    "trusted_for_evaluation": True,
                },
                {
                    "speaker": "user",
                    "text": "I handled a database failover and coordinated rollback steps.",
                    "timestamp": "2026-04-08T10:00:08Z",
                    "trusted_for_evaluation": True,
                },
                {
                    "speaker": "ai",
                    "text": "What was the hardest tradeoff?",
                    "timestamp": "2026-04-08T10:00:15Z",
                    "trusted_for_evaluation": True,
                },
                {
                    "speaker": "user",
                    "text": "I think the hardest part was communication speed.",
                    "timestamp": "2026-04-08T10:00:21Z",
                    "trusted_for_evaluation": False,
                    "transcript_origin": "browser_speech_fallback",
                },
            ],
        }
    )

    assert len(payload["trusted_raw_messages"]) == 3
    assert len(payload["fallback_raw_messages"]) == 1
    assert payload["capture_integrity"]["trusted_candidate_turn_count"] == 1
    assert payload["capture_integrity"]["fallback_candidate_turn_count"] == 1


def test_build_candidate_turn_pairs_for_evaluation_uses_only_trusted_pairs():
    payload = normalize_transcript_payload(
        {
            "mode": "hybrid",
            "raw_messages": [
                {"speaker": "ai", "text": "Question 1", "timestamp": "2026-04-08T10:00:00Z", "trusted_for_evaluation": True},
                {"speaker": "user", "text": "Trusted answer", "timestamp": "2026-04-08T10:00:05Z", "trusted_for_evaluation": True},
                {"speaker": "ai", "text": "Question 2", "timestamp": "2026-04-08T10:00:10Z", "trusted_for_evaluation": True},
                {"speaker": "user", "text": "Fallback answer", "timestamp": "2026-04-08T10:00:15Z", "trusted_for_evaluation": False},
            ],
        }
    )

    pairs = build_candidate_turn_pairs_for_evaluation(payload)

    assert pairs == [{"question": "Question 1", "answer": "Trusted answer"}]


def test_determine_score_trust_level_marks_mixed_evidence():
    trust_level = determine_score_trust_level(
        capture_status="COMPLETE",
        capture_integrity={
            "contains_mixed_candidate_evidence": True,
            "fallback_candidate_turn_count": 1,
        },
        contract_passed=True,
        hard_guard_flags=[],
    )

    assert trust_level == "mixed_evidence"


def test_analyze_communication_metrics_derives_pacing_and_filler_signals():
    metrics = analyze_communication_metrics(
        trusted_messages=[
            {
                "speaker": "user",
                "text": "Um I led the rollout and like coordinated rollback plans with the team.",
            },
            {
                "speaker": "user",
                "text": "Basically we reduced risk before deployment.",
            },
        ],
        total_duration_minutes=1,
        avg_response_time_seconds=13.4,
    )

    assert metrics["candidate_turn_count"] == 2
    assert metrics["words_per_minute"] > 0
    assert metrics["filler_word_count"] >= 3
    assert "SLOW_RESPONSE_LATENCY" in metrics["quality_flags"]


def test_compute_confidence_score_rewards_trusted_multi_channel_evidence():
    score = compute_confidence_score(
        trust_level="trusted",
        contract_passed=True,
        capture_integrity={
            "trusted_candidate_turn_count": 3,
            "trusted_candidate_word_count": 96,
            "fallback_candidate_turn_count": 0,
        },
        communication_metrics={
            "candidate_turn_count": 3,
            "words_per_minute": 138,
            "filler_word_count": 2,
            "avg_response_time_seconds": 4.2,
        },
        gaze_summary={"eye_contact_pct": 88, "total_events": 1},
        turns_evaluated=3,
    )

    assert score >= 80


def test_compute_confidence_score_penalizes_fallback_heavy_capture():
    score = compute_confidence_score(
        trust_level="mixed_evidence",
        contract_passed=True,
        capture_integrity={
            "trusted_candidate_turn_count": 1,
            "trusted_candidate_word_count": 18,
            "fallback_candidate_turn_count": 2,
        },
        communication_metrics={"candidate_turn_count": 1, "words_per_minute": 95, "filler_word_count": 4},
        gaze_summary={},
        turns_evaluated=1,
    )

    assert score < 70
