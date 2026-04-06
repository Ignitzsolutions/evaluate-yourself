from backend.services.admin_auth_config import (
    build_admin_auth_summary,
    resolve_admin_auth_config,
    validate_admin_auth_config,
)


def test_resolve_admin_auth_config_treats_node_env_production_as_production():
    config = resolve_admin_auth_config(
        {
            "NODE_ENV": "production",
            "ADMIN_CLERK_USER_IDS": "user_1,user_2",
        }
    )

    assert config.is_production is True
    assert config.environment == "production"
    assert config.dev_auth_bypass is False
    assert config.admin_allow_all_local is False
    assert config.admin_clerk_user_ids == {"user_1", "user_2"}


def test_validate_admin_auth_config_rejects_missing_allowlist_in_production():
    config = resolve_admin_auth_config(
        {
            "ENV": "production",
            "DEV_AUTH_BYPASS": "false",
        }
    )

    try:
        validate_admin_auth_config(config)
        assert False, "Expected RuntimeError when production admin allowlist is missing"
    except RuntimeError as exc:
        assert "ADMIN_CLERK_USER_IDS" in str(exc)


def test_build_admin_auth_summary_reports_allowlist_mode():
    config = resolve_admin_auth_config(
        {
            "ENVIRONMENT": "development",
            "ADMIN_CLERK_USER_IDS": "admin_1,admin_2",
            "DEV_AUTH_BYPASS": "false",
        }
    )

    summary = build_admin_auth_summary(config)

    assert "allowlist" in summary
    assert "allowlist_count=2" in summary
    assert "environment=development" in summary
