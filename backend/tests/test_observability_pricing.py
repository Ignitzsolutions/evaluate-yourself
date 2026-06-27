"""Cost estimation math for the pricing table."""

from backend.services.observability import pricing


def test_resolve_price_known_model():
    p = pricing.resolve_price("gpt-4o-mini")
    assert p.input_per_1k_usd > 0
    assert p.output_per_1k_usd > p.input_per_1k_usd


def test_resolve_price_unknown_falls_back():
    p = pricing.resolve_price("totally-made-up-model-xyz")
    # Fallback returns the conservative default.
    assert p.input_per_1k_usd > 0
    assert p.output_per_1k_usd > 0


def test_resolve_price_prefix_match():
    p_full = pricing.resolve_price("gpt-4o-2024-08-06")  # exact
    p_pref = pricing.resolve_price("gpt-4o-zzz")  # prefix match → gpt-4o
    assert p_full.input_per_1k_usd > 0
    assert p_pref.input_per_1k_usd > 0


def test_estimate_cost_chat_only():
    micro = pricing.estimate_cost_micro_usd(
        "gpt-4o-mini", prompt_tokens=1000, completion_tokens=500
    )
    p = pricing.resolve_price("gpt-4o-mini")
    expected = (1.0 * p.input_per_1k_usd + 0.5 * p.output_per_1k_usd) * 1_000_000
    assert abs(micro - int(round(expected))) <= 2


def test_estimate_cost_realtime_audio_dominates():
    micro = pricing.estimate_cost_micro_usd(
        "gpt-4o-realtime-preview",
        prompt_tokens=0,
        completion_tokens=0,
        audio_input_seconds=60,
        audio_output_seconds=60,
    )
    # 1 min in + 1 min out at realtime rates → should be at least $0.10
    assert micro >= 100_000


def test_estimate_cost_zero_inputs():
    assert pricing.estimate_cost_micro_usd("gpt-4o") == 0
