"""Pricing table for LLM and Realtime API cost estimation.

All prices in USD. Stored as micro-dollars internally (USD * 1_000_000) to avoid float drift.
Prices are approximate; reconcile against provider invoices for billing.
Update PRICING when provider rates change.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class ModelPrice:
    """Per-1k-token prices (chat) or per-minute (realtime audio)."""
    input_per_1k_usd: float = 0.0
    output_per_1k_usd: float = 0.0
    audio_input_per_min_usd: float = 0.0
    audio_output_per_min_usd: float = 0.0


# Approximate public pricing as of 2025-Q1. Adjust as needed.
PRICING: Dict[str, ModelPrice] = {
    # Chat / completion models
    "gpt-4o": ModelPrice(input_per_1k_usd=0.005, output_per_1k_usd=0.015),
    "gpt-4o-mini": ModelPrice(input_per_1k_usd=0.00015, output_per_1k_usd=0.0006),
    "gpt-4o-2024-08-06": ModelPrice(input_per_1k_usd=0.0025, output_per_1k_usd=0.010),
    "gpt-4-turbo": ModelPrice(input_per_1k_usd=0.010, output_per_1k_usd=0.030),
    "gpt-4": ModelPrice(input_per_1k_usd=0.030, output_per_1k_usd=0.060),
    "gpt-3.5-turbo": ModelPrice(input_per_1k_usd=0.0005, output_per_1k_usd=0.0015),
    # Realtime (audio + text combined billing)
    "gpt-4o-realtime-preview": ModelPrice(
        input_per_1k_usd=0.005,
        output_per_1k_usd=0.020,
        audio_input_per_min_usd=0.10,
        audio_output_per_min_usd=0.20,
    ),
    "gpt-4o-realtime-preview-2024-12-17": ModelPrice(
        input_per_1k_usd=0.005,
        output_per_1k_usd=0.020,
        audio_input_per_min_usd=0.10,
        audio_output_per_min_usd=0.20,
    ),
    "gpt-4o-mini-realtime-preview": ModelPrice(
        input_per_1k_usd=0.0006,
        output_per_1k_usd=0.0024,
        audio_input_per_min_usd=0.01,
        audio_output_per_min_usd=0.02,
    ),
    # Embeddings
    "text-embedding-3-small": ModelPrice(input_per_1k_usd=0.00002),
    "text-embedding-3-large": ModelPrice(input_per_1k_usd=0.00013),
    # Whisper transcription billed per-minute on input side
    "whisper-1": ModelPrice(audio_input_per_min_usd=0.006),
}

_FALLBACK = ModelPrice(input_per_1k_usd=0.005, output_per_1k_usd=0.015)


def resolve_price(model: Optional[str]) -> ModelPrice:
    if not model:
        return _FALLBACK
    if model in PRICING:
        return PRICING[model]
    # Best-effort prefix match (e.g., "gpt-4o-2024-..." → "gpt-4o")
    for key, price in PRICING.items():
        if model.startswith(key):
            return price
    return _FALLBACK


def estimate_cost_micro_usd(
    model: Optional[str],
    *,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    audio_input_seconds: int = 0,
    audio_output_seconds: int = 0,
) -> int:
    """Return cost in micro-dollars (USD * 1_000_000)."""
    p = resolve_price(model)
    cost_usd = (
        (prompt_tokens / 1000.0) * p.input_per_1k_usd
        + (completion_tokens / 1000.0) * p.output_per_1k_usd
        + (audio_input_seconds / 60.0) * p.audio_input_per_min_usd
        + (audio_output_seconds / 60.0) * p.audio_output_per_min_usd
    )
    return int(round(cost_usd * 1_000_000))
