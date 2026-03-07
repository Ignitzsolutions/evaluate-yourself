"""Hiring signal aggregator.

Computes an overall hiring recommendation from aggregated turn analysis data.
Output: strong_hire | hire | borderline | no_hire with supporting rationale.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


# ─── Thresholds ───────────────────────────────────────────────────────────────

_STRONG_HIRE_THRESHOLD = 80
_HIRE_THRESHOLD = 65
_BORDERLINE_THRESHOLD = 50


def _safe_score(v: Any) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def compute_hiring_signal(
    overall_score: int,
    turn_analyses: List[Dict[str, Any]],
    competency_scores: Optional[Dict[str, int]] = None,
    interview_type: str = "mixed",
) -> Dict[str, Any]:
    """Compute hiring signal and rationale.

    Args:
        overall_score: Final 0-100 score from report_generator.
        turn_analyses: Per-question analysis dicts with at least 'score_0_100',
                       'star_breakdown', and 'depth_signals' fields.
        competency_scores: Optional dict mapping competency name → 0-100.
        interview_type: 'behavioral' | 'technical' | 'mixed'

    Returns:
        {
          "signal":          "strong_hire" | "hire" | "borderline" | "no_hire",
          "label":           Human-readable label,
          "rationale_bullets": [str, str, str],  # 3 concise bullets
          "red_flags":       [str],               # any serious concerns
          "green_flags":     [str],               # standout positives
        }
    """
    # ─── Red flag detection ───────────────────────────────────────────────────
    red_flags: List[str] = []
    green_flags: List[str] = []

    if turn_analyses:
        # Flag: all answers very short
        very_short = sum(
            1 for t in turn_analyses
            if isinstance(t.get("depth_signals"), dict)
            and t["depth_signals"].get("word_count", 999) < 40
        )
        if very_short >= len(turn_analyses) * 0.6 and len(turn_analyses) >= 2:
            red_flags.append(
                f"{very_short}/{len(turn_analyses)} answers were very short (<40 words) — insufficient evidence for scoring."
            )

        # Flag: zero STAR completion across all questions
        star_detected_any = any(
            any(
                t.get("star_breakdown", {}).get(c, {}).get("detected", False)
                for c in ("situation", "task", "action", "result")
            )
            for t in turn_analyses
        )
        if not star_detected_any and interview_type in ("behavioral", "mixed"):
            red_flags.append(
                "No STAR structure detected in any answer — responses lacked situational context, ownership statements, or measurable results."
            )

        # Flag: high hedge density across most turns
        high_hedge_turns = sum(
            1 for t in turn_analyses
            if isinstance(t.get("depth_signals"), dict)
            and t["depth_signals"].get("hedge_hits", 0) >= 4
        )
        if high_hedge_turns >= len(turn_analyses) * 0.6 and len(turn_analyses) >= 2:
            red_flags.append(
                "Excessive hedging language detected across most answers — may signal low confidence or uncertainty."
            )

        # Green flag: strong quantified answers
        quantified = sum(
            1 for t in turn_analyses
            if isinstance(t.get("depth_signals"), dict)
            and len(t["depth_signals"].get("metrics_mentioned", [])) >= 1
        )
        if quantified >= len(turn_analyses) * 0.5 and len(turn_analyses) >= 2:
            green_flags.append(
                f"Used quantified metrics in {quantified}/{len(turn_analyses)} answers — strong evidence of impact-driven thinking."
            )

        # Green flag: STAR completeness in most answers
        star_complete = sum(
            1 for t in turn_analyses
            if sum(
                1 for c in ("situation", "task", "action", "result")
                if t.get("star_breakdown", {}).get(c, {}).get("detected", False)
            ) >= 3
        )
        if star_complete >= len(turn_analyses) * 0.5 and len(turn_analyses) >= 2:
            green_flags.append(
                f"Full STAR structure (3+ components) detected in {star_complete}/{len(turn_analyses)} answers — well-structured communication."
            )

    if competency_scores:
        # Green flag: any competency ≥ 85
        top_comps = [
            (comp, score) for comp, score in competency_scores.items() if score >= 85
        ]
        if top_comps:
            top_comp, top_score = max(top_comps, key=lambda x: x[1])
            green_flags.append(
                f"Exceptional {top_comp.replace('_', ' ')} score ({top_score}/100) — clear standout strength."
            )

        # Red flag: any critical competency = 0 with enough data
        critical = (
            ["technical_depth"] if interview_type == "technical"
            else ["ownership", "collaboration"] if interview_type == "behavioral"
            else ["problem_solving"]
        )
        for comp in critical:
            if competency_scores.get(comp, 100) == 0 and turn_analyses:
                red_flags.append(
                    f"{comp.replace('_', ' ').title()} score is 0 — no evidence for this core competency."
                )

    # ─── Determine signal ─────────────────────────────────────────────────────
    # Red flags push the signal down one level
    adjusted_score = overall_score
    if len(red_flags) >= 2:
        adjusted_score -= 15
    elif len(red_flags) == 1:
        adjusted_score -= 8

    if adjusted_score >= _STRONG_HIRE_THRESHOLD:
        signal = "strong_hire"
        label = "Strong Hire"
    elif adjusted_score >= _HIRE_THRESHOLD:
        signal = "hire"
        label = "Hire"
    elif adjusted_score >= _BORDERLINE_THRESHOLD:
        signal = "borderline"
        label = "Borderline"
    else:
        signal = "no_hire"
        label = "No Hire"

    # ─── Rationale bullets ────────────────────────────────────────────────────
    rationale_bullets: List[str] = []

    # 1. Overall score context
    score_context = (
        f"Overall score of {overall_score}/100 "
        + (
            "places the candidate in the strong hire range."
            if overall_score >= _STRONG_HIRE_THRESHOLD
            else "places the candidate solidly above the hire threshold."
            if overall_score >= _HIRE_THRESHOLD
            else "places the candidate in borderline territory — strong in some areas but inconsistent."
            if overall_score >= _BORDERLINE_THRESHOLD
            else "is below the hire threshold, with insufficient evidence of required competencies."
        )
    )
    rationale_bullets.append(score_context)

    # 2. Top green flag or competency strength
    if green_flags:
        rationale_bullets.append(green_flags[0])
    elif competency_scores:
        best = max(competency_scores, key=lambda k: competency_scores[k], default=None)
        if best:
            rationale_bullets.append(
                f"Strongest dimension: {best.replace('_', ' ')} ({competency_scores[best]}/100)."
            )

    # 3. Top concern or red flag
    if red_flags:
        rationale_bullets.append(f"Key concern: {red_flags[0]}")
    else:
        rationale_bullets.append(
            "No major red flags detected. Candidate demonstrated sufficient evidence across evaluated dimensions."
        )

    return {
        "signal": signal,
        "label": label,
        "rationale_bullets": rationale_bullets[:3],
        "red_flags": red_flags,
        "green_flags": green_flags,
    }


def hiring_signal_color(signal: str) -> str:
    """Return a CSS color class for display purposes."""
    return {
        "strong_hire": "green",
        "hire": "emerald",
        "borderline": "yellow",
        "no_hire": "red",
    }.get(signal, "gray")
