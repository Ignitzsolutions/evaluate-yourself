import { annotateCaptureEntry, buildCanonicalTranscriptPayloadFromMessages } from "../trustedCaptureBuffer";

describe("trustedCaptureBuffer", () => {
  it("keeps fallback transcript separate from trusted transcript evidence", () => {
    const payload = buildCanonicalTranscriptPayloadFromMessages({
      aiMessages: [
        annotateCaptureEntry({
          speaker: "ai",
          text: "Tell me about your last project.",
          timestamp: "2026-04-08T00:00:00.000Z",
          evidenceSource: "realtime_output_audio_transcript",
          trustedForEvaluation: true,
          transcriptOrigin: "server_audio_transcript",
        }),
      ],
      userMessages: [
        annotateCaptureEntry({
          speaker: "user",
          text: "I shipped a caching layer.",
          timestamp: "2026-04-08T00:00:05.000Z",
          evidenceSource: "realtime_input_transcription",
          trustedForEvaluation: true,
          transcriptOrigin: "server_input_transcription",
        }),
        annotateCaptureEntry({
          speaker: "user",
          text: "Fallback only answer.",
          timestamp: "2026-04-08T00:00:06.000Z",
          evidenceSource: "browser_speech_fallback",
          trustedForEvaluation: false,
          transcriptOrigin: "browser_speech_fallback",
        }),
      ],
    });

    expect(payload.qa_pairs).toHaveLength(1);
    expect(payload.trusted_qa_pairs).toHaveLength(1);
    expect(payload.capture_integrity.trusted_candidate_turn_count).toBe(1);
    expect(payload.capture_integrity.fallback_candidate_turn_count).toBe(1);
    expect(payload.capture_integrity.contains_fallback_candidate_transcript).toBe(true);
  });
});
