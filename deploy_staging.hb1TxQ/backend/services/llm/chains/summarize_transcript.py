"""
TranscriptSummaryChain: structured output {accent, grammar, interview_tips}.
Uses openai package; interface is LangChain-ready for future swap.
"""

import os
import json
import re
from typing import Dict, Any, List, Optional

from services.llm.prompt_registry import get_summary_prompt


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


def _get_openai_client():
    """Return (Azure OpenAI or OpenAI client, model_or_deployment_name) from env."""
    try:
        from openai import OpenAI, AzureOpenAI
    except ImportError:
        return None, None

    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")

    if azure_key and azure_endpoint and (azure_key != "your-azure-openai-api-key-here"):
        deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT") or os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
        client = AzureOpenAI(
            api_key=azure_key,
            azure_endpoint=azure_endpoint.rstrip("/"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
        )
        return client, deployment
    if api_key and api_key != "your-openai-api-key-here":
        return OpenAI(api_key=api_key), os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
    return None, None


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

    client, model_or_deploy = _get_openai_client()
    if not client:
        return None

    try:
        resp = client.chat.completions.create(
            model=model_or_deploy or "gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800,
        )
        raw = (resp.choices or [{}])[0].message.content or ""
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
