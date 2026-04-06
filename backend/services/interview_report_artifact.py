"""Premium interview report artifact rendering helpers."""

from __future__ import annotations

import base64
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Iterable, List


REPORT_STATE_VALID = "valid_scored_report"
REPORT_STATE_PARTIAL = "partial_low_confidence_report"
REPORT_STATE_INVALID = "invalid_no_candidate_audio_report"

_IGNITZ_LOGO_DATA_URI: str | None = None


def determine_report_state(report_data: Dict[str, Any]) -> str:
    metrics = report_data.get("metrics") if isinstance(report_data.get("metrics"), dict) else {}
    validation_summary = report_data.get("validation_summary")
    if not isinstance(validation_summary, dict):
        validation_summary = metrics.get("validation_summary") if isinstance(metrics.get("validation_summary"), dict) else {}
    capture_status = str(metrics.get("capture_status") or "").strip().upper()
    capture_evidence = metrics.get("capture_evidence") if isinstance(metrics.get("capture_evidence"), dict) else {}
    score_provenance = metrics.get("score_provenance") if isinstance(metrics.get("score_provenance"), dict) else {}
    transcript = report_data.get("transcript") if isinstance(report_data.get("transcript"), list) else []
    candidate_turn_count = int(capture_evidence.get("candidate_turn_count") or metrics.get("candidate_turn_count") or 0)
    turns_evaluated = int(capture_evidence.get("turns_evaluated") or 0)

    has_candidate_audio = any(
        str(item.get("speaker") or "").strip().lower() in {"user", "candidate", "you"} and str(item.get("text") or "").strip()
        for item in transcript
        if isinstance(item, dict)
    )

    if (
        capture_status == "INCOMPLETE_NO_CANDIDATE_AUDIO"
        or (candidate_turn_count == 0 and turns_evaluated == 0 and not has_candidate_audio)
    ):
        return REPORT_STATE_INVALID

    if (
        capture_status == "INCOMPLETE_PARTIAL_CAPTURE"
        or str(validation_summary.get("validity_label") or "").lower() == "low"
        or bool(score_provenance.get("score_cap_reason"))
        or bool(score_provenance.get("forced_zero_reason"))
    ):
        return REPORT_STATE_PARTIAL

    return REPORT_STATE_VALID


def _safe_list(items: Any) -> List[Any]:
    return items if isinstance(items, list) else []


def _benchmark_label(overall_score: int, report_state: str) -> str:
    if report_state == REPORT_STATE_INVALID:
        return "Unavailable"
    if report_state == REPORT_STATE_PARTIAL:
        return "Provisional"
    if overall_score >= 85:
        return "Elite"
    if overall_score >= 75:
        return "Strong"
    if overall_score >= 60:
        return "Competitive"
    if overall_score >= 45:
        return "Developing"
    return "At Risk"


def _benchmark_narrative(overall_score: int, report_state: str) -> str:
    if report_state == REPORT_STATE_INVALID:
        return "This session did not capture enough candidate evidence to support a paid evaluation."
    if report_state == REPORT_STATE_PARTIAL:
        return "This assessment is provisional because the session ended with partial or low-confidence evidence."
    if overall_score >= 85:
        return "This performance sits in the top band: clear, credible, and backed by evidence that would stand up in a serious hiring conversation."
    if overall_score >= 75:
        return "This was a strong interview with a hire-ready profile, though a few answers still leave room for sharper execution."
    if overall_score >= 60:
        return "The interview was competitive, but the evidence was uneven. A stronger close on impact and ownership would materially improve the signal."
    if overall_score >= 45:
        return "There were some credible moments, but the interview did not sustain enough high-quality evidence to feel consistently convincing."
    return "The current performance is below a dependable hire-ready threshold and needs targeted rebuilding before a high-stakes interview."


def _take_unique(items: Iterable[str], limit: int = 3) -> List[str]:
    out: List[str] = []
    for item in items:
        text = str(item or "").strip()
        if text and text not in out:
            out.append(text)
        if len(out) >= limit:
            break
    return out


def _gaze_flag_label(flag: str) -> str:
    mapping = {
        "OFF_SCREEN": "Looking Away",
        "LOOKING_DOWN": "Looking Down",
        "LOOKING_UP": "Looking Up",
        "FACE_NOT_VISIBLE": "Face Not Visible",
    }
    return mapping.get(str(flag or "").strip().upper(), str(flag or "").replace("_", " ").title())


def _gaze_summary_lines(flags_by_type: Dict[str, Any], eye_contact_pct: Any) -> List[str]:
    lines: List[str] = []
    normalized = {
        str(key or "").strip().upper(): int(value or 0)
        for key, value in (flags_by_type or {}).items()
        if str(key or "").strip()
    }
    if normalized.get("LOOKING_DOWN"):
        lines.append(f"Looking down was detected {normalized['LOOKING_DOWN']} time(s).")
    if normalized.get("OFF_SCREEN"):
        lines.append(f"Looking away from screen was detected {normalized['OFF_SCREEN']} time(s).")
    if normalized.get("FACE_NOT_VISIBLE"):
        lines.append(f"Face loss was detected {normalized['FACE_NOT_VISIBLE']} time(s).")
    if eye_contact_pct is not None:
        lines.append(f"Observed on-screen eye contact measured {eye_contact_pct}%.")
    return lines


def _plan_tier(metrics: Dict[str, Any]) -> str:
    return str(metrics.get("plan_tier") or "trial").strip() or "trial"


def _trial_mode(metrics: Dict[str, Any]) -> bool:
    if "trial_mode" in metrics:
        return bool(metrics.get("trial_mode"))
    return _plan_tier(metrics) == "trial"


def _load_ignitz_logo_data_uri() -> str | None:
    global _IGNITZ_LOGO_DATA_URI
    if _IGNITZ_LOGO_DATA_URI is not None:
        return _IGNITZ_LOGO_DATA_URI

    repo_root = Path(__file__).resolve().parents[2]
    for candidate in (
        repo_root / "public/assets/brand/ignitz-logo.svg",
        repo_root / "public/assets/brand/ignitz-logo.png",
    ):
        if not candidate.exists():
            continue
        mime = "image/svg+xml" if candidate.suffix.lower() == ".svg" else "image/png"
        _IGNITZ_LOGO_DATA_URI = f"data:{mime};base64,{base64.b64encode(candidate.read_bytes()).decode('ascii')}"
        return _IGNITZ_LOGO_DATA_URI
    _IGNITZ_LOGO_DATA_URI = None
    return None


def build_report_artifact_context(report_data: Dict[str, Any]) -> Dict[str, Any]:
    metrics = report_data.get("metrics") if isinstance(report_data.get("metrics"), dict) else {}
    validation_summary = report_data.get("validation_summary")
    if not isinstance(validation_summary, dict):
        validation_summary = metrics.get("validation_summary") if isinstance(metrics.get("validation_summary"), dict) else {}
    score_provenance = metrics.get("score_provenance") if isinstance(metrics.get("score_provenance"), dict) else {}
    report_state = determine_report_state(report_data)
    overall_score = int(report_data.get("overall_score") or 0)
    hiring_recommendation = report_data.get("hiring_recommendation") if isinstance(report_data.get("hiring_recommendation"), dict) else None
    ai_feedback = report_data.get("ai_feedback") if isinstance(report_data.get("ai_feedback"), dict) else {}
    improvement_roadmap = _safe_list(report_data.get("improvement_roadmap"))
    transcript = _safe_list(report_data.get("transcript"))

    strengths: List[str] = []
    risks: List[str] = []
    if report_state != REPORT_STATE_INVALID:
        strengths.extend(_safe_list(hiring_recommendation.get("green_flags") if hiring_recommendation else []))
        strengths.extend(_safe_list(ai_feedback.get("strengths")))
        risks.extend(_safe_list(validation_summary.get("top_risks")))
        risks.extend(_safe_list(hiring_recommendation.get("red_flags") if hiring_recommendation else []))
        risks.extend(str(item.get("finding") or "").strip() for item in improvement_roadmap if isinstance(item, dict))

    transcript_excerpt = []
    for row in transcript:
        if not isinstance(row, dict):
            continue
        speaker = str(row.get("speaker") or "speaker").strip()
        text = str(row.get("text") or "").strip()
        if not text:
            continue
        transcript_excerpt.append({"speaker": speaker, "text": text})
        if len(transcript_excerpt) >= 12:
            break

    remediation_steps = _take_unique(
        _safe_list(ai_feedback.get("areas_for_improvement")) + _safe_list(report_data.get("recommendations")),
        limit=4,
    )
    score_ledger = metrics.get("score_ledger") if isinstance(metrics.get("score_ledger"), list) else []
    trial_mode = _trial_mode(metrics)
    plan_tier = _plan_tier(metrics)
    detailed_feedback_unlocked = not trial_mode and plan_tier != "trial"
    gaze_summary = metrics.get("gaze_summary") if isinstance(metrics.get("gaze_summary"), dict) else {}
    gaze_reliable = bool(gaze_summary.get("calibration_valid")) and str(gaze_summary.get("calibration_state") or "").lower() == "complete"

    return {
        "report_state": report_state,
        "title": report_data.get("title") or "Interview Report",
        "date": report_data.get("date") or "",
        "type": report_data.get("type") or "",
        "mode": report_data.get("mode") or "",
        "duration": report_data.get("duration") or "",
        "overall_score": overall_score,
        "capture_status": metrics.get("capture_status") or "COMPLETE",
        "benchmark_label": _benchmark_label(overall_score, report_state),
        "benchmark_narrative": _benchmark_narrative(overall_score, report_state),
        "score_context": report_data.get("score_context") or "",
        "hiring_recommendation": hiring_recommendation,
        "validity_score": validation_summary.get("validity_score"),
        "validity_label": validation_summary.get("validity_label"),
        "trust_signals": _take_unique(_safe_list(validation_summary.get("trust_signals")), limit=5),
        "score_formula": (
            metrics.get("evaluation_explainability", {}).get("formula")
            if isinstance(metrics.get("evaluation_explainability"), dict)
            else ""
        ),
        "score_weights": (
            metrics.get("evaluation_explainability", {}).get("weights")
            if isinstance(metrics.get("evaluation_explainability"), dict)
            else {}
        ),
        "score_reconciliation": (
            metrics.get("score_reconciliation")
            if isinstance(metrics.get("score_reconciliation"), dict)
            else {}
        ),
        "score_ledger_excerpt": [item for item in score_ledger[:6] if isinstance(item, dict)],
        "full_score_ledger": [item for item in score_ledger if isinstance(item, dict)],
        "strengths": _take_unique(strengths, limit=3),
        "risks": _take_unique(risks, limit=4),
        "action_plan": [item for item in improvement_roadmap[:3] if isinstance(item, dict)],
        "transcript_excerpt": transcript_excerpt,
        "score_provenance": score_provenance,
        "eye_contact_pct": metrics.get("eye_contact_pct"),
        "gaze_flags_count": metrics.get("gaze_flags_count"),
        "gaze_longest_away_ms": metrics.get("gaze_longest_away_ms"),
        "gaze_flags_by_type": metrics.get("gaze_flags_by_type") if isinstance(metrics.get("gaze_flags_by_type"), dict) else {},
        "gaze_summary_lines": _gaze_summary_lines(
            metrics.get("gaze_flags_by_type") if isinstance(metrics.get("gaze_flags_by_type"), dict) else {},
            metrics.get("eye_contact_pct"),
        ),
        "remediation_steps": remediation_steps,
        "trial_mode": trial_mode,
        "plan_tier": plan_tier,
        "detailed_feedback_unlocked": detailed_feedback_unlocked,
        "artifact_brand": "Ignitz",
        "artifact_logo_src": _load_ignitz_logo_data_uri(),
        "trial_upsell_title": "Upgrade for full-length interviews and deeper evidence-led feedback.",
        "trial_upsell_body": "This trial report includes your score, a concise summary, and the top coaching priorities. Paid plans unlock longer interviews, fuller evidence ledgers, and more detailed report analysis.",
        "gaze_reliable": gaze_reliable,
        "gaze_reliability_note": (
            "Presence signals were captured, but calibration quality was not reliable enough for prescriptive coaching."
            if not gaze_reliable
            else "Gaze signals met calibration requirements and are shown as advisory executive-presence feedback only."
        ),
    }


def _html_list(items: Iterable[str], empty_text: str = "") -> str:
    rows = [f"<li>{escape(str(item))}</li>" for item in items if str(item or "").strip()]
    if not rows and empty_text:
        rows = [f"<li>{escape(empty_text)}</li>"]
    return "<ul>" + "".join(rows) + "</ul>"


def render_interview_report_html(report_data: Dict[str, Any], *, include_brand_logo: bool = False, include_print_toolbar: bool = False) -> str:
    ctx = build_report_artifact_context(report_data)
    report_state = ctx["report_state"]
    is_invalid = report_state == REPORT_STATE_INVALID
    is_partial = report_state == REPORT_STATE_PARTIAL
    hiring = ctx["hiring_recommendation"] or {}
    validity_score = ctx["validity_score"]
    validity_label = str(ctx["validity_label"] or "unknown").title()
    overall_score = ctx["overall_score"]
    state_label = "Invalid session" if is_invalid else "Provisional assessment" if is_partial else "Scored assessment"
    adjustment_reason = ""
    if isinstance(ctx.get("score_reconciliation"), dict):
        adjustment_reason = str(
            ctx["score_reconciliation"].get("forced_zero_reason")
            or ctx["score_reconciliation"].get("score_cap_reason")
            or ""
        ).strip()

    action_cards = []
    for idx, item in enumerate(ctx["action_plan"], start=1):
        finding = escape(str(item.get("finding") or ""))
        action = escape(str(item.get("suggested_action") or ""))
        action_cards.append(
            f"""
            <div class="action-card">
              <div class="action-chip">Priority {idx}</div>
              <div class="action-title">{finding}</div>
              <div class="action-body">{action}</div>
            </div>
            """
        )

    transcript_rows = []
    for row in ctx["transcript_excerpt"]:
        transcript_rows.append(
            f"<div class='transcript-row'><span class='speaker'>{escape(row['speaker'])}</span><span>{escape(row['text'])}</span></div>"
        )

    gaze_rows = "".join(
        f"<div class='metric-chip'>{escape(_gaze_flag_label(str(key)))}: {escape(str(value))}</div>"
        for key, value in ctx["gaze_flags_by_type"].items()
    ) or "<div class='metric-chip'>No gaze flags captured</div>"
    score_weight_rows = "".join(
        f"<div class='metric-chip'>{escape(str(key).replace('_', ' ').title())}: {int(float(value) * 100)}%</div>"
        for key, value in (ctx.get("score_weights") or {}).items()
        if value is not None
    )
    score_weight_rows_html = score_weight_rows or "<div class='metric-chip'>Weights unavailable</div>"
    trust_signals_html = _html_list(
        ctx["trust_signals"],
        "Score backed by captured transcript evidence and validation checks.",
    )
    strengths_html = _html_list(
        ctx["strengths"],
        "No standout strengths were extracted from this session.",
    )
    risks_html = _html_list(
        ctx["risks"],
        "No material assessment risks were detected.",
    )
    remediation_html = _html_list(
        ctx["remediation_steps"],
        "Re-run the session after verifying microphone capture and transcript visibility.",
    )
    ledger_source = ctx.get("full_score_ledger") if ctx.get("detailed_feedback_unlocked") else ctx.get("score_ledger_excerpt")
    score_ledger_rows = []
    for row in ledger_source or []:
        question = escape(str(row.get("question_text") or "Question"))
        evidence = escape(str(row.get("evidence_quote") or ""))
        answer_excerpt = escape(str(row.get("answer_excerpt") or ""))
        included = bool(row.get("included_in_score"))
        contribution = row.get("weighted_points")
        exclusion_reason = escape(str(row.get("exclusion_reason") or ""))
        exclusion_detail = escape(str(row.get("exclusion_detail") or ""))
        transcript_ref_label = escape(str(row.get("transcript_ref_label") or f"Turn {row.get('turn_id') or '?'}"))
        score_ledger_rows.append(
            f"""
            <div class="ledger-row">
              <div class="ledger-title">{transcript_ref_label}</div>
              <div><strong>{question}</strong></div>
              {f"<div class='ledger-body'>Candidate excerpt: {answer_excerpt}</div>" if answer_excerpt else ""}
              <div class="ledger-body">{evidence}</div>
              {f"<div class='ledger-meta'>{exclusion_detail}</div>" if exclusion_detail and not included else ""}
              <div class="ledger-meta">
                {"Included in score" if included else f"Excluded: {exclusion_reason or 'not evaluated'}"}
                {f" • Contribution: {contribution}/100" if included and contribution is not None else ""}
              </div>
            </div>
            """
        )

    brand_logo_html = ""
    if include_brand_logo and ctx.get("artifact_logo_src"):
        brand_logo_html = (
            f"<img class='brand-logo' src='{escape(str(ctx['artifact_logo_src']))}' alt='Ignitz logo' />"
        )
    report_kicker = "Detailed Interview Report" if ctx["detailed_feedback_unlocked"] else "Trial Interview Report"
    cover_subtitle = (
        "A branded interview report showing the score, evidence quality, and what to improve next."
        if ctx["detailed_feedback_unlocked"]
        else "A concise trial report showing your score, top signals, and the highest-value next steps."
    )
    toolbar_html = (
        "<div class='print-toolbar'><button onclick='window.print()'>Save as PDF</button></div>"
        if include_print_toolbar
        else ""
    )

    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>{escape(str(ctx['title']))}</title>
  <style>
    @page {{
      size: A4;
      margin: 26pt 26pt 30pt 26pt;
    }}
    body {{
      font-family: Helvetica, Arial, sans-serif;
      color: #111827;
      font-size: 10.3pt;
      line-height: 1.5;
      background: #ffffff;
    }}
    .print-toolbar {{
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      justify-content: flex-end;
      padding: 12pt 18pt 0 18pt;
      background: rgba(255, 255, 255, 0.96);
    }}
    .print-toolbar button {{
      background: #0f172a;
      color: #f8fafc;
      border: none;
      border-radius: 999px;
      padding: 9pt 14pt;
      font-size: 9pt;
      cursor: pointer;
    }}
    .report-shell {{
      border: 1px solid #ddd4c5;
    }}
    .cover {{
      background: #f6f1e7;
      border-bottom: 1px solid #ddd4c5;
      padding: 0;
      margin-bottom: 16pt;
    }}
    .cover-band {{
      background: #0f172a;
      color: #f8fafc;
      padding: 12pt 18pt;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 10pt;
      font-size: 10pt;
      color: #e7dcc8;
      font-weight: bold;
      letter-spacing: 1.7pt;
      text-transform: uppercase;
    }}
    .brand-logo {{
      height: 22pt;
      width: auto;
      display: inline-block;
    }}
    .band-status {{
      float: right;
      font-size: 8.3pt;
      text-transform: uppercase;
      letter-spacing: 0.8pt;
      color: #d8e2f0;
    }}
    .cover-body {{
      padding: 18pt;
    }}
    .hero-table {{
      width: 100%;
      border-collapse: collapse;
    }}
    .hero-table td {{
      vertical-align: top;
    }}
    .title {{
      font-size: 21pt;
      font-weight: bold;
      margin-bottom: 5pt;
      color: #102033;
    }}
    .subtitle {{
      color: #5b6472;
      margin-bottom: 14pt;
    }}
    .meta-row {{
      color: #334155;
      margin-bottom: 3pt;
    }}
    .badge {{
      display: inline-block;
      padding: 5pt 8pt;
      margin-right: 6pt;
      margin-bottom: 6pt;
      border-radius: 999px;
      font-size: 8.5pt;
      background: #e8edf4;
      color: #102033;
      border: 1px solid #cbd5e1;
    }}
    .badge.good {{ background: #e7f4ea; color: #1f6a3f; border-color: #b8d8c2; }}
    .badge.warn {{ background: #fff1df; color: #9a4f12; border-color: #f1c48c; }}
    .badge.bad {{ background: #fde8e8; color: #9f2d2d; border-color: #efc0c0; }}
    .score-card {{
      border: 1px solid #ddd4c5;
      background: #ffffff;
      padding: 16pt 14pt;
      text-align: center;
      min-width: 150pt;
    }}
    .hero-score {{
      font-size: 31pt;
      font-weight: bold;
      margin: 4pt 0 2pt 0;
      color: #102033;
    }}
    .score-caption {{
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.8pt;
      color: #64748b;
      margin-bottom: 8pt;
    }}
    .score-meaning {{
      font-size: 9pt;
      color: #5f6774;
    }}
    h2 {{
      font-size: 12.5pt;
      margin: 18pt 0 8pt 0;
      color: #111827;
      padding-bottom: 5pt;
      border-bottom: 1px solid #ddd4c5;
    }}
    .section {{
      padding: 0 18pt 0 18pt;
      margin-bottom: 10pt;
    }}
    .section-table {{
      width: 100%;
      border-collapse: collapse;
    }}
    .section-table td {{
      vertical-align: top;
      padding-right: 10pt;
    }}
    .summary-card {{
      border: 1px solid #ddd4c5;
      background: #fffdfa;
      padding: 11pt;
      margin-bottom: 10pt;
    }}
    .summary-label {{
      font-size: 8.5pt;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.7pt;
      margin-bottom: 4pt;
    }}
    .summary-value {{
      font-size: 12pt;
      font-weight: bold;
      color: #151f2d;
      margin-bottom: 4pt;
    }}
    .grid {{
      width: 100%;
      margin-bottom: 10pt;
    }}
    .panel {{
      border: 1px solid #ddd4c5;
      padding: 12pt;
      margin-bottom: 10pt;
      background: #fffdfa;
    }}
    .panel-title {{
      font-size: 10.2pt;
      font-weight: bold;
      margin-bottom: 6pt;
      text-transform: uppercase;
      letter-spacing: 0.9pt;
      color: #6b7280;
    }}
    .section-lead {{
      color: #5f6774;
      margin: 0 0 8pt 0;
      font-size: 9pt;
    }}
    .muted {{ color: #55657d; }}
    ul {{
      margin: 6pt 0 0 14pt;
      padding: 0;
    }}
    li {{ margin-bottom: 4pt; }}
    .action-card {{
      border: 1px solid #ddd4c5;
      border-left: 4pt solid #8b6c31;
      padding: 10pt;
      margin-bottom: 8pt;
      background: #fffdfa;
    }}
    .action-chip {{
      font-size: 8.5pt;
      color: #8b6c31;
      font-weight: bold;
      margin-bottom: 4pt;
    }}
    .action-title {{
      font-weight: bold;
      margin-bottom: 4pt;
    }}
    .action-body {{
      color: #334155;
    }}
    .transcript-row {{
      border-bottom: 1px solid #e2e8f0;
      padding: 6pt 0;
    }}
    .speaker {{
      display: inline-block;
      min-width: 70pt;
      font-weight: bold;
    }}
    .metric-chip {{
      display: inline-block;
      margin: 0 6pt 6pt 0;
      padding: 4pt 7pt;
      border-radius: 999px;
      background: #f4eee2;
      color: #5b4330;
      font-size: 8.5pt;
      border: 1px solid #ddd4c5;
    }}
    .ledger-row {{
      border: 1px solid #ddd4c5;
      padding: 10pt;
      margin-bottom: 8pt;
      background: #fffdfa;
    }}
    .ledger-title {{
      font-weight: bold;
      margin-bottom: 4pt;
    }}
    .ledger-body {{
      color: #475569;
      margin-bottom: 4pt;
    }}
    .ledger-meta {{
      color: #64748b;
      font-size: 8.5pt;
    }}
    .small {{
      font-size: 9pt;
    }}
    .eyebrow {{
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.8pt;
      color: #6b7280;
      margin-bottom: 4pt;
    }}
  </style>
</head>
<body>
  {toolbar_html}
  <div class="report-shell">
    <div class="cover">
      <div class="cover-band">
        <div class="brand">{brand_logo_html}<span>{escape(str(ctx["artifact_brand"]))}</span></div>
        <div class="band-status">{escape(state_label)}</div>
      </div>
      <div class="cover-body">
        <table class="hero-table">
          <tr>
            <td width="68%">
              <div class="eyebrow">{escape(report_kicker)}</div>
              <div class="title">{escape(str(ctx["title"]))}</div>
              <div class="subtitle">{escape(cover_subtitle)}</div>
              <div class="meta-row"><strong>Date:</strong> {escape(str(ctx["date"]))}</div>
              <div class="meta-row"><strong>Interview Type:</strong> {escape(str(ctx["type"]))}</div>
              <div class="meta-row"><strong>Mode:</strong> {escape(str(ctx["mode"]))}</div>
              <div class="meta-row"><strong>Duration:</strong> {escape(str(ctx["duration"]))}</div>
              <div style="margin-top: 10pt;">
                <span class="badge {'bad' if is_invalid else 'warn' if is_partial else 'good'}">Benchmark: {escape(str(ctx["benchmark_label"]))}</span>
                <span class="badge {'bad' if str(ctx['validity_label']).lower() == 'low' else 'warn' if str(ctx['validity_label']).lower() == 'moderate' else 'good'}">Validity: {escape(validity_label)}</span>
                {f"<span class='badge'>{escape(str(hiring.get('label') or ''))}</span>" if hiring.get("label") and not is_invalid else ""}
              </div>
            </td>
            <td width="32%">
              <div class="score-card">
                <div class="score-caption">{'Session Status' if is_invalid else 'Final Score'}</div>
                {"<div class='hero-score'>Unavailable</div>" if is_invalid else f"<div class='hero-score'>{overall_score}/100</div>"}
                <div class="score-meaning">{escape(str(ctx["benchmark_narrative"]))}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <div class="section">
      <table class="section-table">
        <tr>
          <td width="33.33%">
            <div class="summary-card">
              <div class="summary-label">Capture Status</div>
              <div class="summary-value">{escape(str(ctx["capture_status"]).replace("_", " ").title())}</div>
              <div class="small muted">Session capture quality at save time.</div>
            </div>
          </td>
          <td width="33.33%">
            <div class="summary-card">
              <div class="summary-label">{'Validity State' if is_invalid else 'Validity Score'}</div>
              <div class="summary-value">{escape(str(validity_score)) + '/100' if validity_score is not None and not is_invalid else escape(validity_label)}</div>
              <div class="small muted">How dependable this artifact is for decision-making.</div>
            </div>
          </td>
          <td width="33.33%">
            <div class="summary-card">
              <div class="summary-label">Evaluation Source</div>
              <div class="summary-value">{escape(str(ctx["score_provenance"].get("source") or "unknown").replace("_", " ").title())}</div>
              <div class="small muted">Confidence: {escape(str(ctx["score_provenance"].get("confidence") or "unknown").title())}</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    {(
      "<div class='section'><div class='panel'>"
      + "<div class='panel-title'>Trial Plan</div>"
      + f"<div class='small muted'><strong>{escape(str(ctx['trial_upsell_title']))}</strong></div>"
      + f"<div class='small muted' style='margin-top:6pt;'>{escape(str(ctx['trial_upsell_body']))}</div>"
      + "</div></div>"
    ) if ctx["trial_mode"] else ""}

    {("<div class='section'><h2>Session Remediation</h2><div class='section-lead'>This artifact is operational only. Resolve capture quality before using the session for candidate evaluation.</div><div class='panel'><div class='panel-title'>Why this artifact is not decision-grade</div><div class='small muted'>No benchmark comparison or hiring recommendation should be inferred from this session because meaningful candidate evidence was not captured.</div>" + remediation_html + "</div></div>") if is_invalid else ""}

    {"" if is_invalid else (
      "<div class='section'><h2>Executive Judgment</h2><div class='section-lead'>A concise hiring-quality view of what made the interview convincing, uneven, or risky.</div>"
      + "<table class='section-table'><tr>"
      + "<td width='50%'><div class='panel'><div class='panel-title'>Why this score is trustworthy</div>"
      + trust_signals_html
      + "</div></td>"
      + "<td width='50%'><div class='panel'><div class='panel-title'>Assessment Positioning</div>"
      + f"<div class='small muted'>{escape(str(ctx['benchmark_narrative']))}</div>"
      + (f"<div class='small muted' style='margin-top:8pt;'>{escape(str(ctx['score_context']))}</div>" if ctx.get("score_context") else "")
      + "</div></td>"
      + "</tr></table>"
      + "<table class='section-table'><tr>"
      + "<td width='50%'><div class='panel'><div class='panel-title'>Top Strengths</div>" + strengths_html + "</div></td>"
      + "<td width='50%'><div class='panel'><div class='panel-title'>Top Risks</div>" + risks_html + "</div></td>"
      + "</tr></table></div>"
    )}

    {"" if is_invalid or not ctx["detailed_feedback_unlocked"] else (
      "<div class='section'><h2>Scoring Evidence Ledger</h2><div class='section-lead'>The weighted scoring model, any enforced adjustment, and the transcript-grounded evidence used in the final result.</div>"
      + "<div class='panel'>"
      + "<div class='panel-title'>Weighted scoring model</div>"
      + f"<div class='small muted'>{escape(str(ctx.get('score_formula') or 'Weighted rubric calculation'))}</div>"
      + f"<div style='margin-top: 8pt;'>{score_weight_rows_html}</div>"
      + (
          f"<div class='small muted' style='margin-top: 10pt;'>"
          f"Base score: {escape(str(ctx['score_reconciliation'].get('base_overall_score', overall_score)))}/100"
          f" → Final score: {escape(str(ctx['score_reconciliation'].get('final_overall_score', overall_score)))}/100"
          f"{' • Adjustment: ' + escape(adjustment_reason.replace('_', ' ')) if adjustment_reason else ''}"
          f"</div>"
          if ctx.get("score_reconciliation") else ""
        )
      + "</div>"
      + ("".join(score_ledger_rows) if score_ledger_rows else "<div class='panel'><div class='small muted'>No scored-turn ledger was available for this session.</div></div>")
      + "</div>"
    )}

    {"" if is_invalid or not action_cards else "<div class='section'><h2>" + ("Action Plan" if ctx["trial_mode"] else "Coaching Priorities") + "</h2><div class='section-lead'>" + ("The shortest path to a stronger next interview." if ctx["trial_mode"] else "The shortest path to a better next interview, ordered by likely impact.") + "</div>" + "".join(action_cards) + "</div>"}

    <div class="section">
      <h2>Presence Signals</h2>
      <div class="section-lead">Observed eye-line and face-visibility signals captured during the interview. These remain advisory and are excluded from the final score.</div>
      <div class="panel">
        <div class="panel-title">Observed interview-presence signals</div>
        <div class="small muted">{escape(str(ctx["gaze_reliability_note"]))}</div>
        {f"<div class='small muted' style='margin-top: 8pt;'>{'<br/>'.join(escape(str(line)) for line in ctx['gaze_summary_lines'])}</div>" if ctx["gaze_summary_lines"] and ctx["gaze_reliable"] else ""}
        <div style="margin-top: 10pt;">
          <span class="metric-chip">Eye contact: {escape(str(ctx['eye_contact_pct'])) if ctx['eye_contact_pct'] is not None else 'Not captured'}</span>
          <span class="metric-chip">Flags: {escape(str(ctx['gaze_flags_count'] if ctx['gaze_flags_count'] is not None else '0'))}</span>
          <span class="metric-chip">Longest event (ms): {escape(str(ctx['gaze_longest_away_ms'] if ctx['gaze_longest_away_ms'] is not None else '0'))}</span>
        </div>
        <div style="margin-top: 8pt;">{gaze_rows if ctx["gaze_reliable"] else "<div class='metric-chip'>Calibration not reliable enough for detailed gaze coaching</div>"}</div>
      </div>
    </div>

    {"" if not transcript_rows or not ctx["detailed_feedback_unlocked"] else "<div class='section'><h2>Transcript Appendix</h2><div class='panel'>" + "".join(transcript_rows) + "</div></div>"}
  </div>
</body>
</html>"""


def render_interview_report_pdf_bytes(report_data: Dict[str, Any]) -> bytes:
    html = render_interview_report_html(report_data)
    try:
        from xhtml2pdf import pisa  # type: ignore
    except Exception as exc:  # pragma: no cover - dependency driven
        raise RuntimeError("xhtml2pdf is required for premium interview PDF generation") from exc

    out = BytesIO()
    result = pisa.CreatePDF(src=html, dest=out, encoding="utf-8")
    if getattr(result, "err", 0):
        raise RuntimeError("Failed to render interview PDF from HTML")
    return out.getvalue()
