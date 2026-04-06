export function shouldAcceptBrowserSpeechResult({
  text,
  aiSpeaking = false,
  msSinceAiAudioStopped = Number.POSITIVE_INFINITY,
  msSinceUserSpeechSignal = Number.POSITIVE_INFINITY,
  userSpeechSignalAfterLastAiAudio = true,
  looksLikeAssistantEcho = false,
  aiAudioCooldownMs = 1600,
  userSpeechWindowMs = 5000,
}) {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) {
    return { accept: false, reason: "empty_browser_speech" };
  }
  if (looksLikeAssistantEcho) {
    return { accept: false, reason: "echo_of_ai_discarded" };
  }
  if (aiSpeaking) {
    return { accept: false, reason: "browser_speech_during_ai_audio" };
  }
  if (Number.isFinite(msSinceAiAudioStopped) && msSinceAiAudioStopped < aiAudioCooldownMs) {
    return { accept: false, reason: "browser_speech_after_ai_audio_cooldown" };
  }
  if (!userSpeechSignalAfterLastAiAudio) {
    return { accept: false, reason: "browser_speech_without_fresh_user_signal" };
  }
  if (!Number.isFinite(msSinceUserSpeechSignal) || msSinceUserSpeechSignal > userSpeechWindowMs) {
    return { accept: false, reason: "browser_speech_without_user_signal" };
  }
  return { accept: true, reason: "accepted" };
}
