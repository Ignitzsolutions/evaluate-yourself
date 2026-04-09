"""Shared chat provider adapter with Azure-primary failover to direct OpenAI."""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple


def _openai_module():
    try:
        from openai import AzureOpenAI, OpenAI
    except ImportError:  # pragma: no cover - dependency availability varies locally
        return None, None
    return AzureOpenAI, OpenAI


def _azure_candidate() -> Optional[Tuple[Any, str]]:
    AzureOpenAI, _ = _openai_module()
    if AzureOpenAI is None:
        return None

    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    deployment = (os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "") or "").strip()
    if not api_key or not endpoint or not deployment:
        return None
    if api_key == "your-azure-openai-api-key-here":
        return None

    try:
        client = AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint.rstrip("/"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
        )
    except Exception:
        return None

    return client, deployment


def _openai_candidate() -> Optional[Tuple[Any, str]]:
    _, OpenAI = _openai_module()
    if OpenAI is None:
        return None

    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")
    if not api_key or api_key == "your-openai-api-key-here":
        return None

    try:
        client = OpenAI(api_key=api_key)
    except Exception:
        return None

    return client, os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")


def get_chat_provider_chain() -> List[Dict[str, Any]]:
    providers: List[Dict[str, Any]] = []

    azure = _azure_candidate()
    if azure:
        client, model = azure
        providers.append(
            {
                "provider": "azure",
                "client": client,
                "model": model,
            }
        )

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
