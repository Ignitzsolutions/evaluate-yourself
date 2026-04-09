"""Synthetic gold-dataset calibration runner for report evidence signals."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.interview.communication_analytics import (
    analyze_communication_metrics,
    compute_confidence_score,
)
from backend.services.interview.report_pipeline import (
    determine_score_trust_level,
    normalize_transcript_payload,
)


def _load_dataset(dataset_path: str | Path) -> Dict[str, Any]:
    return json.loads(Path(dataset_path).read_text(encoding="utf-8"))


def _detect_technical_omissions(messages: List[Dict[str, Any]], expected_terms: List[str]) -> List[str]:
    transcript_blob = " ".join(str(message.get("text") or "") for message in messages).lower()
    return [term for term in expected_terms if str(term or "").strip().lower() not in transcript_blob]


def evaluate_calibration_case(case: Dict[str, Any]) -> Dict[str, Any]:
    normalized = normalize_transcript_payload(
        {
            "mode": "raw",
            "raw_messages": case.get("transcript") or [],
        }
    )
    capture_integrity = normalized.get("capture_integrity", {})
    communication_metrics = analyze_communication_metrics(
        trusted_messages=normalized.get("trusted_raw_messages") or [],
        total_duration_minutes=int(case.get("total_duration_minutes") or 0),
        avg_response_time_seconds=float(case.get("avg_response_time_seconds") or 0),
    )
    trust_level = determine_score_trust_level(
        capture_status=str(case.get("capture_status") or "COMPLETE"),
        capture_integrity=capture_integrity,
        contract_passed=True,
        hard_guard_flags=[],
    )
    confidence_score = compute_confidence_score(
        trust_level=trust_level,
        contract_passed=True,
        capture_integrity=capture_integrity,
        communication_metrics=communication_metrics,
        gaze_summary={},
        turns_evaluated=int(capture_integrity.get("trusted_candidate_turn_count") or 0),
    )
    expected = case.get("expected") or {}
    omissions = _detect_technical_omissions(
        normalized.get("trusted_raw_messages") or [],
        expected.get("technical_omissions") or [],
    )
    actual_flags = set(communication_metrics.get("quality_flags") or [])
    expected_flags = set(expected.get("communication_flags") or [])
    score_min, score_max = expected.get("confidence_score_range") or [0, 100]

    return {
        "id": case.get("id"),
        "trust_level": trust_level,
        "confidence_score": confidence_score,
        "confidence_in_range": int(score_min) <= confidence_score <= int(score_max),
        "actual_flags": sorted(actual_flags),
        "expected_flags": sorted(expected_flags),
        "flags_match": expected_flags.issubset(actual_flags),
        "technical_omissions": omissions,
        "omissions_match": omissions == list(expected.get("technical_omissions") or []),
        "passed": (
            trust_level == expected.get("trust_level")
            and int(score_min) <= confidence_score <= int(score_max)
            and expected_flags.issubset(actual_flags)
            and omissions == list(expected.get("technical_omissions") or [])
        ),
    }


def run_calibration_dataset(dataset_path: str | Path) -> Dict[str, Any]:
    dataset = _load_dataset(dataset_path)
    cases = [evaluate_calibration_case(case) for case in dataset.get("cases") or []]
    passed_cases = [case for case in cases if case.get("passed")]
    failed_cases = [case for case in cases if not case.get("passed")]
    return {
        "dataset_version": dataset.get("version", "unknown"),
        "case_count": len(cases),
        "passed_count": len(passed_cases),
        "failed_count": len(failed_cases),
        "cases": cases,
    }


if __name__ == "__main__":  # pragma: no cover
    default_path = Path(__file__).with_name("golden_interview_dataset.json")
    result = run_calibration_dataset(default_path)
    print(json.dumps(result, indent=2))
