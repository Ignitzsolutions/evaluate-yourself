export const ASSISTANT_ROLES = new Set(["assistant", "ai", "interviewer", "sonia"]);
export const USER_ROLES = new Set(["user", "candidate"]);

const pushText = (bucket, value) => {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed) bucket.push(trimmed);
};

const readContentArray = (bucket, arr) => {
  if (!Array.isArray(arr)) return;
  arr.forEach((c) => {
    if (!c) return;
    if (typeof c === "string") {
      pushText(bucket, c);
      return;
    }
    pushText(bucket, c.text);
    pushText(bucket, c.transcript);
    pushText(bucket, c.content);
    if (c.input_audio_transcription) {
      pushText(bucket, c.input_audio_transcription.text);
      pushText(bucket, c.input_audio_transcription.transcript);
    }
    if (Array.isArray(c.parts)) {
      c.parts.forEach((p) => {
        if (typeof p === "string") pushText(bucket, p);
        else if (p) {
          pushText(bucket, p.text);
          pushText(bucket, p.transcript);
        }
      });
    }
  });
};

export function extractTranscriptText(payload) {
  if (!payload) return "";
  const texts = [];

  pushText(texts, payload.text);
  pushText(texts, payload.transcript);
  pushText(texts, payload.content_text);
  pushText(texts, payload.user_transcript);

  if (payload.input_audio_transcription) {
    pushText(texts, payload.input_audio_transcription.text);
    pushText(texts, payload.input_audio_transcription.transcript);
  }
  readContentArray(texts, payload.content);

  if (payload.item) {
    pushText(texts, payload.item.text);
    pushText(texts, payload.item.transcript);
    pushText(texts, payload.item.content_text);
    if (payload.item.input_audio_transcription) {
      pushText(texts, payload.item.input_audio_transcription.text);
      pushText(texts, payload.item.input_audio_transcription.transcript);
    }
    readContentArray(texts, payload.item.content);
  }

  return texts.join(" ").trim();
}

export function classifyConversationItem({ msg }) {
  const item = msg?.item || msg || {};
  const msgType = String(msg?.type || "").toLowerCase();
  const role = String(item.role || item?.metadata?.role || item?.author?.role || "").toLowerCase();
  const prevId = msg?.previous_item_id || item?.previous_item_id || null;
  const itemId =
    item?.id ||
    item?.item_id ||
    item?.itemId ||
    msg?.item_id ||
    msg?.itemId ||
    msg?.conversation_item_id ||
    msg?.conversationItemId ||
    null;

  const text = extractTranscriptText(msg);
  const eventSuggestsUser = (
    msgType.includes("input_audio_transcription") ||
    msgType.includes("input_audio_buffer.transcription")
  );
  const hasUserAudioContent = Array.isArray(item?.content) && item.content.some((c) => (
    c?.type === "input_audio" ||
    c?.type === "input_text" ||
    Boolean(c?.input_audio_transcription)
  ));

  const isAssistantReply = ASSISTANT_ROLES.has(role);
  const isUserRole = USER_ROLES.has(role);
  const isUserReply = !isAssistantReply && (isUserRole || hasUserAudioContent || eventSuggestsUser);

  let dropReason = "";
  if (!text) dropReason = "empty_text";
  else if (isAssistantReply) dropReason = "assistant_role";
  else if (!isUserReply) dropReason = "unclassified_role";

  return {
    text,
    role,
    itemId,
    prevId,
    isUserReply,
    isAssistantReply,
    eventSuggestsUser,
    hasUserAudioContent,
    dropReason,
  };
}
