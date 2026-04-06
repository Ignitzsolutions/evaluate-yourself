import uuid

import pytest
from fastapi.testclient import TestClient


try:
    from backend import app as app_module
except ImportError:  # pragma: no cover
    import app as app_module


@pytest.fixture
def client():
    return TestClient(app_module.app)


def test_pdf_download_uses_premium_renderer(monkeypatch, client):
    report_id = str(uuid.uuid4())

    async def fake_get_interview_report(_report_id, authorization=None, db=None):
        return {
            "id": report_id,
            "session_id": f"session-{report_id}",
            "title": "Premium Report",
            "type": "behavioral",
            "mode": "live",
            "duration": "10 minutes",
            "overall_score": 82,
            "metrics": {
                "capture_status": "COMPLETE",
                "score_provenance": {"source": "server_deterministic_rubric", "confidence": "high"},
            },
            "validation_summary": {"validity_score": 88, "validity_label": "high"},
            "transcript": [{"speaker": "user", "text": "I led the migration."}],
        }

    monkeypatch.setattr(app_module, "get_interview_report", fake_get_interview_report)
    monkeypatch.setattr(app_module, "render_interview_report_pdf_bytes", lambda report: b"%PDF-premium-valid")

    response = client.get(f"/api/interview/reports/{report_id}/download?format=pdf")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert f'interview-report-{report_id}.pdf' in response.headers["content-disposition"]
    assert response.content == b"%PDF-premium-valid"


def test_pdf_download_handles_invalid_no_audio_report(monkeypatch, client):
    report_id = str(uuid.uuid4())
    captured = {}

    async def fake_get_interview_report(_report_id, authorization=None, db=None):
        return {
            "id": report_id,
            "session_id": f"session-{report_id}",
            "title": "Invalid Session Report",
            "type": "mixed",
            "mode": "live",
            "duration": "1 minute",
            "overall_score": 0,
            "metrics": {
                "capture_status": "INCOMPLETE_NO_CANDIDATE_AUDIO",
                "score_provenance": {"source": "none_no_candidate_audio", "confidence": "low"},
            },
            "validation_summary": {"validity_score": 8, "validity_label": "low"},
            "transcript": [{"speaker": "ai", "text": "Tell me about yourself"}],
        }

    def fake_render(report):
        captured["report_state"] = report.get("report_state")
        return b"%PDF-premium-invalid"

    monkeypatch.setattr(app_module, "get_interview_report", fake_get_interview_report)
    monkeypatch.setattr(app_module, "render_interview_report_pdf_bytes", fake_render)

    response = client.get(f"/api/interview/reports/{report_id}/download?format=pdf")

    assert response.status_code == 200
    assert response.content == b"%PDF-premium-invalid"
    assert captured["report_state"] == "invalid_no_candidate_audio_report"


def test_html_artifact_uses_printable_renderer(monkeypatch, client):
    report_id = str(uuid.uuid4())

    async def fake_get_interview_report(_report_id, authorization=None, db=None):
        return {
            "id": report_id,
            "session_id": f"session-{report_id}",
            "title": "Launch Report",
            "type": "behavioral",
            "mode": "live",
            "duration": "5 minutes",
            "overall_score": 70,
            "metrics": {
                "capture_status": "COMPLETE",
                "plan_tier": "trial",
                "trial_mode": True,
                "score_provenance": {"source": "server_deterministic_rubric", "confidence": "high"},
            },
            "validation_summary": {"validity_score": 80, "validity_label": "high"},
            "transcript": [{"speaker": "user", "text": "I owned the migration."}],
        }

    monkeypatch.setattr(app_module, "get_interview_report", fake_get_interview_report)

    response = client.get(f"/api/interview/reports/{report_id}/artifact?format=html")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Trial Interview Report" in response.text
    assert "Save as PDF" in response.text
