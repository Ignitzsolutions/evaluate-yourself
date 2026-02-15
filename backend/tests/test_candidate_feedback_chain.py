from services.llm.chains.candidate_feedback import generate_candidate_feedback


def test_feedback_falls_back_when_azure_chat_deployment_missing(monkeypatch):
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com")
    monkeypatch.delenv("AZURE_OPENAI_CHAT_DEPLOYMENT", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_REALTIME_API_KEY", raising=False)

    feedback = generate_candidate_feedback(
        transcript=[{"speaker": "user", "text": "I improved an API and reduced p95 latency."}],
        scores={"overall_score": 72, "communication": 70, "clarity": 68, "structure": 75, "relevance": 74},
        interview_type="mixed",
        duration_minutes=10,
        use_structured_output=False,
    )

    assert isinstance(feedback, dict)
    assert feedback.get("overall_summary")
    assert isinstance(feedback.get("strengths"), list)
