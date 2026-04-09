const normalizeSpeaker = (speaker) => String(speaker || "").trim().toLowerCase();

const countWords = (text) => String(text || "").trim().split(/\s+/).filter(Boolean).length;

const pairMessages = (messages = []) => {
  const pairs = [];
  let pendingQuestion = null;

  messages.forEach((message) => {
    if (!message || !message.text || !String(message.text).trim()) {
      return;
    }
    if (normalizeSpeaker(message.speaker) === "ai") {
      pendingQuestion = {
        text: message.text,
        timestamp: message.timestamp,
      };
      return;
    }

    if (!pendingQuestion) {
      return;
    }

    pairs.push({
      question: pendingQuestion.text,
      answer: message.text,
      timestamp: message.timestamp,
    });
    pendingQuestion = null;
  });

  return pairs;
};

export function buildCanonicalTranscriptPayloadFromMessages({
  aiMessages = [],
  userMessages = [],
  pendingUserMessages = [],
} = {}) {
  const raw_messages = [...aiMessages, ...userMessages, ...pendingUserMessages]
    .filter((m) => m && String(m.text || "").trim().length > 0)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const trusted_raw_messages = raw_messages.filter((message) => message.trusted_for_evaluation !== false);
  const fallback_raw_messages = raw_messages.filter((message) => message.trusted_for_evaluation === false);

  const qa_pairs = pairMessages(raw_messages);
  const trusted_qa_pairs = pairMessages(trusted_raw_messages);
  const unpaired = [];
  let pendingQuestion = null;

  raw_messages.forEach((message) => {
    const speaker = normalizeSpeaker(message.speaker);
    if (speaker === "ai") {
      if (pendingQuestion) {
        unpaired.push({
          type: "unanswered_question",
          text: pendingQuestion.text,
          timestamp: pendingQuestion.timestamp,
        });
      }
      pendingQuestion = {
        text: message.text,
        timestamp: message.timestamp,
      };
      return;
    }

    if (speaker === "user") {
      if (pendingQuestion) {
        pendingQuestion = null;
      } else {
        unpaired.push({
          type: "answer_without_question",
          text: message.text,
          timestamp: message.timestamp,
          speaker: "user",
        });
      }
    }
  });

  if (pendingQuestion) {
    unpaired.push({
      type: "unanswered_question",
      text: pendingQuestion.text,
      timestamp: pendingQuestion.timestamp,
    });
  }

  let mode = "structured";
  if (qa_pairs.length === 0 && raw_messages.length > 0) {
    mode = "raw";
  } else if (unpaired.length > 0) {
    mode = "hybrid";
  }

  const trustedCandidateMessages = trusted_raw_messages.filter((message) => normalizeSpeaker(message.speaker) === "user");
  const fallbackCandidateMessages = fallback_raw_messages.filter((message) => normalizeSpeaker(message.speaker) === "user");

  return {
    mode,
    qa_pairs,
    trusted_qa_pairs,
    unpaired,
    raw_messages,
    trusted_raw_messages,
    fallback_raw_messages,
    capture_integrity: {
      trusted_candidate_turn_count: trustedCandidateMessages.length,
      fallback_candidate_turn_count: fallbackCandidateMessages.length,
      trusted_candidate_word_count: trustedCandidateMessages.reduce((sum, message) => sum + countWords(message.text), 0),
      fallback_candidate_word_count: fallbackCandidateMessages.reduce((sum, message) => sum + countWords(message.text), 0),
      contains_fallback_candidate_transcript: fallbackCandidateMessages.length > 0,
    },
  };
}

export function annotateCaptureEntry({
  speaker,
  text,
  timestamp,
  evidenceSource,
  trustedForEvaluation,
  transcriptOrigin,
}) {
  return {
    speaker,
    text,
    timestamp: timestamp || new Date().toISOString(),
    evidence_source: evidenceSource,
    trusted_for_evaluation: trustedForEvaluation,
    transcript_origin: transcriptOrigin || null,
  };
}

