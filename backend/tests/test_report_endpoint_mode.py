from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from backend import app as app_module
from backend.models.interview import CreateInterviewReportRequest, ScoreBreakdown, TranscriptMessage


@pytest.mark.asyncio
async def test_create_report_endpoint_disabled_returns_410(monkeypatch):
    monkeypatch.setattr(app_module, "EVAL_REPORT_POST_ENDPOINT_MODE", "disabled")
    req = CreateInterviewReportRequest(
        session_id="session_1",
        title="Test report",
        type="Mixed",
        mode="Voice-Only Realtime",
        duration="5 minutes",
        overall_score=80,
        scores=ScoreBreakdown(
            communication=80,
            clarity=80,
            structure=80,
            technical_depth=80,
            relevance=80,
        ),
        transcript=[
            TranscriptMessage(
                speaker="user",
                text="I reduced latency by 20 percent",
                timestamp=datetime.now(timezone.utc),
            )
        ],
        recommendations=["Good structure"],
        questions=1,
    )

    with pytest.raises(HTTPException) as exc:
        await app_module.create_interview_report(request=req, authorization=None, db=None)

    assert exc.value.status_code == 410
