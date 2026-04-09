"""
TranscriptSummaryChain: structured output {accent, grammar, interview_tips}.
Uses openai package; interface is LangChain-ready for future swap.
"""

import json
import re
from typing import Dict, Any, List, Optional

from services.llm.prompt_registry import get_summary_prompt
try:
    from services.llm.provider_adapter import create_chat_completion
except Exception:  # pragma: no cover
    from backend.services.llm.provider_adapter import create_chat_completion  # type: ignore


def _build_transcript_string(turns: List[Dict[str, Any]]) -> str:
    """Format canonical turns for the prompt."""
    lines = []
    for t in turns:
        sp = (t.get("speaker") or "Unknown").strip()
        label = "INTERVIEWER" if sp == "interviewer" else "CANDIDATE"
        text = (t.get("text") or "").strip()
        if text:
            lines.append(f"{label}: {text}")
    return "\n\n".join(lines) if lines else "No transcript content."


def summarize_transcript(
    turns: List[Dict[str, Any]],
    prompt_key: str = "summary.candidate_speech.v1",
) -> Optional[Dict[str, Any]]:
    """
    Run transcript summary pipeline. Returns {accent, grammar, interview_tips} or None on failure.
    """
    transcript_str = _build_transcript_string(turns)
    template = get_summary_prompt(prompt_key)
    prompt = template.format(transcript=transcript_str)

    if create_chat_completion is None:
        return None

    try:
        resp = create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            purpose="summarize_transcript",
            temperature=0.3,
            max_tokens=800,
        )
        raw = str(resp.get("text") or "")
    except Exception as e:
        print(f"TranscriptSummaryChain error: {e}")
        return None

    # Parse JSON from response (allow wrapped in markdown code block)
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if m:
        raw = m.group(1).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: treat whole thing as interview_tips
        data = {"accent": "—", "grammar": "—", "interview_tips": raw}

    for key in ("accent", "grammar", "interview_tips"):
        if key not in data:
            data[key] = str(data.get(key, "—"))
    return {
        "accent": str(data.get("accent", "—")),
        "grammar": str(data.get("grammar", "—")),
        "interview_tips": str(data.get("interview_tips", "—")),
    }
