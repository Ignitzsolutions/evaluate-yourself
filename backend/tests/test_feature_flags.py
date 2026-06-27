"""Feature flag helpers behave as expected with env overrides."""

import importlib


def _reload_module():
    from backend.services import feature_flags
    return importlib.reload(feature_flags)


def test_defaults_enabled(monkeypatch):
    for k in ("ADMIN_LIVE_OPS_ENABLED", "AUTH_MFA_ENABLED", "AUTH_LOCKOUT_ENABLED", "USAGE_RECORDING_ENABLED"):
        monkeypatch.delenv(k, raising=False)
    ff = _reload_module()
    assert ff.admin_live_ops_enabled() is True
    assert ff.auth_mfa_enabled() is True
    assert ff.auth_lockout_enabled() is True
    assert ff.usage_recording_enabled() is True


def test_off_with_zero(monkeypatch):
    monkeypatch.setenv("AUTH_MFA_ENABLED", "0")
    monkeypatch.setenv("ADMIN_LIVE_OPS_ENABLED", "false")
    ff = _reload_module()
    assert ff.auth_mfa_enabled() is False
    assert ff.admin_live_ops_enabled() is False


def test_yes_on_enabled_variants(monkeypatch):
    for value in ("yes", "on", "ENABLED", "True"):
        monkeypatch.setenv("AUTH_LOCKOUT_ENABLED", value)
        ff = _reload_module()
        assert ff.auth_lockout_enabled() is True
