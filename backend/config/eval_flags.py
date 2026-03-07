"""Centralized evaluation feature flags and rollout thresholds."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _env_str(name: str, default: str) -> str:
    raw = os.getenv(name)
    if raw is None:
        return default
    value = raw.strip()
    return value or default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except Exception:
        return default


@dataclass(frozen=True)
class EvalFlags:
    hard_guards: bool
    client_turns_trusted: bool
    deterministic_rubric: bool
    contract_mode: str
    report_post_mode: str
    scorer_mode: str
    rubric_version: str
    scorer_version: str
    partial_capture_min_expected_turns: int
    partial_capture_turn_ratio: float
    min_candidate_words_for_valid_score: int
    shadow_agreement_tolerance_points: int
    shadow_agreement_target_pct: int
    contract_pass_rate_target_pct: int
    no_p0_days_target: int


def load_eval_flags() -> EvalFlags:
    contract_mode = _env_str("EVAL_CONTRACT_ENFORCEMENT_MODE", "warn").lower()
    if contract_mode not in {"warn", "enforce"}:
        contract_mode = "warn"

    scorer_mode = _env_str("EVAL_SCORER_MODE", "deterministic").lower()
    if scorer_mode not in {"deterministic", "runtime_adaptive", "hybrid"}:
        scorer_mode = "deterministic"

    return EvalFlags(
        hard_guards=_env_bool("EVAL_HARD_GUARDS_ENABLED", True),
        client_turns_trusted=_env_bool("EVAL_CLIENT_TURNS_TRUSTED", False),
        deterministic_rubric=_env_bool("EVAL_DETERMINISTIC_RUBRIC_ENABLED", False),
        contract_mode=contract_mode,
        report_post_mode=_env_str("EVAL_REPORT_POST_ENDPOINT_MODE", "disabled").lower(),
        scorer_mode=scorer_mode,
        rubric_version=_env_str("EVAL_RUBRIC_VERSION", "rubric-2026-02-22"),
        scorer_version=_env_str("EVAL_SCORER_VERSION", "deterministic-v1.0"),
        partial_capture_min_expected_turns=max(1, _env_int("EVAL_PARTIAL_CAPTURE_MIN_EXPECTED_TURNS", 2)),
        partial_capture_turn_ratio=max(0.1, min(1.0, _env_float("EVAL_PARTIAL_CAPTURE_TURN_RATIO", 0.5))),
        min_candidate_words_for_valid_score=max(0, _env_int("EVAL_MIN_CANDIDATE_WORDS_FOR_VALID_SCORE", 20)),
        shadow_agreement_tolerance_points=max(1, _env_int("EVAL_SHADOW_AGREEMENT_TOLERANCE_POINTS", 10)),
        shadow_agreement_target_pct=max(1, min(100, _env_int("EVAL_SHADOW_AGREEMENT_TARGET_PCT", 80))),
        contract_pass_rate_target_pct=max(1, min(100, _env_int("EVAL_CONTRACT_PASS_RATE_TARGET_PCT", 95))),
        no_p0_days_target=max(1, _env_int("EVAL_NO_P0_DAYS_TARGET", 7)),
    )


EVAL_FLAGS = load_eval_flags()
