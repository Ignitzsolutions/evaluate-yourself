import { buildApiErrorFromResponse } from "./apiClient";
import { apiUrl } from "./apiBaseUrl";

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
  const buildUrl = (path) => (baseUrl ? `${baseUrl}${path}` : apiUrl(path));
  const nextTurnUrl = buildUrl(`/api/interview/${sessionId}/next-turn`);

  const resp = await postJson(authFetch, nextTurnUrl, token, payload);
  if (!resp.ok) {
    const error = await buildError(resp, { defaultMessage: "Failed to plan next interview turn." });
    error.status = resp.status;
    throw error;
  }
  return normalizeNextTurnDecision(await resp.json());
}
