import { normalizeNextTurnDecision, requestNextInterviewTurn } from "../interviewNextTurn";

describe("normalizeNextTurnDecision", () => {
  it("normalizes snake_case and camelCase planner responses", () => {
    const decision = normalizeNextTurnDecision({
      nextQuestion: "Walk me through the tradeoffs.",
      questionId: "q_1",
      agentOwner: "technical_lead",
      fillerHint: "thinking",
      recoverableError: { message: "Temporary fallback" },
      interruptPolicy: { allowBargeIn: true },
    });

    expect(decision.next_question).toBe("Walk me through the tradeoffs.");
    expect(decision.question_id).toBe("q_1");
    expect(decision.agent_owner).toBe("technical_lead");
    expect(decision.filler_hint).toBe("thinking");
    expect(decision.recoverable_error).toEqual({ message: "Temporary fallback" });
    expect(decision.interrupt_policy).toEqual({ allowBargeIn: true });
  });

  it("falls back to adaptive-turn when the new endpoint is unavailable", async () => {
    const calls = [];
    const authFetch = jest.fn(async (url) => {
      calls.push(url);
      if (url.includes("/next-turn")) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ next_question: "Tell me about the tradeoff." }),
      };
    });

    const decision = await requestNextInterviewTurn({
      authFetch,
      baseUrl: "https://example.com",
      token: "token",
      sessionId: "session-1",
      payload: { last_user_turn: "I can explain it." },
      buildError: async (resp) => {
        const error = new Error(`HTTP ${resp.status}`);
        error.status = resp.status;
        return error;
      },
    });

    expect(calls[0]).toContain("/next-turn");
    expect(calls[1]).toContain("/adaptive-turn");
    expect(decision.next_question).toBe("Tell me about the tradeoff.");
  });
});
