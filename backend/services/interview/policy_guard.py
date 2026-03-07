"""Policy guards for interviewer control hardening."""

from __future__ import annotations

import re
from typing import Optional


_CONTROL_PATTERNS = [
    re.compile(r"\bignore\b.{0,40}\b(previous|earlier|system|instructions?)\b", re.IGNORECASE),
    re.compile(r"\b(system prompt|developer message|hidden prompt)\b", re.IGNORECASE),
    re.compile(r"\b(act as|pretend to be|you are now)\b", re.IGNORECASE),
    re.compile(r"\b(ask only|only ask|don't ask|do not ask)\b", re.IGNORECASE),
    re.compile(r"\b(change topic|switch topic|different question)\b", re.IGNORECASE),
    re.compile(r"\b(let me interview you|i will ask you)\b", re.IGNORECASE),
    re.compile(r"\b(skip this|move to easier|easier questions)\b", re.IGNORECASE),
]

_PROMPT_INJECTION_SNIPPETS = [
    "ignore previous instructions",
    "ignore all instructions",
    "system prompt",
    "developer message",
    "act as",
    "you are now",
    "from now on",
]


def detect_interviewer_control_attempt(text: Optional[str]) -> bool:
    candidate_text = str(text or "").strip()
    if not candidate_text:
        return False
    if len(candidate_text) > 600:
        candidate_text = candidate_text[:600]
    return any(pattern.search(candidate_text) for pattern in _CONTROL_PATTERNS)


def sanitize_context_text(value: Optional[str], *, max_length: int = 80) -> Optional[str]:
    raw = str(value or "").strip()
    if not raw:
        return None

    # Keep printable ASCII and normalize whitespace.
    cleaned = re.sub(r"[^\x20-\x7E]+", " ", raw)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    lowered = cleaned.lower()

    # Remove common prompt-injection snippets.
    for snippet in _PROMPT_INJECTION_SNIPPETS:
        lowered = lowered.replace(snippet, " ")
    lowered = re.sub(r"\s+", " ", lowered).strip()

    # Allow only conservative text for role/company context.
    lowered = re.sub(r"[^a-z0-9&,\-./()+ ]+", "", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    if not lowered:
        return None
    return lowered[:max_length]
