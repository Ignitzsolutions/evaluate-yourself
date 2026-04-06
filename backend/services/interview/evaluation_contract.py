"""Evaluation contract validation and enforcement utilities."""

from __future__ import annotations

from collections import Counter
from copy import deepcopy
import math
import re
from typing import Any, Dict, Iterable, List, Tuple


EVALUATION_CONTRACT_VERSION = "v2"

_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "i", "in", "is", "it",
    "me", "my", "of", "on", "or", "our", "that", "the", "their", "this", "to", "was", "we", "what",
    "when", "where", "which", "who", "why", "with", "you", "your",
}


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _normalized_mode(mode: str) -> str:
    candidate = str(mode or "warn").strip().lower()
    return "enforce" if candidate == "enforce" else "warn"


def _word_count(text: Any) -> int:
    return len(re.findall(r"[a-z0-9][a-z0-9\-\+#\.]*", str(text or "").lower()))


def _normalized_excerpt(text: Any) -> str:
    return " ".join(re.findall(r"[a-z0-9][a-z0-9\-\+#\.]*", str(text or "").lower()))


def _content_tokens(text: Any) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9][a-z0-9\-\+#\.]*", str(text or "").lower())
        if token not in _STOPWORDS and len(token) > 2
    }


def _token_overlap_ratio(question_text: Any, answer_text: Any) -> float:
    question_tokens = _content_tokens(question_text)
    answer_tokens = _content_tokens(answer_text)
    if not question_tokens or not answer_tokens:
        return 0.0
    return len(question_tokens & answer_tokens) / max(1, len(answer_tokens))


def _clip_int(value: float, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, int(round(value))))


def _build_validation_summary(contract: Dict[str, Any], flags: List[str]) -> Dict[str, Any]:
    capture = contract.get("capture_evidence", {}) if isinstance(contract.get("capture_evidence"), dict) else {}
    provenance = contract.get("score_provenance", {}) if isinstance(contract.get("score_provenance"), dict) else {}
    turns = contract.get("turn_evidence", []) if isinstance(contract.get("turn_evidence"), list) else []

    hard_flags = [flag for flag in flags if str(flag).startswith(("HARD_GUARD_", "INVALID_", "UNAPPROVED_", "MISSING_SCORE_SOURCE"))]
    soft_flags = [flag for flag in flags if str(flag).startswith("SOFT_GUARD_")]

    candidate_word_count = _as_int(capture.get("candidate_word_count"), 0)
    candidate_turn_count = _as_int(capture.get("candidate_turn_count"), 0)
    turns_evaluated = _as_int(capture.get("turns_evaluated"), 0)
    expected_turn_count = max(_as_int(capture.get("expected_turn_count"), 0), candidate_turn_count, turns_evaluated)
    capture_status = str(capture.get("capture_status") or "COMPLETE").strip().upper()

    turn_rows = [turn for turn in turns if isinstance(turn, dict)]
    turns_with_question = sum(1 for turn in turn_rows if str(turn.get("question_text") or "").strip())
    substantive_turns = sum(
        1 for turn in turn_rows if _as_int(turn.get("answer_word_count"), _word_count(turn.get("candidate_text_excerpt"))) >= 12
    )
    unique_competencies = {
        str(turn.get("competency") or "").strip().lower()
        for turn in turn_rows
        if str(turn.get("competency") or "").strip()
    }

    validity_score = 100
    if capture_status == "INCOMPLETE_PARTIAL_CAPTURE":
        validity_score -= 20
    if candidate_word_count < 40:
        validity_score -= 15
    elif candidate_word_count < 100:
        validity_score -= 8
    if expected_turn_count > 0 and turns_evaluated < expected_turn_count:
        evaluated_ratio = turns_evaluated / max(1, expected_turn_count)
        validity_score -= int(round((1 - evaluated_ratio) * 20))
    validity_score -= len(soft_flags) * 8
    validity_score -= len(hard_flags) * 22
    validity_score = _clip_int(validity_score)

    if validity_score >= 85:
        validity_label = "high"
    elif validity_score >= 60:
        validity_label = "moderate"
    else:
        validity_label = "low"

    trust_signals: List[str] = []
    if capture_status == "COMPLETE":
        trust_signals.append("Complete capture status recorded for this session.")
    if turns_evaluated >= 3:
        trust_signals.append(f"{turns_evaluated} evaluated answer turns support the score.")
    elif turns_evaluated > 0:
        trust_signals.append(f"{turns_evaluated} evaluated answer turn(s) support the score.")
    if turns_with_question == len(turn_rows) and turn_rows:
        trust_signals.append("Each scored answer retained question context for pairing.")
    if substantive_turns == len(turn_rows) and turn_rows:
        trust_signals.append("All scored answers met the minimum substance threshold.")
    if provenance.get("source"):
        trust_signals.append(f"Primary scoring source: {provenance.get('source')}.")

    risk_map = {
        "HARD_GUARD_DUPLICATE_ANSWER_CONTAMINATION": "Repeated answer text suggests duplicate transcript capture or contamination.",
        "HARD_GUARD_ECHO_CONTAMINATION": "Answer content overlaps too strongly with interviewer prompts, suggesting echo contamination.",
        "INVALID_SCORE_WITH_ZERO_CANDIDATE_WORDS": "A score was attempted without captured candidate evidence.",
        "INVALID_SCORE_WITH_ZERO_CANDIDATE_TURNS": "No candidate turns were available for premium validation.",
        "INVALID_SCORE_WITH_ZERO_EVALUATED_TURNS": "No evaluated turns were available to justify the score.",
        "INVALID_SCORE_WITHOUT_TURN_EVIDENCE": "No per-turn evidence was attached to the final score.",
        "SOFT_GUARD_PARTIAL_CAPTURE": "The session ended with partial evidence, so scoring confidence is reduced.",
        "SOFT_GUARD_LOW_SUBSTANCE_TURN_COVERAGE": "Several answers were too short to support premium-grade scoring confidence.",
        "SOFT_GUARD_LOW_EVALUATED_TURN_COVERAGE": "Not enough captured turns were successfully evaluated.",
        "SOFT_GUARD_LOW_COMPETENCY_COVERAGE": "The interview covered too few competencies for a broad assessment.",
        "SOFT_GUARD_BEHAVIORAL_STRUCTURE_COVERAGE": "Behavioral answers did not consistently show STAR-style structure.",
        "SOFT_GUARD_TECHNICAL_SIGNAL_COVERAGE": "Technical answers lacked enough implementation-depth signals.",
        "SOFT_GUARD_MISSING_QUESTION_CONTEXT": "Some answers lost question context, reducing pairing confidence.",
        "SOFT_GUARD_ECHO_LIKE_TURNS": "Some answers look too similar to the interviewer prompt and may be contaminated.",
    }
    top_risks: List[str] = []
    for flag in flags:
        key = str(flag).split(":", 1)[0]
        description = risk_map.get(key)
        if description and description not in top_risks:
            top_risks.append(description)
    if not top_risks and validity_label == "high":
        top_risks.append("No major validation risks detected in the captured evidence.")

    return {
        "validity_score": validity_score,
        "validity_label": validity_label,
        "trust_signals": trust_signals[:5],
        "top_risks": top_risks[:5],
        "evidence_stats": {
            "candidate_word_count": candidate_word_count,
            "candidate_turn_count": candidate_turn_count,
            "turns_evaluated": turns_evaluated,
            "expected_turn_count": expected_turn_count,
            "turns_with_question_context": turns_with_question,
            "substantive_turns": substantive_turns,
            "competencies_covered": len(unique_competencies),
        },
    }


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
    expected_turn_count = max(_as_int(capture.get("expected_turn_count"), 0), candidate_turn_count, turns_evaluated)
    capture_status = str(capture.get("capture_status") or "COMPLETE").strip().upper()
    interview_type = str(capture.get("interview_type") or "").strip().lower()
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
    if overall_score > 0 and capture_status == "INCOMPLETE_PARTIAL_CAPTURE":
        flags.append("SOFT_GUARD_PARTIAL_CAPTURE")
    if overall_score > 0 and expected_turn_count > 0 and turns_evaluated < max(1, int(math.ceil(expected_turn_count * 0.6))):
        flags.append(f"SOFT_GUARD_LOW_EVALUATED_TURN_COVERAGE:{turns_evaluated}/{expected_turn_count}")

    normalized_excerpts: List[str] = []
    low_substance_turns = 0
    missing_question_context = 0
    echo_like_turns = 0
    behavioral_structured_turns = 0
    technical_signal_turns = 0
    competency_values: set[str] = set()

    if isinstance(turns, list):
        for turn in turns:
            if not isinstance(turn, dict):
                flags.append("TURN_EVIDENCE_ENTRY_INVALID")
                continue
            excerpt = (turn.get("candidate_text_excerpt") or "").strip()
            if not excerpt:
                turn_id = turn.get("turn_id", "?")
                flags.append(f"MISSING_TURN_EXCERPT:{turn_id}")
                continue

            normalized_excerpt = _normalized_excerpt(excerpt)
            if normalized_excerpt:
                normalized_excerpts.append(normalized_excerpt)

            answer_word_count = _as_int(turn.get("answer_word_count"), _word_count(excerpt))
            if answer_word_count < 12:
                low_substance_turns += 1

            question_text = str(turn.get("question_text") or "").strip()
            if not question_text:
                missing_question_context += 1
            elif _token_overlap_ratio(question_text, excerpt) >= 0.8:
                echo_like_turns += 1

            competency = str(turn.get("competency") or "").strip().lower()
            if competency:
                competency_values.add(competency)

            if _as_int(turn.get("star_components_detected"), 0) >= 2:
                behavioral_structured_turns += 1
            if _as_int(turn.get("technical_signal_count"), 0) >= 1:
                technical_signal_turns += 1

    if normalized_excerpts:
        duplicate_turns = sum(count for count in Counter(normalized_excerpts).values() if count > 1)
        if duplicate_turns >= max(2, int(math.ceil(len(normalized_excerpts) * 0.5))):
            flags.append(f"HARD_GUARD_DUPLICATE_ANSWER_CONTAMINATION:{duplicate_turns}/{len(normalized_excerpts)}")

    total_turns = len(turns) if isinstance(turns, list) else 0
    if echo_like_turns >= max(2, int(math.ceil(max(1, total_turns) * 0.5))):
        flags.append(f"HARD_GUARD_ECHO_CONTAMINATION:{echo_like_turns}/{max(1, total_turns)}")
    elif overall_score > 0 and echo_like_turns > 0:
        flags.append(f"SOFT_GUARD_ECHO_LIKE_TURNS:{echo_like_turns}/{max(1, total_turns)}")

    if overall_score > 0 and total_turns and low_substance_turns >= max(1, int(math.ceil(total_turns * 0.5))):
        flags.append(f"SOFT_GUARD_LOW_SUBSTANCE_TURN_COVERAGE:{low_substance_turns}/{total_turns}")
    if overall_score > 0 and total_turns and missing_question_context >= max(1, int(math.ceil(total_turns * 0.5))):
        flags.append(f"SOFT_GUARD_MISSING_QUESTION_CONTEXT:{missing_question_context}/{total_turns}")
    if overall_score > 0 and interview_type in {"behavioral", "mixed"} and total_turns >= 2 and behavioral_structured_turns == 0:
        flags.append("SOFT_GUARD_BEHAVIORAL_STRUCTURE_COVERAGE:0")
    if overall_score > 0 and interview_type in {"technical", "mixed"} and total_turns >= 2 and technical_signal_turns == 0:
        flags.append("SOFT_GUARD_TECHNICAL_SIGNAL_COVERAGE:0")
    if (
        overall_score > 0
        and interview_type in {"behavioral", "mixed"}
        and expected_turn_count >= 3
        and competency_values
        and len(competency_values) < 2
    ):
        flags.append(f"SOFT_GUARD_LOW_COMPETENCY_COVERAGE:{len(competency_values)}")

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

    validation_summary = _build_validation_summary(contract, validation_flags)
    hard_flags = [flag for flag in validation_flags if str(flag).startswith(("HARD_GUARD_", "INVALID_", "UNAPPROVED_", "MISSING_SCORE_SOURCE"))]
    soft_flags = [flag for flag in validation_flags if str(flag).startswith("SOFT_GUARD_")]

    mode = _normalized_mode(enforcement_mode)
    current_score = _as_int(contract.get("final_scores", {}).get("overall_score"), 0)
    if mode == "enforce" and hard_flags:
        contract["final_scores"]["overall_score"] = 0
        contract["score_provenance"]["confidence"] = "low"
        contract["score_provenance"]["forced_zero_reason"] = "evaluation_contract_failed"
    elif mode == "enforce" and soft_flags and current_score > 0:
        validity_score = _as_int(validation_summary.get("validity_score"), 100)
        capped_score = current_score
        if validity_score < 60:
            capped_score = min(capped_score, 50)
        elif validity_score < 75:
            capped_score = min(capped_score, 65)
        elif validity_score < 85:
            capped_score = min(capped_score, 80)
        if capped_score != current_score:
            contract["final_scores"]["overall_score"] = capped_score
            contract["score_provenance"]["confidence"] = "low" if validity_score < 60 else "medium"
            contract["score_provenance"]["score_cap_reason"] = "validation_quality_cap"

    contract["validation_flags"] = validation_flags
    contract["validation_summary"] = validation_summary
    contract["contract_passed"] = contract_passed
    contract["contract_enforcement_mode"] = mode

    return contract
