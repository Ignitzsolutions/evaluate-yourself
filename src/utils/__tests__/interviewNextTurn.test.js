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

  it("fails visibly when the planner route is unavailable", async () => {
    const calls = [];
    const authFetch = jest.fn(async (url) => {
      calls.push(url);
      return { ok: false, status: 404, json: async () => ({}) };
    });

    await expect(
      requestNextInterviewTurn({
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
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(calls[0]).toContain("/next-turn");
    expect(calls).toHaveLength(1);
  });
});
