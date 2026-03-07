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
        },
        score_provenance={
            "source": "server_deterministic_rubric",
            "confidence": "low",
        },
        turn_evidence=[{"turn_id": 1, "candidate_text_excerpt": "Short answer"}],
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


def test_contract_rejects_unapproved_source():
    contract = apply_evaluation_contract(
        capture_evidence={
            "candidate_word_count": 120,
            "candidate_turn_count": 3,
            "turns_evaluated": 3,
        },
        score_provenance={
            "source": "client_turn_evaluations",
            "confidence": "high",
        },
        turn_evidence=[{"turn_id": 1, "candidate_text_excerpt": "Answer text"}],
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
        },
        score_provenance={
            "source": "server_deterministic_rubric",
            "confidence": "low",
        },
        turn_evidence=[{"turn_id": 1, "candidate_text_excerpt": "short answer"}],
        final_scores={"overall_score": 22},
        enforcement_mode="enforce",
        allowed_sources=ALLOWED_SOURCES,
        min_candidate_words_for_nonzero_score=20,
    )
    assert contract["contract_passed"] is False
    assert contract["final_scores"]["overall_score"] == 0
    assert any("LOW_EVIDENCE_WORDS" in flag for flag in contract["validation_flags"])
