import {
  buildAdaptiveTurnFallbackQuestion,
  buildRealtimeSessionUpdateEvent,
  canSendOpeningPrompt,
} from "../interviewRealtime";

describe("buildRealtimeSessionUpdateEvent", () => {
  it("uses the canonical realtime session schema", () => {
    const event = buildRealtimeSessionUpdateEvent({
      voice: "alloy",
      transcriptionModel: "whisper",
      interviewServerControlEnabled: true,
    });

    expect(event).toEqual({
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
              create_response: false,
              interrupt_response: true,
            },
            transcription: {
              model: "whisper",
              language: "en",
            },
          },
          output: {
            voice: "alloy",
          },
        },
      },
    });
  });

  it("enables automatic response creation only when server control is off", () => {
    const event = buildRealtimeSessionUpdateEvent({
      voice: "nova",
      transcriptionModel: "gpt-4o-mini-transcribe",
      interviewServerControlEnabled: false,
    });

    expect(event.session.audio.input.turn_detection.create_response).toBe(true);
    expect(event.session.audio.output.voice).toBe("nova");
    expect(event.session.audio.input.transcription.model).toBe("gpt-4o-mini-transcribe");
  });
});

describe("canSendOpeningPrompt", () => {
  it("requires an open channel, configured session, and an unsent opening question", () => {
    expect(
      canSendOpeningPrompt({
        channelState: "open",
        sessionConfigured: true,
        openingQuestion: "Tell me about a time you shipped safely.",
        openingAlreadySent: false,
      }),
    ).toBe(true);
  });

  it("blocks duplicate or premature opening sends", () => {
    expect(
      canSendOpeningPrompt({
        channelState: "connecting",
        sessionConfigured: true,
        openingQuestion: "Question",
        openingAlreadySent: false,
      }),
    ).toBe(false);

    expect(
      canSendOpeningPrompt({
        channelState: "open",
        sessionConfigured: false,
        openingQuestion: "Question",
        openingAlreadySent: false,
      }),
    ).toBe(false);

    expect(
      canSendOpeningPrompt({
        channelState: "open",
        sessionConfigured: true,
        openingQuestion: "Question",
        openingAlreadySent: true,
      }),
    ).toBe(false);
  });
});

describe("buildAdaptiveTurnFallbackQuestion", () => {
  it("builds a behavioral-safe recovery prompt when the interview is behavioral", () => {
    expect(
      buildAdaptiveTurnFallbackQuestion({
        interviewType: "behavioral",
        role: "Engineering Manager",
        company: "OpenAI",
      }),
    ).toMatch(/recent challenge/i);
  });

  it("builds a technical-safe recovery prompt when the interview is technical", () => {
    expect(
      buildAdaptiveTurnFallbackQuestion({
        interviewType: "technical",
        role: "Backend Engineer",
        company: "OpenAI",
      }),
    ).toMatch(/recent technical problem/i);
  });

  it("falls back to a mixed project prompt when no specific family is forced", () => {
    expect(
      buildAdaptiveTurnFallbackQuestion({
        interviewType: "mixed",
        questionMix: "balanced",
      }),
    ).toMatch(/recent project/i);
  });
});
