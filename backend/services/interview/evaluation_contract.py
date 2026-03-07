"""Evaluation contract validation and enforcement utilities."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Iterable, List, Tuple


EVALUATION_CONTRACT_VERSION = "v1"


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _normalized_mode(mode: str) -> str:
    candidate = str(mode or "warn").strip().lower()
    return "enforce" if candidate == "enforce" else "warn"


def validate_evaluation_contract(
    contract: Dict[str, Any],
    *,
    allowed_sources: Iterable[str],
    min_candidate_words_for_nonzero_score: int = 0,
) -> Tuple[bool, List[str]]:
    """Return whether contract passes and associated violation flags."""
    flags: List[str] = []

    capture = contract.get("capture_evidence", {}) if isinstance(contract.get("capture_evidence"), dict) else {}
    provenance = contract.get("score_provenance", {}) if isinstance(contract.get("score_provenance"), dict) else {}
    turns = contract.get("turn_evidence", [])
    final_scores = contract.get("final_scores", {}) if isinstance(contract.get("final_scores"), dict) else {}

    candidate_word_count = _as_int(capture.get("candidate_word_count"), 0)
    candidate_turn_count = _as_int(capture.get("candidate_turn_count"), 0)
    turns_evaluated = _as_int(capture.get("turns_evaluated"), 0)
    overall_score = _as_int(final_scores.get("overall_score"), 0)

    if overall_score > 0 and candidate_word_count == 0:
        flags.append("INVALID_SCORE_WITH_ZERO_CANDIDATE_WORDS")
    if (
        overall_score > 0
        and min_candidate_words_for_nonzero_score > 0
        and candidate_word_count < int(min_candidate_words_for_nonzero_score)
    ):
        flags.append(
            f"INVALID_SCORE_WITH_LOW_EVIDENCE_WORDS:{candidate_word_count}<{int(min_candidate_words_for_nonzero_score)}"
        )
    if overall_score > 0 and candidate_turn_count == 0:
        flags.append("INVALID_SCORE_WITH_ZERO_CANDIDATE_TURNS")
    if overall_score > 0 and turns_evaluated == 0:
        flags.append("INVALID_SCORE_WITH_ZERO_EVALUATED_TURNS")
    if overall_score > 0 and (not isinstance(turns, list) or len(turns) == 0):
        flags.append("INVALID_SCORE_WITHOUT_TURN_EVIDENCE")

    if isinstance(turns, list):
        for turn in turns:
            if not isinstance(turn, dict):
                flags.append("TURN_EVIDENCE_ENTRY_INVALID")
                continue
            excerpt = (turn.get("candidate_text_excerpt") or "").strip()
            if not excerpt:
                turn_id = turn.get("turn_id", "?")
                flags.append(f"MISSING_TURN_EXCERPT:{turn_id}")

    source = str(provenance.get("source") or "").strip()
    allowed = {str(item).strip() for item in allowed_sources if str(item).strip()}
    if source and source not in allowed:
        flags.append(f"UNAPPROVED_SCORE_SOURCE:{source}")
    if overall_score > 0 and not source:
        flags.append("MISSING_SCORE_SOURCE")

    return len(flags) == 0, flags


def apply_evaluation_contract(
    *,
    capture_evidence: Dict[str, Any],
    score_provenance: Dict[str, Any],
    turn_evidence: List[Dict[str, Any]],
    final_scores: Dict[str, Any],
    enforcement_mode: str,
    allowed_sources: Iterable[str],
    rubric_version: str = "rubric-unknown",
    scorer_version: str = "scorer-unknown",
    min_candidate_words_for_nonzero_score: int = 0,
) -> Dict[str, Any]:
    """Build, validate, and optionally enforce the evaluation contract."""
    contract = {
        "evaluation_contract_version": EVALUATION_CONTRACT_VERSION,
        "rubric_version": str(rubric_version or "rubric-unknown"),
        "scorer_version": str(scorer_version or "scorer-unknown"),
        "capture_evidence": deepcopy(capture_evidence or {}),
        "score_provenance": deepcopy(score_provenance or {}),
        "turn_evidence": deepcopy(turn_evidence or []),
        "final_scores": deepcopy(final_scores or {}),
    }

    contract_passed, validation_flags = validate_evaluation_contract(
        contract,
        allowed_sources=allowed_sources,
        min_candidate_words_for_nonzero_score=min_candidate_words_for_nonzero_score,
    )

    mode = _normalized_mode(enforcement_mode)
    if not contract_passed and mode == "enforce":
        contract["final_scores"]["overall_score"] = 0
        contract["score_provenance"]["confidence"] = "low"
        contract["score_provenance"]["forced_zero_reason"] = "evaluation_contract_failed"

    contract["validation_flags"] = validation_flags
    contract["contract_passed"] = contract_passed
    contract["contract_enforcement_mode"] = mode

    return contract
