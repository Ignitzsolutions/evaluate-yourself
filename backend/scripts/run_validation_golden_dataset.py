"""Run the premium validation contract against curated golden transcripts."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from services.interview.evaluation_contract import apply_evaluation_contract
except Exception:
    from backend.services.interview.evaluation_contract import apply_evaluation_contract  # type: ignore


DATASET_PATH = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "golden_validation_dataset.json"
ALLOWED_SOURCES = {"server_deterministic_rubric", "runtime_adaptive_turn_evaluations", "none_no_candidate_audio"}
TECH_TERMS = {
    "api", "postgres", "redis", "latency", "cache", "caching", "queue", "consumer", "rollback",
    "circuit", "database", "index", "indexes", "query", "distributed", "consistency", "availability",
    "idempotency", "retry", "load", "balancer", "python",
}
COMPETENCY_RULES = [
    ("conflict_resolution", ("conflict", "disagree")),
    ("stakeholder_management", ("stakeholder", "expectation")),
    ("ownership", ("missed", "target", "mistake")),
    ("prioritization", ("prioritize", "pressure", "deadline")),
    ("system_design", ("design", "scalable", "api", "architecture")),
    ("debugging", ("incident", "debug", "resolved", "queue")),
    ("optimization", ("optimize", "performance", "database", "index")),
]


def _load_dataset(path: Path = DATASET_PATH) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z0-9][a-z0-9.+#-]*", str(text or "").lower())


def _infer_competency(question: str, answer: str) -> str:
    combined = f"{question} {answer}".lower()
    for label, needles in COMPETENCY_RULES:
        if any(needle in combined for needle in needles):
            return label
    return "communication"


def _behavioral_star_count(answer: str) -> int:
    text = str(answer or "").lower()
    score = 0
    if any(token in text for token in ("when", "team", "project", "release", "stakeholder", "last", "sprint")):
        score += 1
    if any(token in text for token in ("had to", "needed to", "owned", "goal", "milestone", "target")):
        score += 1
    if any(token in text for token in ("i ", "aligned", "reviewed", "coordinated", "rank", "communicate", "proposed", "documented")):
        score += 1
    if any(token in text for token in ("result", "as a result", "recovered", "shipped", "avoided", "within", "improved")):
        score += 1
    return score


def _technical_signal_count(answer: str) -> int:
    tokens = set(_tokenize(answer))
    return sum(1 for term in TECH_TERMS if term in tokens or term in str(answer or "").lower())


def build_contract_case(case: Dict[str, Any]) -> Dict[str, Any]:
    turns = []
    candidate_word_count = 0
    for idx, turn in enumerate(case.get("turns") or [], start=1):
        question = str(turn.get("question") or "").strip()
        answer = str(turn.get("answer") or "").strip()
        answer_word_count = len(answer.split())
        candidate_word_count += answer_word_count
        interview_type = str(case.get("interview_type") or "").strip().lower()
        turns.append(
            {
                "turn_id": idx,
                "question_text": question,
                "candidate_text_excerpt": answer,
                "answer_word_count": answer_word_count,
                "competency": _infer_competency(question, answer),
                "star_components_detected": _behavioral_star_count(answer) if interview_type in {"behavioral", "mixed"} else 0,
                "technical_signal_count": _technical_signal_count(answer) if interview_type in {"technical", "mixed"} else 0,
            }
        )

    capture_evidence = {
        "capture_status": str(case.get("capture_status") or "COMPLETE").strip().upper(),
        "interview_type": str(case.get("interview_type") or "").strip().lower(),
        "candidate_word_count": candidate_word_count,
        "candidate_turn_count": len(turns),
        "turns_evaluated": int(case.get("turns_evaluated") or len(turns)),
        "expected_turn_count": int(case.get("expected_turn_count") or len(turns)),
    }

    return {
        "capture_evidence": capture_evidence,
        "score_provenance": {
            "source": "server_deterministic_rubric",
            "confidence": "medium",
        },
        "turn_evidence": turns,
        "final_scores": {"overall_score": int(case.get("baseline_score") or 0)},
    }


def evaluate_dataset_case(case: Dict[str, Any]) -> Dict[str, Any]:
    payload = build_contract_case(case)
    contract = apply_evaluation_contract(
        capture_evidence=payload["capture_evidence"],
        score_provenance=payload["score_provenance"],
        turn_evidence=payload["turn_evidence"],
        final_scores=payload["final_scores"],
        enforcement_mode="enforce",
        allowed_sources=ALLOWED_SOURCES,
    )
    return {"case": case, "contract": contract}


def validate_dataset_case(result: Dict[str, Any]) -> List[str]:
    case = result["case"]
    contract = result["contract"]
    expected = case.get("expected") or {}
    failures: List[str] = []

    if "contract_passed" in expected and bool(contract.get("contract_passed")) != bool(expected["contract_passed"]):
        failures.append(f"contract_passed expected {expected['contract_passed']} got {contract.get('contract_passed')}")

    actual_label = contract.get("validation_summary", {}).get("validity_label")
    if expected.get("validity_label") and actual_label != expected["validity_label"]:
        failures.append(f"validity_label expected {expected['validity_label']} got {actual_label}")

    actual_score = int(contract.get("final_scores", {}).get("overall_score") or 0)
    if "final_score" in expected and actual_score != int(expected["final_score"]):
        failures.append(f"final_score expected {expected['final_score']} got {actual_score}")

    behavior = expected.get("score_behavior")
    provenance = contract.get("score_provenance", {}) if isinstance(contract.get("score_provenance"), dict) else {}
    if behavior == "unchanged" and provenance.get("score_cap_reason"):
        failures.append("score unexpectedly capped")
    if behavior == "capped" and provenance.get("score_cap_reason") != "validation_quality_cap":
        failures.append("score expected to be capped but cap reason missing")
    if behavior == "forced_zero" and provenance.get("forced_zero_reason") != "evaluation_contract_failed":
        failures.append("score expected to be forced zero but zero reason missing")

    flags = list(contract.get("validation_flags") or [])
    for prefix in expected.get("flags_include") or []:
        if not any(str(flag).startswith(prefix) for flag in flags):
            failures.append(f"missing expected flag prefix {prefix}")

    return failures


def main() -> int:
    dataset = _load_dataset()
    failures = 0
    print(f"Loaded {len(dataset)} golden validation cases from {DATASET_PATH}")
    for case in dataset:
        result = evaluate_dataset_case(case)
        contract = result["contract"]
        case_failures = validate_dataset_case(result)
        label = contract.get("validation_summary", {}).get("validity_label", "unknown")
        score = contract.get("final_scores", {}).get("overall_score", 0)
        print(f"- {case['id']}: validity={label} score={score} flags={len(contract.get('validation_flags') or [])}")
        for failure in case_failures:
            failures += 1
            print(f"  FAIL: {failure}")
    if failures:
        print(f"Golden validation dataset failed with {failures} mismatch(es).", file=sys.stderr)
        return 1
    print("Golden validation dataset passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
