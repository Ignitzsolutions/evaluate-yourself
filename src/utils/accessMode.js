const VALID_ACCESS_MODES = new Set(["free", "trial"]);
export const INTERVIEW_CONFIG_STORAGE_KEY = "interviewConfig";
const VALID_INTERVIEW_TYPES = new Set(["behavioral", "technical", "mixed"]);
const INTERVIEW_TYPES_REQUIRING_SKILLS = new Set(["technical", "mixed"]);
const DEFAULT_DURATION = 10;
const VALID_DURATIONS = new Set([10, 15, 20, 30, 45, 60]);
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const VALID_QUESTION_MIX = new Set(["technical", "balanced", "behavioral"]);
const VALID_INTERVIEW_STYLES = new Set(["friendly", "neutral", "strict"]);

export function getInterviewAccessMode() {
  const raw = String(process.env.REACT_APP_INTERVIEW_ACCESS_MODE || "free").trim().toLowerCase();
  return VALID_ACCESS_MODES.has(raw) ? raw : "free";
}

export function isInterviewFreeAccessMode() {
  return getInterviewAccessMode() === "free";
}

function normalizeString(value) {
  const next = String(value || "").trim();
  return next || undefined;
}

function normalizeSelectedSkills(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeString(entry))
    .filter(Boolean);
}

export function buildInterviewConfig(input = {}) {
  const type = VALID_INTERVIEW_TYPES.has(String(input.type || "").trim().toLowerCase())
    ? String(input.type).trim().toLowerCase()
    : "technical";
  const rawDuration = Number(input.duration);
  const duration = VALID_DURATIONS.has(rawDuration) ? rawDuration : DEFAULT_DURATION;
  const difficulty = VALID_DIFFICULTIES.has(String(input.difficulty || "").trim().toLowerCase())
    ? String(input.difficulty).trim().toLowerCase()
    : "easy";
  const questionMix = VALID_QUESTION_MIX.has(String(input.questionMix || "").trim().toLowerCase())
    ? String(input.questionMix).trim().toLowerCase()
    : "balanced";
  const interviewStyle = VALID_INTERVIEW_STYLES.has(String(input.interviewStyle || "").trim().toLowerCase())
    ? String(input.interviewStyle).trim().toLowerCase()
    : "neutral";
  const selectedSkills = normalizeSelectedSkills(input.selectedSkills);
  const accessMode = VALID_ACCESS_MODES.has(String(input.accessMode || "").trim().toLowerCase())
    ? String(input.accessMode).trim().toLowerCase()
    : getInterviewAccessMode();

  return {
    type,
    duration,
    difficulty,
    role: normalizeString(input.role),
    company: normalizeString(input.company),
    questionMix,
    interviewStyle,
    transcriptConsent: Boolean(input.transcriptConsent),
    selectedSkills,
    accessMode,
    trialMode: accessMode === "trial",
  };
}

export function validateInterviewConfig(config) {
  if (!config || typeof config !== "object") {
    return { valid: false, reason: "missing_setup" };
  }

  const normalized = buildInterviewConfig(config);
  if (!Boolean(config.transcriptConsent)) {
    return { valid: false, reason: "missing_consent", config: normalized };
  }
  if (!VALID_INTERVIEW_TYPES.has(normalized.type)) {
    return { valid: false, reason: "invalid_type", config: normalized };
  }
  if (INTERVIEW_TYPES_REQUIRING_SKILLS.has(normalized.type) && !Array.isArray(config.selectedSkills)) {
    return { valid: false, reason: "invalid_skill_selection", config: normalized };
  }
  return { valid: true, config: normalized };
}

export function readSavedInterviewConfig(storage = typeof window !== "undefined" ? window.sessionStorage : null) {
  if (!storage) {
    return { valid: false, reason: "storage_unavailable" };
  }
  const raw = storage.getItem(INTERVIEW_CONFIG_STORAGE_KEY);
  if (!raw) {
    return { valid: false, reason: "missing_setup" };
  }
  try {
    return validateInterviewConfig(JSON.parse(raw));
  } catch {
    return { valid: false, reason: "invalid_json" };
  }
}

export function saveInterviewConfig(config, storage = typeof window !== "undefined" ? window.sessionStorage : null) {
  if (!storage) return null;
  const normalized = buildInterviewConfig(config);
  storage.setItem(INTERVIEW_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
