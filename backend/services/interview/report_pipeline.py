"""Helpers for transcript normalization and report evidence integrity."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Tuple


USER_SPEAKERS = {"user", "candidate", "you"}
AI_SPEAKERS = {"ai", "interviewer", "sonia"}


def _normalize_speaker(value: Any) -> str:
    speaker = str(value or "unknown").strip().lower()
    if speaker in USER_SPEAKERS:
        return "user"
    if speaker in AI_SPEAKERS:
        return "ai"
    return speaker


def _normalize_message(message: Dict[str, Any], *, default_timestamp: str) -> Dict[str, Any] | None:
    if not isinstance(message, dict):
        return None
    text = str(message.get("text") or "").strip()
    if not text:
        return None
    trusted = message.get("trusted_for_evaluation")
    return {
        "speaker": _normalize_speaker(message.get("speaker")),
        "text": text,
        "timestamp": message.get("timestamp") or default_timestamp,
        "evidence_source": str(message.get("evidence_source") or "").strip() or None,
        "trusted_for_evaluation": False if trusted is False else True,
        "transcript_origin": str(message.get("transcript_origin") or "").strip() or None,
    }


def pair_messages(messages: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    qa_pairs: List[Dict[str, Any]] = []
    unpaired: List[Dict[str, Any]] = []
    pending_question: Dict[str, Any] | None = None

    for message in messages:
        speaker = _normalize_speaker(message.get("speaker"))
        if speaker == "ai":
            if pending_question:
                unpaired.append(
                    {
                        "type": "unanswered_question",
                        "text": pending_question.get("text"),
                        "timestamp": pending_question.get("timestamp"),
                    }
                )
            pending_question = message
            continue

        if speaker != "user":
            continue

        if pending_question:
            qa_pairs.append(
                {
                    "question": str(pending_question.get("text") or "").strip(),
                    "answer": str(message.get("text") or "").strip(),
                    "timestamp": message.get("timestamp") or pending_question.get("timestamp"),
                }
            )
            pending_question = None
        else:
            unpaired.append(
                {
                    "type": "answer_without_question",
                    "text": str(message.get("text") or "").strip(),
                    "timestamp": message.get("timestamp"),
                    "speaker": "user",
                }
            )

    if pending_question:
        unpaired.append(
            {
                "type": "unanswered_question",
                "text": pending_question.get("text"),
                "timestamp": pending_question.get("timestamp"),
            }
        )

    return qa_pairs, unpaired


def normalize_transcript_payload(transcript_input: Any) -> Dict[str, Any]:
    now_iso = datetime.now().isoformat()
    qa_pairs: List[Dict[str, Any]] = []
    raw_messages: List[Dict[str, Any]] = []
    unpaired: List[Dict[str, Any]] = []
    mode = "structured"

    if isinstance(transcript_input, dict):
        mode = str(transcript_input.get("mode") or "structured")
        raw_messages = [
            normalized
            for normalized in (
                _normalize_message(message, default_timestamp=now_iso)
                for message in (transcript_input.get("raw_messages") or [])
            )
            if normalized
        ]
        raw_messages.sort(key=lambda message: message.get("timestamp") or "")

        for pair in transcript_input.get("qa_pairs") or []:
            if not isinstance(pair, dict):
                continue
            question = str(pair.get("question") or "").strip()
            answer = str(pair.get("answer") or "").strip()
            if not question and not answer:
                continue
            qa_pairs.append(
                {
                    "question": question,
                    "answer": answer,
                    "timestamp": pair.get("timestamp") or now_iso,
                }
            )

        if not qa_pairs and raw_messages:
            qa_pairs, unpaired = pair_messages(raw_messages)
        else:
            unpaired = list(transcript_input.get("unpaired") or [])
    elif isinstance(transcript_input, list):
        for pair in transcript_input:
            if not isinstance(pair, dict):
                continue
            question = str(pair.get("question") or "").strip()
            answer = str(pair.get("answer") or "").strip()
            if not question and not answer:
                continue
            timestamp = pair.get("timestamp") or now_iso
            qa_pairs.append(
                {
                    "question": question,
                    "answer": answer,
                    "timestamp": timestamp,
                }
            )
            if question:
                raw_messages.append(
                    {
                        "speaker": "ai",
                        "text": question,
                        "timestamp": timestamp,
                        "evidence_source": "legacy_qa_pair",
                        "trusted_for_evaluation": True,
                        "transcript_origin": "legacy_qa_pair",
                    }
                )
            if answer:
                raw_messages.append(
                    {
                        "speaker": "user",
                        "text": answer,
                        "timestamp": timestamp,
                        "evidence_source": "legacy_qa_pair",
                        "trusted_for_evaluation": True,
                        "transcript_origin": "legacy_qa_pair",
                    }
                )
        raw_messages.sort(key=lambda message: message.get("timestamp") or "")
    else:
        return {
            "mode": "raw",
            "qa_pairs": [],
            "trusted_qa_pairs": [],
            "unpaired": [],
            "raw_messages": [],
            "trusted_raw_messages": [],
            "fallback_raw_messages": [],
            "capture_integrity": summarize_capture_integrity([]),
        }

    trusted_raw_messages = [message for message in raw_messages if message.get("trusted_for_evaluation") is not False]
    fallback_raw_messages = [message for message in raw_messages if message.get("trusted_for_evaluation") is False]
    trusted_qa_pairs, _ = pair_messages(trusted_raw_messages)

    if not mode:
        if qa_pairs and not unpaired:
            mode = "structured"
        elif qa_pairs:
            mode = "hybrid"
        else:
            mode = "raw"

    return {
        "mode": mode,
        "qa_pairs": qa_pairs,
        "trusted_qa_pairs": trusted_qa_pairs,
        "unpaired": unpaired,
        "raw_messages": raw_messages,
        "trusted_raw_messages": trusted_raw_messages,
        "fallback_raw_messages": fallback_raw_messages,
        "capture_integrity": summarize_capture_integrity(raw_messages),
    }


def summarize_capture_integrity(messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    trusted_candidate = [
      message for message in messages
      if _normalize_speaker(message.get("speaker")) == "user" and message.get("trusted_for_evaluation") is not False
    ]
    fallback_candidate = [
      message for message in messages
      if _normalize_speaker(message.get("speaker")) == "user" and message.get("trusted_for_evaluation") is False
    ]
    trusted_ai = [
      message for message in messages
      if _normalize_speaker(message.get("speaker")) == "ai" and message.get("trusted_for_evaluation") is not False
    ]
    fallback_ai = [
      message for message in messages
      if _normalize_speaker(message.get("speaker")) == "ai" and message.get("trusted_for_evaluation") is False
    ]

    def word_count(entries: List[Dict[str, Any]]) -> int:
        return sum(len(str(entry.get("text") or "").split()) for entry in entries)

    return {
        "trusted_candidate_turn_count": len(trusted_candidate),
        "fallback_candidate_turn_count": len(fallback_candidate),
        "trusted_candidate_word_count": word_count(trusted_candidate),
        "fallback_candidate_word_count": word_count(fallback_candidate),
        "trusted_ai_turn_count": len(trusted_ai),
        "fallback_ai_turn_count": len(fallback_ai),
        "contains_fallback_candidate_transcript": len(fallback_candidate) > 0,
        "contains_mixed_candidate_evidence": len(trusted_candidate) > 0 and len(fallback_candidate) > 0,
    }


def build_candidate_turn_pairs_for_evaluation(normalized_payload: Dict[str, Any]) -> List[Dict[str, str]]:
    trusted_qa_pairs = normalized_payload.get("trusted_qa_pairs") or []
    if trusted_qa_pairs:
        return [
            {
                "question": str(pair.get("question") or "").strip(),
                "answer": str(pair.get("answer") or "").strip(),
            }
            for pair in trusted_qa_pairs
            if isinstance(pair, dict) and str(pair.get("answer") or "").strip()
        ]

    trusted_raw_messages = normalized_payload.get("trusted_raw_messages") or []
    return [
        {"question": "", "answer": str(message.get("text") or "").strip()}
        for message in trusted_raw_messages
        if _normalize_speaker(message.get("speaker")) == "user" and str(message.get("text") or "").strip()
    ]


def determine_score_trust_level(
    *,
    capture_status: str,
    capture_integrity: Dict[str, Any],
    contract_passed: bool,
    hard_guard_flags: List[str] | None = None,
) -> str:
    if not contract_passed or hard_guard_flags:
        return "coaching_only"
    if capture_status in {"INCOMPLETE_NO_CANDIDATE_AUDIO", "INCOMPLETE_PARTIAL_CAPTURE", "INCOMPLETE_FALLBACK_ONLY_CAPTURE"}:
        return "coaching_only"
    if capture_integrity.get("contains_mixed_candidate_evidence"):
        return "mixed_evidence"
    return "trusted"
