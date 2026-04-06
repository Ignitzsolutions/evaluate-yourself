try:
    from services.interview.evaluation_contract import apply_evaluation_contract
except Exception:
    from backend.services.interview.evaluation_contract import apply_evaluation_contract  # type: ignore


ALLOWED_SOURCES = {
    "runtime_adaptive_turn_evaluations",
    "server_deterministic_rubric",
    "none_no_candidate_audio",
}


def test_contract_enforce_forces_zero_on_invalid_nonzero_score():
    contract = apply_evaluation_contract(
        capture_evidence={
            "candidate_word_count": 0,
            "candidate_turn_count": 0,
            "turns_evaluated": 0,
        },
        score_provenance={
            "source": "runtime_adaptive_turn_evaluations",
            "confidence": "medium",
        },
        turn_evidence=[],
        final_scores={"overall_score": 72},
        enforcement_mode="enforce",
        allowed_sources=ALLOWED_SOURCES,
    )
    assert contract["contract_passed"] is False
    assert contract["final_scores"]["overall_score"] == 0
    assert "INVALID_SCORE_WITH_ZERO_CANDIDATE_WORDS" in contract["validation_flags"]


def test_contract_warn_mode_does_not_override_score():
    contract = apply_evaluation_contract(
        capture_evidence={
            "candidate_word_count": 30,
            "candidate_turn_count": 1,
            "turns_evaluated": 1,
            "capture_status": "COMPLETE",
            "interview_type": "behavioral",
            "expected_turn_count": 1,
        },
        score_provenance={
            "source": "server_deterministic_rubric",
            "confidence": "low",
        },
        turn_evidence=[{"turn_id": 1, "question_text": "Tell me about a challenge", "candidate_text_excerpt": "Short answer", "answer_word_count": 12}],
        final_scores={"overall_score": 60},
        enforcement_mode="warn",
        allowed_sources=ALLOWED_SOURCES,
        rubric_version="rubric-2026-02-22",
        scorer_version="deterministic-v1.0",
    )
    assert contract["contract_passed"] is True
    assert contract["final_scores"]["overall_score"] == 60
    assert contract["rubric_version"] == "rubric-2026-02-22"
    assert contract["scorer_version"] == "deterministic-v1.0"
    assert contract["validation_summary"]["validity_score"] >= 0


def test_contract_rejects_unapproved_source():
    contract = apply_evaluation_contract(
        capture_evidence={
            "candidate_word_count": 120,
            "candidate_turn_count": 3,
            "turns_evaluated": 3,
            "capture_status": "COMPLETE",
            "interview_type": "technical",
            "expected_turn_count": 3,
        },
        score_provenance={
            "source": "client_turn_evaluations",
            "confidence": "high",
        },
        turn_evidence=[{"turn_id": 1, "question_text": "How would you design an API?", "candidate_text_excerpt": "I built a paginated API with Redis caching and reduced p95 latency by 42%", "answer_word_count": 14, "technical_signal_count": 3}],
        final_scores={"overall_score": 80},
        enforcement_mode="enforce",
        allowed_sources=ALLOWED_SOURCES,
    )
    assert contract["contract_passed"] is False
    assert any(flag.startswith("UNAPPROVED_SCORE_SOURCE") for flag in contract["validation_flags"])


def test_contract_rejects_nonzero_score_with_low_word_evidence():
    contract = apply_evaluation_contract(
        capture_evidence={
            "candidate_word_count": 12,
            "candidate_turn_count": 4,
            "turns_evaluated": 3,
            "capture_status": "COMPLETE",
            "interview_type": "behavioral",
            "expected_turn_count": 4,
        },
        score_provenance={
            "source": "server_deterministic_rubric",
            "confidence": "low",
        },
        turn_evidence=[{"turn_id": 1, "question_text": "Tell me about a time you influenced someone", "candidate_text_excerpt": "short answer", "answer_word_count": 2}],
        final_scores={"overall_score": 22},
        enforcement_mode="enforce",
        allowed_sources=ALLOWED_SOURCES,
        min_candidate_words_for_nonzero_score=20,
    )
    assert contract["contract_passed"] is False
    assert contract["final_scores"]["overall_score"] == 0
    assert any("LOW_EVIDENCE_WORDS" in flag for flag in contract["validation_flags"])


def test_contract_caps_score_when_validity_is_soft_failed():
    turn_evidence = [
        {
            "turn_id": 1,
            "question_text": "Tell me about a time you handled conflict",
            "candidate_text_excerpt": "I spoke with both engineers separately, clarified the blocked handoff, and we restored delivery within the sprint.",
            "answer_word_count": 16,
            "star_components_detected": 1,
            "competency": "conflict resolution",
        },
        {
            "turn_id": 2,
            "question_text": "Describe a difficult stakeholder conversation",
            "candidate_text_excerpt": "I reset expectations with the stakeholder, documented tradeoffs, and regained alignment after a missed dependency.",
            "answer_word_count": 15,
            "star_components_detected": 1,
            "competency": "stakeholder management",
        },
        {
            "turn_id": 3,
            "question_text": "",
            "candidate_text_excerpt": "I usually try to stay calm, listen first, and move the group toward a practical decision.",
            "answer_word_count": 15,
            "star_components_detected": 1,
            "competency": "communication",
        },
    ]
    contract = apply_evaluation_contract(
        capture_evidence={
            "candidate_word_count": 75,
            "candidate_turn_count": 3,
            "turns_evaluated": 2,
            "capture_status": "INCOMPLETE_PARTIAL_CAPTURE",
            "interview_type": "behavioral",
            "expected_turn_count": 4,
        },
        score_provenance={
            "source": "server_deterministic_rubric",
            "confidence": "medium",
        },
        turn_evidence=turn_evidence,
        final_scores={"overall_score": 88},
        enforcement_mode="enforce",
        allowed_sources=ALLOWED_SOURCES,
    )
    assert contract["validation_summary"]["validity_label"] in {"low", "moderate"}
    assert contract["final_scores"]["overall_score"] <= 65
    assert contract["score_provenance"].get("score_cap_reason") == "validation_quality_cap"


def test_contract_does_not_soft_fail_for_missing_competency_labels():
    turn_evidence = [
        {
            "turn_id": 1,
            "question_text": "Tell me about a recent challenge.",
            "candidate_text_excerpt": "I stabilized the rollout, coordinated the team, and recovered the release before the launch deadline.",
            "answer_word_count": 16,
            "star_components_detected": 2,
        },
        {
            "turn_id": 2,
            "question_text": "How did you influence the outcome?",
            "candidate_text_excerpt": "I aligned the stakeholders, clarified the tradeoffs, and closed with a measurable recovery plan.",
            "answer_word_count": 15,
            "star_components_detected": 2,
        },
    ]
    contract = apply_evaluation_contract(
        capture_evidence={
            "candidate_word_count": 95,
            "candidate_turn_count": 2,
            "turns_evaluated": 2,
            "capture_status": "COMPLETE",
            "interview_type": "behavioral",
            "expected_turn_count": 2,
        },
        score_provenance={
            "source": "server_deterministic_rubric",
            "confidence": "medium",
        },
        turn_evidence=turn_evidence,
        final_scores={"overall_score": 74},
        enforcement_mode="warn",
        allowed_sources=ALLOWED_SOURCES,
    )

    assert not any("LOW_COMPETENCY_COVERAGE" in flag for flag in contract["validation_flags"])


def test_contract_does_not_flag_low_competency_coverage_when_scorer_provides_none():
    contract = apply_evaluation_contract(
        capture_evidence={
            "candidate_word_count": 120,
            "candidate_turn_count": 3,
            "turns_evaluated": 3,
            "capture_status": "COMPLETE",
            "interview_type": "technical",
            "expected_turn_count": 3,
        },
        score_provenance={
            "source": "server_deterministic_rubric",
            "confidence": "medium",
        },
        turn_evidence=[
            {
                "turn_id": 1,
                "question_text": "Tell me about a recent system you built.",
                "candidate_text_excerpt": "I rebuilt the queue consumer and reduced p95 latency by 32 percent.",
                "answer_word_count": 14,
                "star_components_detected": 3,
            },
            {
                "turn_id": 2,
                "question_text": "How do you handle production issues?",
                "candidate_text_excerpt": "I triage blast radius first, then assign an owner and post clear updates.",
                "answer_word_count": 15,
                "star_components_detected": 2,
            },
        ],
        final_scores={"overall_score": 74},
        enforcement_mode="enforce",
        allowed_sources=ALLOWED_SOURCES,
    )

    assert not any(
        flag.startswith("SOFT_GUARD_LOW_COMPETENCY_COVERAGE")
        for flag in contract["validation_flags"]
    )
