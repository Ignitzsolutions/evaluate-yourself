from services.llm.chains.candidate_feedback import generate_candidate_feedback
from services.llm.chains.candidate_feedback import _generate_fallback_feedback


def test_feedback_falls_back_when_no_llm_provider_is_configured(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_REALTIME_API_KEY", raising=False)

    feedback = generate_candidate_feedback(
        transcript=[{"speaker": "user", "text": "I improved an API and reduced p95 latency."}],
        scores={
            "overall_score": 72,
            "communication": 70,
            "clarity": 68,
            "structure": 75,
            "relevance": 74,
        },
        interview_type="mixed",
        duration_minutes=10,
        use_structured_output=False,
    )

    assert isinstance(feedback, dict)
    assert feedback.get("overall_summary")
    assert isinstance(feedback.get("strengths"), list)


def test_feedback_fallback_contract_has_minimum_actionable_items():
    feedback = _generate_fallback_feedback(
        {"overall_score": 55},
        transcript_str="CANDIDATE: I improved API latency by 20%.\nCANDIDATE: I need better STAR structure.",
    )
    assert isinstance(feedback, dict)
    assert len(feedback.get("strengths", [])) >= 3
    assert len(feedback.get("areas_for_improvement", [])) >= 3
    assert len(feedback.get("tips_for_next_interview", [])) >= 3
    assert "Evidence:" in feedback["strengths"][0]
