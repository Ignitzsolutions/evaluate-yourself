try:
    from services.interview.deterministic_rubric_evaluator import (
        compute_confidence_tier,
        evaluate_turn,
        evaluate_turns,
    )
except Exception:
    from backend.services.interview.deterministic_rubric_evaluator import (  # type: ignore
        compute_confidence_tier,
        evaluate_turn,
        evaluate_turns,
    )


def test_evaluate_turn_returns_expected_schema():
    result = evaluate_turn(
        question_text="How did you reduce API latency in production?",
        candidate_answer_text=(
            "I reduced p95 latency by 28% by adding Redis caching, "
            "removing N+1 queries, and tuning DB indexes. "
            "I validated impact with before/after dashboards."
        ),
        interview_type="technical",
    )
    assert isinstance(result["clarity"], int)
    assert isinstance(result["depth"], int)
    assert isinstance(result["relevance"], int)
    assert 1 <= result["clarity"] <= 5
    assert 1 <= result["depth"] <= 5
    assert 1 <= result["relevance"] <= 5
    assert isinstance(result["rationale"], str) and result["rationale"]
    assert isinstance(result["evidence_excerpt"], str) and result["evidence_excerpt"]


def test_evaluate_turns_skips_empty_answers():
    turns = [
        {"question": "Tell me about yourself", "answer": "I am a backend engineer."},
        {"question": "Any challenge?", "answer": "   "},
        {"question": "System design?", "answer": "I handled scaling using queue workers and retry policies."},
    ]
    rows = evaluate_turns(turns=turns, interview_type="mixed")
    assert len(rows) == 2
    assert rows[0]["turn_id"] == 1
    assert rows[1]["turn_id"] == 3


def test_confidence_tier_thresholds():
    assert compute_confidence_tier(0, 0) == "none"
    assert compute_confidence_tier(49, 2) == "low"
    assert compute_confidence_tier(50, 2) == "medium"
    assert compute_confidence_tier(250, 4) == "high"


def test_specific_answer_scores_higher_than_generic_long_answer():
    question = "Tell me about a technical challenge you solved recently."
    generic = evaluate_turn(
        question_text=question,
        candidate_answer_text=(
            "I worked on a lot of different projects and handled many tasks across the team. "
            "It was challenging but I managed, learned a lot, and helped the team deliver. "
            "I usually do my best, communicate well, and adapt easily in different situations."
        ),
        interview_type="technical",
    )
    specific = evaluate_turn(
        question_text=question,
        candidate_answer_text=(
            "I led a checkout latency fix after p95 rose above 1.8 seconds. "
            "I added Redis caching, removed two N+1 queries, and introduced an index on order lookups. "
            "That reduced p95 latency by 32% and cut timeout complaints by half within the week."
        ),
        interview_type="technical",
    )

    assert generic["evidence_quality"] < specific["evidence_quality"]
    assert generic["depth"] < specific["depth"]
    assert generic["relevance"] < specific["relevance"]
    assert "generic_low_evidence" in generic["weak_signal_flags"]
    assert specific["weak_signal_flags"] == []
