from backend.services.clerk_auth_config import (
    build_clerk_auth_summary,
    resolve_clerk_auth_config,
    validate_clerk_auth_config,
)


import pytest


def test_validate_clerk_auth_config_rejects_test_keys_in_production():
    config = resolve_clerk_auth_config(
        {
            "ENV": "production",
            "CLERK_PUBLISHABLE_KEY": "pk_test_example",
            "CLERK_SECRET_KEY": "sk_test_example",
        }
    )

    with pytest.raises(RuntimeError, match="live keys"):
        validate_clerk_auth_config(config)
    assert config.uses_test_instance is True


def test_validate_clerk_auth_config_rejects_mismatched_key_modes():
    config = resolve_clerk_auth_config(
        {
            "ENV": "production",
            "CLERK_PUBLISHABLE_KEY": "pk_live_example",
            "CLERK_SECRET_KEY": "sk_test_example",
        }
    )

    try:
        validate_clerk_auth_config(config)
        assert False, "Expected RuntimeError for mismatched Clerk key families"
    except RuntimeError as exc:
        assert "same Clerk instance mode" in str(exc)


def test_validate_clerk_auth_config_accepts_matching_live_keys_in_production():
    config = resolve_clerk_auth_config(
        {
            "ENV": "production",
            "CLERK_PUBLISHABLE_KEY": "pk_live_example",
            "CLERK_SECRET_KEY": "sk_live_example",
        }
    )

    validate_clerk_auth_config(config)
    assert config.uses_test_instance is False


def test_build_clerk_auth_summary_reports_key_modes():
    config = resolve_clerk_auth_config(
        {
            "NODE_ENV": "production",
            "CLERK_PUBLISHABLE_KEY": "pk_live_example",
            "CLERK_SECRET_KEY": "sk_live_example",
            "CLERK_JWKS_URL": "https://example.clerk.accounts.dev/.well-known/jwks.json",
        }
    )

    summary = build_clerk_auth_summary(config)

    assert "environment=production" in summary
    assert "publishable=live" in summary
    assert "secret=live" in summary
    assert "jwks=set" in summary
