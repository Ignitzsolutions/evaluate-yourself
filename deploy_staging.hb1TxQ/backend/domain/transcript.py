"""Transcript normalization and deduplication for canonical turn sequence."""

from typing import List, Dict, Any


def normalize_transcript_entries(raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Convert raw transcript entries to canonical {speaker, text, timestamp}.
    Preserves chronological order.
    """
    canonical = []
    for entry in raw:
        speaker = (entry.get("speaker") or "Unknown").strip().lower()
        if speaker in ("interviewer", "assistant"):
            speaker = "interviewer"
        elif speaker in ("candidate", "user", "you"):
            speaker = "candidate"
        text = (entry.get("text") or "").strip()
        ts = entry.get("timestamp") or ""
        canonical.append({
            "speaker": speaker,
            "text": text,
            "timestamp": ts,
        })
    return canonical


def _same_or_near_text(a: str, b: str, max_len_diff: int = 20) -> bool:
    """Treat as same utterance if exact match or one is prefix of the other within max_len_diff."""
    if a == b:
        return True
    if not a or not b:
        return False
    if abs(len(a) - len(b)) > max_len_diff:
        return False
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    return longer.startswith(shorter) or shorter.startswith(longer)


def deduplicate_turns(turns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Merge consecutive same-speaker + same-or-near-same text into one turn.
    Keeps earliest timestamp of merged set.
    """
    if not turns:
        return []

    out: List[Dict[str, Any]] = []
    cur = dict(turns[0])

    for i in range(1, len(turns)):
        nxt = turns[i]
        if (
            cur["speaker"] == nxt["speaker"]
            and _same_or_near_text((cur.get("text") or ""), (nxt.get("text") or ""))
        ):
            # merge: keep cur's timestamp (earlier)
            pass
        else:
            out.append(cur)
            cur = dict(nxt)
    out.append(cur)
    return out


def to_canonical_transcript(raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalize then deduplicate. Use this before writing transcript to disk."""
    normalized = normalize_transcript_entries(raw)
    return deduplicate_turns(normalized)
