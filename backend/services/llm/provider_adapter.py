"""Shared chat provider adapter using direct OpenAI."""

from __future__ import annotations

import json
import os
import random
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple


def _openai_module():
    try:
        from openai import OpenAI
    except ImportError:  # pragma: no cover - dependency availability varies locally
        return None
    return OpenAI


def _openai_candidate() -> Optional[Tuple[Any, str]]:
    OpenAI = _openai_module()
    if OpenAI is None:
        return None

    try:
        from services.feature_flags import openai_configured
        if not openai_configured():
            return None
    except Exception:  # pragma: no cover - fallback to historical check
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")
        if not api_key or api_key == "your-openai-api-key-here":
            return None

    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")
    try:
        client = OpenAI(api_key=api_key)
    except Exception:
        return None

    return client, os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")


# ─────────────────────────────────────────────────────────────────────
# Demo provider — used when DEMO_MODE=true and no real OpenAI key.
# Produces deterministic, structurally-correct responses so the entire app
# is interactive without external credentials. Never use in production.
# ─────────────────────────────────────────────────────────────────────

_DEMO_CANNED_BY_PURPOSE: Dict[str, Any] = {
    "scoring": {
        "communication_score": 78,
        "technical_score": 72,
        "behavioral_score": 81,
        "overall_score": 77,
        "summary": "Solid structured answer. STAR elements present. Pacing was steady.",
        "strengths": [
            "Clear situation framing",
            "Quantified result at the end",
            "Confident tone throughout",
        ],
        "improvements": [
            "Tighten the action section — too many sub-steps",
            "Add one explicit metric to the task statement",
        ],
        "star_present": {"situation": True, "task": True, "action": True, "result": True},
    },
    "orchestrator": {
        "next_question": "Tell me about a time you had to deliver under a tight deadline.",
        "rationale": "Probes execution under pressure; complements the prior depth question.",
        "category": "behavioral",
    },
    "candidate_feedback": {
        "headline": "Strong overall performance with room to tighten storytelling.",
        "bullets": [
            "Communication was clear and confident.",
            "Used STAR structure on 3 of 4 answers.",
            "Reduce filler words in the next attempt.",
        ],
    },
}

_DEMO_DEFAULT = {
    "text": "Demo response — set OPENAI_API_KEY to enable real LLM output.",
}


class _DemoClient:
    """Mimics the shape openai's client returns for chat.completions.create."""

    class _ChatNamespace:
        class _Completions:
            def __init__(self, parent: "_DemoClient"):
                self._parent = parent

            def create(self, *, model: str, messages: Sequence[Dict[str, Any]], **_kwargs):
                purpose = self._parent._last_purpose or "generic"
                payload = _DEMO_CANNED_BY_PURPOSE.get(purpose, _DEMO_DEFAULT)
                text = json.dumps(payload, indent=2)

                # Simulate token usage proportional to text length so demo
                # dashboards have non-trivial sparklines.
                prompt_tokens = sum(len(str(m.get("content") or "")) // 4 for m in messages) or 80
                completion_tokens = max(60, len(text) // 4)
                total_tokens = prompt_tokens + completion_tokens

                class _Msg:
                    def __init__(self, content: str):
                        self.content = content

                class _Choice:
                    def __init__(self, content: str):
                        self.message = _Msg(content)
                        self.finish_reason = "stop"

                class _Usage:
                    def __init__(self, p: int, c: int, t: int):
                        self.prompt_tokens = p
                        self.completion_tokens = c
                        self.total_tokens = t

                class _Resp:
                    def __init__(self):
                        self.id = f"demo-{random.randint(10_000, 99_999)}"
                        self.model = model
                        self.choices = [_Choice(text)]
                        self.usage = _Usage(prompt_tokens, completion_tokens, total_tokens)

                # tiny artificial delay so latency_ms isn't always zero
                time.sleep(0.05 + random.random() * 0.15)
                return _Resp()

        def __init__(self, parent: "_DemoClient"):
            self.completions = _DemoClient._ChatNamespace._Completions(parent)

    def __init__(self):
        self._last_purpose: Optional[str] = None
        self.chat = _DemoClient._ChatNamespace(self)


def _demo_candidate() -> Optional[Tuple[Any, str]]:
    try:
        from services.feature_flags import demo_mode_enabled, openai_configured
    except Exception:
        return None
    if openai_configured():
        return None
    if not demo_mode_enabled():
        return None
    return _DemoClient(), os.getenv("DEMO_LLM_MODEL", "demo-gpt-4o-mini")


def get_chat_provider_chain() -> List[Dict[str, Any]]:
    providers: List[Dict[str, Any]] = []

    openai_direct = _openai_candidate()
    if openai_direct:
        client, model = openai_direct
        providers.append(
            {
                "provider": "openai",
                "client": client,
                "model": model,
            }
        )

    demo = _demo_candidate()
    if demo:
        client, model = demo
        providers.append(
            {
                "provider": "demo",
                "client": client,
                "model": model,
            }
        )

    return providers


def build_provider_trace(
    *,
    provider: Optional[str],
    model: Optional[str],
    latency_ms: Optional[int],
    failover_used: bool,
    attempts: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        "provider": provider,
        "model": model,
        "latency_ms": latency_ms,
        "failover_used": bool(failover_used),
        "attempts": list(attempts),
    }


def create_chat_completion(
    *,
    messages: Sequence[Dict[str, Any]],
    temperature: float = 0.3,
    max_tokens: int = 800,
    purpose: str = "generic",
) -> Dict[str, Any]:
    attempts: List[Dict[str, Any]] = []
    providers = get_chat_provider_chain()
    if not providers:
        return {
            "text": None,
            "provider_trace": build_provider_trace(
                provider=None,
                model=None,
                latency_ms=None,
                failover_used=False,
                attempts=[],
            ),
            "error": "no_provider_available",
            "purpose": purpose,
        }

    for index, candidate in enumerate(providers):
        provider = str(candidate.get("provider") or "unknown")
        model = str(candidate.get("model") or "").strip() or None
        client = candidate.get("client")
        # Demo client needs to know the call's purpose so it can return the
        # right canned payload (scoring vs orchestrator vs default).
        if isinstance(client, _DemoClient):
            client._last_purpose = purpose
        started = time.perf_counter()
        try:
            response = client.chat.completions.create(
                model=model,
                messages=list(messages),
                temperature=temperature,
                max_tokens=max_tokens,
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            text = ((response.choices or [{}])[0].message.content or "").strip()
            attempts.append(
                {
                    "provider": provider,
                    "model": model,
                    "latency_ms": latency_ms,
                    "status": "success",
                }
            )
            try:
                from services.observability.usage_recorder import record_openai_response_usage
                record_openai_response_usage(
                    getattr(response, "usage", None),
                    model=str(model or "unknown"),
                    route=str(purpose or "llm"),
                    provider=str(provider or "openai"),
                    latency_ms=latency_ms,
                )
            except Exception:
                pass
            return {
                "text": text,
                "provider_trace": build_provider_trace(
                    provider=provider,
                    model=model,
                    latency_ms=latency_ms,
                    failover_used=index > 0,
                    attempts=attempts,
                ),
                "response": response,
                "purpose": purpose,
            }
        except Exception as exc:  # pragma: no cover - external provider behavior
            latency_ms = int((time.perf_counter() - started) * 1000)
            attempts.append(
                {
                    "provider": provider,
                    "model": model,
                    "latency_ms": latency_ms,
                    "status": "error",
                    "error": str(exc),
                }
            )

    last_attempt = attempts[-1] if attempts else {}
    return {
        "text": None,
        "provider_trace": build_provider_trace(
            provider=last_attempt.get("provider"),
            model=last_attempt.get("model"),
            latency_ms=last_attempt.get("latency_ms"),
            failover_used=len(attempts) > 1,
            attempts=attempts,
        ),
        "error": last_attempt.get("error") or "provider_error",
        "purpose": purpose,
    }
