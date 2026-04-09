from backend.services.llm.provider_adapter import create_chat_completion


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content):
        self.choices = [_FakeChoice(content)]


class _FakeClient:
    def __init__(self, content=None, error=None):
        self._content = content
        self._error = error
        self.chat = self
        self.completions = self

    def create(self, **kwargs):
        if self._error:
            raise self._error
        return _FakeResponse(self._content)


def test_create_chat_completion_falls_back_to_openai_when_azure_fails(monkeypatch):
    azure = {"provider": "azure", "client": _FakeClient(error=RuntimeError("azure unavailable")), "model": "azure-model"}
    openai = {"provider": "openai", "client": _FakeClient(content="fallback answer"), "model": "gpt-4o-mini"}
    monkeypatch.setattr(
        "backend.services.llm.provider_adapter.get_chat_provider_chain",
        lambda: [azure, openai],
    )

    result = create_chat_completion(messages=[{"role": "user", "content": "hello"}], purpose="test")

    assert result["text"] == "fallback answer"
    assert result["provider_trace"]["provider"] == "openai"
    assert result["provider_trace"]["failover_used"] is True
    assert len(result["provider_trace"]["attempts"]) == 2
