import { buildApiErrorFromResponse } from "./apiClient";

const normalizeText = (value) => String(value || "").trim();

export function normalizeNextTurnDecision(data = {}) {
  const nextQuestion =
    normalizeText(data.next_question) ||
    normalizeText(data.nextQuestion) ||
    normalizeText(data.question) ||
    normalizeText(data.next_turn?.question) ||
    normalizeText(data.decision?.next_question) ||
    "";

  const recoverableError =
    data.recoverable_error ||
    data.recoverableError ||
    data.error ||
    null;

  const interruptPolicy =
    data.interrupt_policy ||
    data.interruptPolicy ||
    (data.policy_action ? { action: data.policy_action } : null) ||
    null;

  return {
    next_question: nextQuestion,
    question_id: data.question_id || data.questionId || null,
    agent_owner: data.agent_owner || data.agentOwner || data.agent || data.owner || null,
    filler_hint: data.filler_hint || data.fillerHint || data.speaker_strategy?.filler_hint || null,
    recoverable_error: recoverableError,
    interrupt_policy: interruptPolicy,
    policy_action: data.policy_action || data.policyAction || null,
    refusal_message: data.refusal_message || data.refusalMessage || null,
    turn_scores: data.turn_scores || data.turnScores || null,
    raw: data,
  };
}

async function postJson(authFetch, url, token, payload) {
  return authFetch(url, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function requestNextInterviewTurn({
  authFetch,
  baseUrl,
  token,
  sessionId,
  payload,
  buildError = buildApiErrorFromResponse,
}) {
  const nextTurnUrl = `${baseUrl}/api/interview/${sessionId}/next-turn`;
  const adaptiveTurnUrl = `${baseUrl}/api/interview/${sessionId}/adaptive-turn`;

  const tryRequest = async (url) => {
    const resp = await postJson(authFetch, url, token, payload);
    if (!resp.ok) {
      const error = await buildError(resp, { defaultMessage: "Failed to plan next interview turn." });
      error.status = resp.status;
      throw error;
    }
    const data = await resp.json();
    return normalizeNextTurnDecision(data);
  };

  try {
    return await tryRequest(nextTurnUrl);
  } catch (err) {
    const status = Number(err?.status || err?.response?.status || 0);
    const message = String(err?.message || "");
    const maybeMissingRoute = status === 404 || status === 405 || /not found/i.test(message);
    if (!maybeMissingRoute) {
      throw err;
    }
  }

  const fallbackResponse = await postJson(authFetch, adaptiveTurnUrl, token, payload);
  if (!fallbackResponse.ok) {
    const error = await buildError(fallbackResponse, { defaultMessage: "Failed to plan next interview turn." });
    error.status = fallbackResponse.status;
    throw error;
  }
  return normalizeNextTurnDecision(await fallbackResponse.json());
}

