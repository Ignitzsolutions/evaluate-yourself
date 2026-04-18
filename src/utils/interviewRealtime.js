export function buildRealtimeSessionUpdateEvent({
  voice,
  transcriptionModel,
  interviewServerControlEnabled,
}) {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      voice,
      input_audio_format: "pcm16",
      output_modalities: ["audio"],
      turn_detection: {
        type: "server_vad",
        threshold: 0.55,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
        create_response: !interviewServerControlEnabled,
        interrupt_response: true,
      },
      input_audio_transcription: {
        model: transcriptionModel,
        language: "en",
      },
    },
  };
}

export function buildRealtimeResponseCreateEvent({ instructions }) {
  return {
    type: "response.create",
    response: {
      conversation: "auto",
      output_modalities: ["audio"],
      instructions,
    },
  };
}

export function canSendOpeningPrompt({
  channelState,
  sessionConfigured,
  openingQuestion,
  openingAlreadySent,
}) {
  return (
    channelState === "open" &&
    Boolean(sessionConfigured) &&
    !openingAlreadySent &&
    Boolean(String(openingQuestion || "").trim())
  );
}

export function buildAdaptiveTurnFallbackQuestion({
  interviewType,
  role,
  company,
  questionMix,
}) {
  const normalizedType = String(interviewType || "mixed").trim().toLowerCase();
  const normalizedMix = String(questionMix || "balanced").trim().toLowerCase();
  const roleHint = String(role || "").trim();
  const companyHint = String(company || "").trim();
  const contextParts = [];

  if (roleHint) {
    contextParts.push(`for a ${roleHint} role`);
  }
  if (companyHint) {
    contextParts.push(`at ${companyHint}`);
  }

  const contextSuffix = contextParts.length ? ` ${contextParts.join(" ")}` : "";

  if (normalizedType === "behavioral" || normalizedMix === "behavioral") {
    return `Tell me about a recent challenge${contextSuffix} and the concrete steps you took to handle it.`;
  }

  if (normalizedType === "technical" || normalizedMix === "technical") {
    return `Walk me through a recent technical problem${contextSuffix}, including your approach, tradeoffs, and outcome.`;
  }

  return `Tell me about a recent project${contextSuffix} and the most important decision you made during it.`;
}
