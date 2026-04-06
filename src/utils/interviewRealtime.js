export function buildRealtimeSessionUpdateEvent({
  voice,
  transcriptionModel,
  interviewServerControlEnabled,
}) {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      audio: {
        input: {
          turn_detection: {
            type: "server_vad",
            threshold: 0.55,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: !interviewServerControlEnabled,
            interrupt_response: true,
          },
          transcription: {
            model: transcriptionModel,
            language: "en",
          },
        },
        output: {
          voice,
        },
      },
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
