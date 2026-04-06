import { shouldAcceptBrowserSpeechResult } from "../realtimeSpeechGuards";

describe("shouldAcceptBrowserSpeechResult", () => {
  it("rejects browser speech when it looks like assistant echo", () => {
    expect(
      shouldAcceptBrowserSpeechResult({
        text: "Tell me about a project you are proud of",
        looksLikeAssistantEcho: true,
        aiSpeaking: false,
        msSinceAiAudioStopped: 3000,
        msSinceUserSpeechSignal: 200,
        userSpeechSignalAfterLastAiAudio: true,
      }),
    ).toEqual({ accept: false, reason: "echo_of_ai_discarded" });
  });

  it("rejects browser speech without a fresh post-assistant user speech signal", () => {
    expect(
      shouldAcceptBrowserSpeechResult({
        text: "I led the API migration",
        looksLikeAssistantEcho: false,
        aiSpeaking: false,
        msSinceAiAudioStopped: 2500,
        msSinceUserSpeechSignal: 400,
        userSpeechSignalAfterLastAiAudio: false,
      }),
    ).toEqual({ accept: false, reason: "browser_speech_without_fresh_user_signal" });
  });

  it("accepts browser speech when assistant audio is clear and a fresh user signal exists", () => {
    expect(
      shouldAcceptBrowserSpeechResult({
        text: "I led the API migration",
        looksLikeAssistantEcho: false,
        aiSpeaking: false,
        msSinceAiAudioStopped: 2600,
        msSinceUserSpeechSignal: 200,
        userSpeechSignalAfterLastAiAudio: true,
      }),
    ).toEqual({ accept: true, reason: "accepted" });
  });
});
