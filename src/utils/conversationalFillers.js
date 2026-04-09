export const CONVERSATIONAL_FILLER_PACK_VERSION = "sonia-fillers-v1";

export const CONVERSATIONAL_FILLERS = {
  acknowledgment: [
    {
      id: "ack-1",
      text: "Hmm, that is helpful.",
      audioSrc: "/assets/sonia-fillers/acknowledgment/ack-1.m4a",
    },
    {
      id: "ack-2",
      text: "I see, let's dig into that.",
      audioSrc: "/assets/sonia-fillers/acknowledgment/ack-2.m4a",
    },
    {
      id: "ack-3",
      text: "Understood, go on.",
      audioSrc: "/assets/sonia-fillers/acknowledgment/ack-3.m4a",
    },
  ],
  thinking: [
    {
      id: "think-1",
      text: "Hmm, interesting...",
      audioSrc: "/assets/sonia-fillers/thinking/think-1.m4a",
    },
    {
      id: "think-2",
      text: "Let me think about that for a second.",
      audioSrc: "/assets/sonia-fillers/thinking/think-2.m4a",
    },
    {
      id: "think-3",
      text: "I want to make sure I ask this properly.",
      audioSrc: "/assets/sonia-fillers/thinking/think-3.m4a",
    },
  ],
  pivot: [
    {
      id: "pivot-1",
      text: "Let's shift gears for a second.",
      audioSrc: "/assets/sonia-fillers/pivot/pivot-1.m4a",
    },
    {
      id: "pivot-2",
      text: "I'll pivot slightly here.",
      audioSrc: "/assets/sonia-fillers/pivot/pivot-2.m4a",
    },
    {
      id: "pivot-3",
      text: "Let me ask this a different way.",
      audioSrc: "/assets/sonia-fillers/pivot/pivot-3.m4a",
    },
  ],
};

const normalizeKey = (value, fallback = "thinking") => {
  const key = String(value || "").trim().toLowerCase();
  if (key in CONVERSATIONAL_FILLERS) return key;
  return fallback;
};

const hashText = (text) => {
  const value = String(text || "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export function pickConversationalFiller(hint = "thinking", seed = "") {
  const key = normalizeKey(hint);
  const options = CONVERSATIONAL_FILLERS[key] || CONVERSATIONAL_FILLERS.thinking;
  if (!options.length) return "Hmm, interesting...";
  const index = options.length === 1 ? 0 : hashText(`${key}:${seed}`) % options.length;
  return options[index]?.text || "Hmm, interesting...";
}

export function pickConversationalFillerClip(hint = "thinking", seed = "") {
  const key = normalizeKey(hint);
  const options = CONVERSATIONAL_FILLERS[key] || CONVERSATIONAL_FILLERS.thinking;
  if (!options.length) {
    return {
      id: "thinking-fallback",
      hint: "thinking",
      text: "Hmm, interesting...",
      audioSrc: null,
      version: CONVERSATIONAL_FILLER_PACK_VERSION,
    };
  }
  const index = options.length === 1 ? 0 : hashText(`${key}:${seed}`) % options.length;
  const clip = options[index] || options[0];
  return {
    ...clip,
    hint: key,
    version: CONVERSATIONAL_FILLER_PACK_VERSION,
  };
}

export function listConversationalFillerClips() {
  return Object.entries(CONVERSATIONAL_FILLERS).flatMap(([hint, clips]) =>
    clips.map((clip) => ({
      ...clip,
      hint,
      version: CONVERSATIONAL_FILLER_PACK_VERSION,
    })),
  );
}

export function normalizeConversationalFillerHint(hint) {
  return normalizeKey(hint);
}
