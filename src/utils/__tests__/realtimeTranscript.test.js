import { classifyConversationItem, extractTranscriptText } from "../realtimeTranscript";

describe("realtimeTranscript helpers", () => {
  it("extracts transcript text from nested realtime payloads", () => {
    const payload = {
      item: {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio_transcription: {
              text: "I improved query latency by 40 percent",
            },
          },
        ],
      },
    };

    expect(extractTranscriptText(payload)).toContain("improved query latency");
  });

  it("does not classify assistant items as user turns", () => {
    const parsed = classifyConversationItem({
      msg: {
        item: {
          id: "item_1",
          role: "assistant",
          content: [{ type: "output_text", text: "Please continue in English." }],
        },
      },
      lastAIItemId: null,
      lastCommittedInputItemId: null,
    });

    expect(parsed.isAssistantReply).toBe(true);
    expect(parsed.isUserReply).toBe(false);
    expect(parsed.dropReason).toBe("assistant_role");
  });

  it("classifies user audio content even without explicit role", () => {
    const parsed = classifyConversationItem({
      msg: {
        item: {
          id: "item_2",
          content: [{ type: "input_audio", transcript: "My approach was to cache results." }],
        },
      },
      lastAIItemId: null,
      lastCommittedInputItemId: null,
    });

    expect(parsed.isUserReply).toBe(true);
    expect(parsed.text).toContain("cache results");
  });

  it("classifies input_audio_transcription events as user turns", () => {
    const parsed = classifyConversationItem({
      msg: {
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "I reduced deployment rollbacks by adding canary checks.",
      },
    });

    expect(parsed.isUserReply).toBe(true);
    expect(parsed.isAssistantReply).toBe(false);
  });
});
