from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend import app as app_module


def test_collect_startup_diagnostics_reports_frontend_and_clerk_status(tmp_path):
    frontend_dir = tmp_path / "build"
    frontend_dir.mkdir()
    (frontend_dir / "index.html").write_text("<!doctype html>", encoding="utf-8")
    (frontend_dir / "static").mkdir()
    (frontend_dir / "assets").mkdir()
    (frontend_dir / "assets" / "logo.png").write_bytes(b"png")

    public_dir = tmp_path / "public"
    public_dir.mkdir()

    diagnostics = app_module.collect_startup_diagnostics(
        env={
            "ENV": "production",
            "DATABASE_URL": "postgresql://db.example/app",
            "REDIS_URL": "rediss://cache.example/0",
            "ALLOWED_ORIGINS": "https://example.com",
            "CLERK_PUBLISHABLE_KEY": "pk_live_example",
            "CLERK_SECRET_KEY": "sk_live_example",
        },
        frontend_dir=frontend_dir,
        public_dir=public_dir,
    )

    assert diagnostics["is_production"] is True
    assert diagnostics["missing_requirements"] == []
    assert diagnostics["clerk"]["publishable_key_present"] is True
    assert diagnostics["frontend"]["index_present"] is True
    assert diagnostics["frontend"]["assets_dir_present"] is True
    assert diagnostics["frontend"]["favicon_present"] is True
    assert diagnostics["frontend"]["favicon_path"] == str(frontend_dir / "assets" / "logo.png")


def test_validate_production_requirements_logs_missing_settings(capsys, tmp_path):
    frontend_dir = tmp_path / "build"
    public_dir = tmp_path / "public"
    frontend_dir.mkdir()
    public_dir.mkdir()

    with pytest.raises(RuntimeError, match="DATABASE_URL, REDIS_URL, ALLOWED_ORIGINS"):
        app_module.validate_production_requirements(
            env={
                "ENV": "production",
                "CLERK_PUBLISHABLE_KEY": "pk_live_example",
                "CLERK_SECRET_KEY": "sk_live_example",
            },
            frontend_dir=frontend_dir,
            public_dir=public_dir,
        )

    captured = capsys.readouterr()
    assert "Startup diagnostics" in captured.out
    assert '"database_url_present": false' in captured.out
    assert '"redis_url_present": false' in captured.out
    assert '"allowed_origins_present": false' in captured.out


def test_favicon_route_returns_repo_managed_asset():
    client = TestClient(app_module.app)

    response = client.get("/favicon.ico")

    assert response.status_code == 200
    assert response.content
