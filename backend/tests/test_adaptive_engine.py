from backend.services.interview.adaptive_engine import decide_next_turn, normalize_difficulty


def test_normalize_difficulty_mapping():
    assert normalize_difficulty("easy") == "junior"
    assert normalize_difficulty("medium") == "mid"
    assert normalize_difficulty("hard") == "senior"
    assert normalize_difficulty("unknown") == "mid"


def test_low_relevance_routes_to_clarify(monkeypatch):
    monkeypatch.setattr(
        "backend.services.interview.adaptive_engine.evaluate_turn",
        lambda **kwargs: {
            "clarity": 2,
            "depth": 2,
            "relevance": 1,
            "confidence": "low",
            "star_completeness": {},
            "technical_correctness": None,
            "rationale": "off-topic",
        },
    )

    result = decide_next_turn(
        last_user_turn="random unrelated text",
        recent_transcript=[],
        interview_type="mixed",
        difficulty="mid",
        role="Backend Engineer",
        company="Acme",
        question_mix="balanced",
        interview_style="neutral",
        duration_minutes=10,
        asked_question_ids=[],
    )

    assert result["followup_type"] == "clarify"
    assert result["reason"] == "low_relevance"
    assert result["question_id"] == "followup_clarify"


def test_high_scores_raise_bar(monkeypatch):
    monkeypatch.setattr(
        "backend.services.interview.adaptive_engine.evaluate_turn",
        lambda **kwargs: {
            "clarity": 5,
            "depth": 5,
            "relevance": 5,
            "confidence": "high",
            "star_completeness": {},
            "technical_correctness": "high",
            "rationale": "strong turn",
        },
    )

    result = decide_next_turn(
        last_user_turn="I designed a distributed queue with retries and idempotency keys.",
        recent_transcript=[],
        interview_type="technical",
        difficulty="mid",
        role="Backend Engineer",
        company="Acme",
        question_mix="technical",
        interview_style="strict",
        duration_minutes=20,
        asked_question_ids=[],
    )

    assert result["followup_type"] == "move_on"
    assert result["reason"] == "raise_bar"
    assert result["difficulty_next"] == "senior"
    assert result["question_id"] is not None
    assert isinstance(result["next_question"], str) and result["next_question"]
