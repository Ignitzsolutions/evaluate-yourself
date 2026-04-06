from backend.services.interview_report_artifact import (
    REPORT_STATE_INVALID,
    REPORT_STATE_PARTIAL,
    determine_report_state,
    build_report_artifact_context,
    _gaze_summary_lines,
    render_interview_report_html,
)


def _base_report():
    return {
        "id": "r0",
        "session_id": "s0",
        "title": "Report",
        "type": "technical",
        "mode": "live",
        "duration": "5 minutes",
        "overall_score": 65,
        "metrics": {
            "capture_status": "COMPLETE",
            "capture_evidence": {"candidate_turn_count": 2, "turns_evaluated": 1},
            "score_provenance": {"source": "server_deterministic_rubric"},
        },
        "validation_summary": {"validity_score": 72, "validity_label": "moderate"},
        "transcript": [],
    }


def test_determine_report_state_invalid_when_no_candidate_audio():
    report = _base_report()
    report["metrics"]["capture_status"] = "INCOMPLETE_NO_CANDIDATE_AUDIO"
    report["transcript"] = [{"speaker": "ai", "text": "Tell me about yourself"}]
    assert determine_report_state(report) == REPORT_STATE_INVALID


def test_determine_report_state_partial_when_score_cap_present():
    report = _base_report()
    report["metrics"]["score_provenance"]["score_cap_reason"] = "validation_quality"
    assert determine_report_state(report) == REPORT_STATE_PARTIAL


def test_build_context_for_invalid_report_excludes_strengths_risks():
    report = _base_report()
    report["metrics"]["capture_status"] = "INCOMPLETE_NO_CANDIDATE_AUDIO"
    report["transcript"] = [{"speaker": "ai", "text": "Tell me about yourself"}]
    report["hiring_recommendation"] = {"green_flags": ["Leadership"]}
    report["validation_summary"]["top_risks"] = ["Missing evidence"]
    ctx = build_report_artifact_context(report)
    assert ctx["report_state"] == REPORT_STATE_INVALID
    assert ctx["strengths"] == []
    assert ctx["risks"] == []
    assert isinstance(ctx["remediation_steps"], list)


def test_build_context_includes_score_reconciliation_and_ledger_excerpt():
    report = _base_report()
    report["metrics"]["evaluation_explainability"] = {
        "formula": "overall = ((clarity × 0.25) + (communication × 0.20) + (depth × 0.30) + (relevance × 0.25)) × 20",
        "weights": {"clarity": 0.25, "communication": 0.20},
    }
    report["metrics"]["score_reconciliation"] = {
        "base_overall_score": 68,
        "final_overall_score": 65,
        "score_delta": -3,
        "score_cap_reason": "validation_quality_cap",
    }
    report["metrics"]["score_ledger"] = [
        {
            "turn_id": 1,
            "transcript_ref_label": "Turn 1 • 2026-03-18T10:00:00Z",
            "question_text": "Walk me through a recent technical decision.",
            "included_in_score": True,
        }
    ]

    ctx = build_report_artifact_context(report)

    assert ctx["score_reconciliation"]["final_overall_score"] == 65
    assert ctx["score_ledger_excerpt"][0]["transcript_ref_label"].startswith("Turn 1")


def test_gaze_summary_lines_formats_observations_and_eye_contact():
    lines = _gaze_summary_lines({"LOOKING_DOWN": 2, "OFF_SCREEN": 1, "FACE_NOT_VISIBLE": 1}, 58.3)
    assert "Looking down" in lines[0]
    assert "Looking away" in lines[1]
    assert "Face loss" in lines[2]
    assert "58.3%" in lines[-1]


def test_render_html_uses_assessment_artifact_sections():
    report = _base_report()
    report["metrics"]["plan_tier"] = "paid"
    report["metrics"]["trial_mode"] = False
    report["metrics"]["evaluation_explainability"] = {
        "formula": "overall = weighted rubric",
        "weights": {"clarity": 0.25},
    }
    report["metrics"]["score_reconciliation"] = {
        "base_overall_score": 68,
        "final_overall_score": 65,
        "score_delta": -3,
        "score_cap_reason": "validation_quality_cap",
    }
    report["metrics"]["score_ledger"] = [
        {
            "turn_id": 1,
            "transcript_ref_label": "Turn 1 • 2026-03-18T10:00:00Z",
            "question_text": "Walk me through a recent technical decision.",
            "included_in_score": True,
            "answer_excerpt": "I led the rollout.",
            "evidence_quote": "I reduced duplicate processing by 30 percent.",
        }
    ]
    report["validation_summary"]["trust_signals"] = ["Three turns were evaluated."]
    report["hiring_recommendation"] = {"label": "Hire"}

    html = render_interview_report_html(report, include_brand_logo=True)

    assert "Ignitz logo" in html
    assert "Detailed Interview Report" in html
    assert "Executive Judgment" in html
    assert "Scoring Evidence Ledger" in html
    assert "overall = weighted rubric" in html
    assert "Base score 68/100" in html or "Base score" in html


def test_render_html_invalid_report_shows_remediation_not_strengths():
    report = _base_report()
    report["metrics"]["capture_status"] = "INCOMPLETE_NO_CANDIDATE_AUDIO"
    report["transcript"] = [{"speaker": "ai", "text": "Tell me about yourself"}]
    report["recommendations"] = ["Verify microphone permissions."]

    html = render_interview_report_html(report)

    assert "Session Remediation" in html
    assert "Top Strengths" not in html


def test_render_html_trial_report_hides_detailed_ledger_and_shows_upgrade_message():
    report = _base_report()
    report["metrics"]["plan_tier"] = "trial"
    report["metrics"]["trial_mode"] = True
    report["transcript"] = [{"speaker": "user", "text": "I led the rollout."}]
    report["metrics"]["score_ledger"] = [
        {
            "turn_id": 1,
            "transcript_ref_label": "Turn 1",
            "question_text": "Walk me through a recent technical decision.",
            "included_in_score": True,
        }
    ]

    html = render_interview_report_html(report)

    assert "Trial Interview Report" in html
    assert "Upgrade for full-length interviews" in html
    assert "Scoring Evidence Ledger" not in html


def test_render_html_suppresses_gaze_coaching_when_calibration_is_not_reliable():
    report = _base_report()
    report["metrics"]["plan_tier"] = "paid"
    report["metrics"]["trial_mode"] = False
    report["metrics"]["gaze_summary"] = {
        "events_by_type": {"OFF_SCREEN": 2},
        "eye_contact_pct": 44.2,
        "calibration_state": "calibrating",
        "calibration_valid": False,
    }

    html = render_interview_report_html(report)

    assert "Calibration not reliable enough for detailed gaze coaching" in html
    assert "Looking away from screen was detected 2 time(s)." not in html
    assert "Transcript Appendix" not in html


def test_render_html_with_brand_logo_and_toolbar_exposes_launch_export_shell():
    report = _base_report()

    html = render_interview_report_html(report, include_brand_logo=True, include_print_toolbar=True)

    assert "Save as PDF" in html
    assert "Ignitz logo" in html
