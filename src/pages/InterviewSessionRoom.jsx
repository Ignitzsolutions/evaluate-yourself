import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';
import { authFetch, buildApiErrorFromResponse, getApiErrorMessage, isBackendUnavailableError } from '../utils/apiClient';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { isDevAuthBypassEnabled } from '../utils/devAuthBypass';
import { classifyConversationItem, extractTranscriptText } from '../utils/realtimeTranscript';
import { shouldAcceptBrowserSpeechResult } from '../utils/realtimeSpeechGuards';
import { mapLiveGazeFlag } from '../utils/gazeDirection';
import {
  buildAdaptiveTurnFallbackQuestion,
  buildRealtimeSessionUpdateEvent,
  canSendOpeningPrompt,
} from '../utils/interviewRealtime';
import { requestNextInterviewTurn } from '../utils/interviewNextTurn';
import {
  annotateCaptureEntry,
  buildCanonicalTranscriptPayloadFromMessages,
} from '../utils/trustedCaptureBuffer';
import { createGazeTelemetryBatcher } from '../utils/gazeTelemetryBatch';
import useConversationalFillers from '../hooks/useConversationalFillers';
import useVAD from '../hooks/useVAD';
import {
  createSessionEndError,
  getEndErrorPresentation,
  isCaptureEndError,
  SESSION_END_ERROR_CODES,
} from '../utils/interviewSessionEnding';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CallEnd,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import '../ui.css';

const API_BASE_URL = getApiBaseUrl();
const REALTIME_VOICE = (process.env.REACT_APP_REALTIME_VOICE || 'alloy').trim() || 'alloy';
const DEFAULT_SONIA_AVATAR_SRC = '/assets/presentation/sonia-avatar.png';
const resolveSoniaAvatarSrc = () => {
  if (typeof window !== 'undefined') {
    const runtimeAvatar = (window.sessionStorage.getItem('soniaAvatarSrc') || '').trim();
    if (runtimeAvatar) {
      return runtimeAvatar;
    }
  }
  return (process.env.REACT_APP_SONIA_AVATAR_SRC || '').trim() || DEFAULT_SONIA_AVATAR_SRC;
};
const INTERVIEW_SERVER_CONTROL_ENABLED = String(process.env.REACT_APP_INTERVIEW_SERVER_CONTROL_ENABLED || 'true').toLowerCase() === 'true';
const ENABLE_BROWSER_SR_FALLBACK = String(process.env.REACT_APP_ENABLE_BROWSER_SR_FALLBACK || 'true').toLowerCase() === 'true';
const TRANSCRIPTION_MODEL = (process.env.REACT_APP_REALTIME_TRANSCRIPTION_MODEL || 'whisper').trim() || 'whisper';
const REALTIME_DEBUG = String(process.env.REACT_APP_REALTIME_DEBUG || 'false').toLowerCase() === 'true';
const DEDUPE_TTL_MS = 8000;
const BROWSER_SR_AI_AUDIO_COOLDOWN_MS = 1600;
const BROWSER_SR_USER_SPEECH_WINDOW_MS = 5000;
const GAZE_ALGORITHM_VERSION = 'mediapipe_face_landmarker_v1';
const GAZE_CALIBRATION_FRAMES = 18;
const GAZE_SMOOTHING_WINDOW = 7;
const GAZE_PREFLIGHT_MS = 1800;
const GAZE_HORIZONTAL_DELTA_THRESHOLD = 0.055;
const GAZE_VERTICAL_UP_DELTA_THRESHOLD = -0.055;
const GAZE_VERTICAL_DOWN_DELTA_THRESHOLD = 0.06;
const GAZE_HEAD_X_THRESHOLD = 0.05;
const GAZE_HEAD_Y_THRESHOLD = 0.045;
const GAZE_MODEL_ASSET_URL =
  (process.env.REACT_APP_MEDIAPIPE_FACE_MODEL_URL || '').trim() ||
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const GAZE_WASM_ROOT =
  (process.env.REACT_APP_MEDIAPIPE_WASM_ROOT || '').trim() ||
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];
const LEFT_EYE_INDICES = { outer: 33, inner: 133, top: 159, bottom: 145 };
const RIGHT_EYE_INDICES = { outer: 263, inner: 362, top: 386, bottom: 374 };
const NO_GAZE_METRICS = {
  detectorReady: false,
  gazeDirection: 'DETECTOR_UNAVAILABLE',
  eyeContact: false,
  conf: 0.0,
  faceDetected: false,
  trackingActive: false,
  calibrationState: 'detector_unavailable',
  calibrationProgress: 0,
  calibrationQuality: null,
  calibrationValid: false,
  algorithmVersion: GAZE_ALGORITHM_VERSION,
  source: GAZE_ALGORITHM_VERSION,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const average = (values = []) => {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
};

const summarizeCalibrationFrames = (frames = []) => {
  if (!Array.isArray(frames) || frames.length < GAZE_CALIBRATION_FRAMES) {
    return { quality: null, valid: false };
  }
  const spread = (key) => {
    const values = frames.map((frame) => frame?.[key]).filter(Number.isFinite);
    if (!values.length) return Infinity;
    return Math.max(...values) - Math.min(...values);
  };
  const horizontalSpread = spread('horizontal');
  const verticalSpread = spread('vertical');
  const headXSpread = spread('headX');
  const headYSpread = spread('headY');
  const averageFaceArea = average(frames.map((frame) => frame?.faceArea)) || 0;
  const stable =
    horizontalSpread <= 0.06 &&
    verticalSpread <= 0.06 &&
    headXSpread <= 0.045 &&
    headYSpread <= 0.045;
  const centered = averageFaceArea >= 0.018;
  const quality = Number(
    clamp(
      1 - ((horizontalSpread + verticalSpread + headXSpread + headYSpread) / 0.21),
      0,
      1,
    ).toFixed(4),
  );
  return {
    quality,
    valid: stable && centered,
  };
};

const averageLandmarkPoint = (landmarks, indices) => {
  const points = indices
    .map((index) => landmarks?.[index])
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!points.length) return null;
  return {
    x: average(points.map((point) => point.x)),
    y: average(points.map((point) => point.y)),
    z: average(points.map((point) => point.z || 0)) || 0,
  };
};

const getLandmarkPoint = (landmarks, index) => {
  const point = landmarks?.[index];
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }
  return { x: point.x, y: point.y, z: Number(point.z || 0) };
};

const computeEyeSignal = (landmarks, eyeIndices, irisIndices) => {
  const iris = averageLandmarkPoint(landmarks, irisIndices);
  const outer = getLandmarkPoint(landmarks, eyeIndices.outer);
  const inner = getLandmarkPoint(landmarks, eyeIndices.inner);
  const top = getLandmarkPoint(landmarks, eyeIndices.top);
  const bottom = getLandmarkPoint(landmarks, eyeIndices.bottom);
  if (!iris || !outer || !inner || !top || !bottom) {
    return null;
  }
  const minX = Math.min(outer.x, inner.x);
  const maxX = Math.max(outer.x, inner.x);
  const eyeWidth = Math.max(Math.abs(maxX - minX), 1e-4);
  const eyeHeight = Math.max(Math.abs(bottom.y - top.y), 1e-4);
  const centerX = (minX + maxX) / 2;
  const centerY = (top.y + bottom.y) / 2;
  return {
    horizontal: (iris.x - centerX) / eyeWidth,
    vertical: (iris.y - centerY) / eyeHeight,
    centerX,
    centerY,
  };
};

const computeLandmarkSample = (landmarks) => {
  if (!Array.isArray(landmarks) || !landmarks.length) {
    return null;
  }
  const leftEye = computeEyeSignal(landmarks, LEFT_EYE_INDICES, LEFT_IRIS_INDICES);
  const rightEye = computeEyeSignal(landmarks, RIGHT_EYE_INDICES, RIGHT_IRIS_INDICES);
  const nose = getLandmarkPoint(landmarks, 1) || getLandmarkPoint(landmarks, 4);
  if (!leftEye || !rightEye || !nose) {
    return null;
  }
  const xs = landmarks.map((point) => point?.x).filter(Number.isFinite);
  const ys = landmarks.map((point) => point?.y).filter(Number.isFinite);
  if (!xs.length || !ys.length) {
    return null;
  }
  const faceWidth = Math.max(Math.max(...xs) - Math.min(...xs), 1e-4);
  const faceHeight = Math.max(Math.max(...ys) - Math.min(...ys), 1e-4);
  return {
    horizontal: average([leftEye.horizontal, rightEye.horizontal]) || 0,
    vertical: average([leftEye.vertical, rightEye.vertical]) || 0,
    headX: nose.x,
    headY: nose.y,
    faceWidth,
    faceHeight,
    faceArea: faceWidth * faceHeight,
  };
};

const classifyCalibratedGaze = (sample, baseline) => {
  const deltaHorizontal = sample.horizontal - baseline.horizontal;
  const deltaVertical = sample.vertical - baseline.vertical;
  const deltaHeadX = sample.headX - baseline.headX;
  const deltaHeadY = sample.headY - baseline.headY;
  const eyeHorizontalSignal = Math.abs(deltaHorizontal) - Math.abs(deltaHeadX) * 0.35;
  const eyeVerticalSignal = Math.abs(deltaVertical) - Math.abs(deltaHeadY) * 0.2;

  let direction = 'ON_SCREEN';
  if (
    deltaVertical >= GAZE_VERTICAL_DOWN_DELTA_THRESHOLD ||
    (eyeVerticalSignal >= GAZE_VERTICAL_DOWN_DELTA_THRESHOLD * 0.82 && deltaVertical > 0) ||
    deltaHeadY >= GAZE_HEAD_Y_THRESHOLD
  ) {
    direction = 'DOWN';
  } else if (
    deltaVertical <= GAZE_VERTICAL_UP_DELTA_THRESHOLD ||
    (eyeVerticalSignal >= Math.abs(GAZE_VERTICAL_UP_DELTA_THRESHOLD) * 0.82 && deltaVertical < 0) ||
    deltaHeadY <= -GAZE_HEAD_Y_THRESHOLD
  ) {
    direction = 'UP';
  } else if (
    deltaHorizontal <= -GAZE_HORIZONTAL_DELTA_THRESHOLD ||
    (eyeHorizontalSignal >= GAZE_HORIZONTAL_DELTA_THRESHOLD * 0.82 && deltaHorizontal < 0) ||
    deltaHeadX <= -GAZE_HEAD_X_THRESHOLD
  ) {
    direction = 'LEFT';
  } else if (
    deltaHorizontal >= GAZE_HORIZONTAL_DELTA_THRESHOLD ||
    (eyeHorizontalSignal >= GAZE_HORIZONTAL_DELTA_THRESHOLD * 0.82 && deltaHorizontal > 0) ||
    deltaHeadX >= GAZE_HEAD_X_THRESHOLD
  ) {
    direction = 'RIGHT';
  }

  const movementMagnitude = Math.min(
    1,
    Math.abs(deltaHorizontal) * 4.4 +
      Math.abs(deltaVertical) * 4.2 +
      Math.abs(deltaHeadX) * 2.4 +
      Math.abs(deltaHeadY) * 2.2,
  );
  const faceConfidence = clamp(sample.faceArea * 5.4, 0.35, 0.98);
  const conf =
    direction === 'ON_SCREEN'
      ? clamp(faceConfidence * (1 - movementMagnitude * 0.35), 0.45, 0.99)
      : clamp(faceConfidence * (0.65 + movementMagnitude * 0.45), 0.45, 0.99);

  return {
    direction,
    conf: Number(conf.toFixed(4)),
  };
};

const buildInterviewerUtteranceInstruction = (questionText, refusalMessage = null, options = {}) => {
  const opening = Boolean(options?.opening);
  const question = String(questionText || '').trim();
  const refusal = String(refusalMessage || '').trim();
  const parts = [];
  if (refusal) parts.push(refusal);
  parts.push(question);
  const script = parts.join(' ');
  return [
    'Role: You are Sonia, a strict but professional interviewer.',
    'Task: Ask the QUESTION below in a natural, direct interview tone.',
    'Rules:',
    '- For the opening question, begin with one short welcome sentence and then ask exactly one concrete question.',
    '- For later turns, begin with a brief natural acknowledgment only if this follows a real candidate answer.',
    '- Then ask the QUESTION below. You may rephrase it slightly for a natural flow, but preserve the full intent.',
    '- Be direct and interviewer-like. Do not ramble, apologize, coach, narrate the process, or say you are getting back on track.',
    '- Keep acknowledgments restrained: examples are "Understood.", "Okay.", or "Go on."',
    '- Do NOT provide feedback, scores, or evaluate the answer.',
    '- Do NOT ask multiple questions at once.',
    '- Ask the question and then stop. Wait for the candidate to answer.',
    '- If the prior candidate reply was weak, unclear, or effectively absent, restate the same question more directly instead of switching topics.',
    '- Do not switch to a new topic just because the candidate paused. Hold the question, then repeat it once more directly if needed.',
    '- Keep your total response concise — under 45 words for the opening, under 50 words otherwise.',
    `OPENING_TURN: ${opening ? 'yes' : 'no'}`,
    `QUESTION: ${script}`,
  ].join('\n');
};

const extractResponseDoneText = (msg) => {
  const direct = [
    msg?.text,
    msg?.transcript,
    msg?.response?.text,
    msg?.response?.transcript,
  ].find((value) => typeof value === 'string' && value.trim().length > 0);
  if (direct) return String(direct).trim();

  const outputs = Array.isArray(msg?.response?.output) ? msg.response.output : [];
  const fragments = [];

  outputs.forEach((item) => {
    if (typeof item?.text === 'string' && item.text.trim()) {
      fragments.push(item.text.trim());
    }
    if (typeof item?.transcript === 'string' && item.transcript.trim()) {
      fragments.push(item.transcript.trim());
    }
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      const candidate = [
        part?.text,
        part?.transcript,
        part?.audio?.transcript,
      ].find((value) => typeof value === 'string' && value.trim().length > 0);
      if (candidate) {
        fragments.push(String(candidate).trim());
      }
    });
  });

  return fragments.join(' ').trim();
};

const debugRealtime = (...args) => {
  if (REALTIME_DEBUG) {
    console.log(...args);
  }
};

export default function InterviewSessionRoom() {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  const devAuthBypass = isDevAuthBypassEnabled();
  const effectiveUser = useMemo(() => (
    user || (devAuthBypass ? { id: 'dev-bypass-user' } : null)
  ), [devAuthBypass, user]);
  const soniaAvatarSrc = useMemo(() => resolveSoniaAvatarSrc(), []);

  // Generate sessionId
  const sessionId = useMemo(() => {
    if (params.sessionId) return params.sessionId;
    if (params.type) {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, [params.sessionId, params.type]);

  const typeFromUrl = params.type;

  // Get interview type from sessionStorage, URL params, or defaults
  const [interviewType, setInterviewType] = useState(typeFromUrl || 'behavioral');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [effectiveDurationMinutes, setEffectiveDurationMinutes] = useState(15);
  const [difficulty, setDifficulty] = useState('easy');
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [questionMix, setQuestionMix] = useState('balanced');
  const [interviewStyle, setInterviewStyle] = useState('neutral');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [planTier, setPlanTier] = useState('free');
  const [trialMode, setTrialMode] = useState(false);

  useEffect(() => {
    const config = sessionStorage.getItem('interviewConfig');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setInterviewType(parsed.type || typeFromUrl || 'behavioral');
        const configuredDuration = parsed.duration ? parseInt(parsed.duration, 10) : 15;
        setDurationMinutes(configuredDuration);
        setEffectiveDurationMinutes(configuredDuration);
        setDifficulty(parsed.difficulty || 'easy');
        setTargetRole(parsed.role || '');
        setTargetCompany(parsed.company || '');
        setQuestionMix(parsed.questionMix || 'balanced');
        setInterviewStyle(parsed.interviewStyle || 'neutral');
        setSelectedSkills(Array.isArray(parsed.selectedSkills) ? parsed.selectedSkills : []);
        if (typeof parsed.trialMode === 'boolean') {
          setTrialMode(parsed.trialMode);
        }
      } catch (e) {
        console.error('Error parsing config:', e);
      }
    } else if (typeFromUrl) {
      setInterviewType(typeFromUrl);
    }
  }, [typeFromUrl]);

  // WebRTC refs
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const audioElementRef = useRef(null);
  const audioResumeActionRef = useRef(null);
  const gazeWsRef = useRef(null);
  const gazeBatcherRef = useRef(null);
  const gazeCanvasRef = useRef(null);
  const gazeRafRef = useRef(0);
  const cameraOffRef = useRef(false);
  const faceDetectorRef = useRef(null);
  const detectorInitPromiseRef = useRef(null);
  const detectInFlightRef = useRef(false);
  const gazeSampleHistoryRef = useRef([]);
  const gazeCalibrationRef = useRef({
    status: 'idle',
    frames: [],
    baseline: null,
    completedAt: null,
    quality: null,
    valid: false,
  });
  const clientGazeRef = useRef({ ...NO_GAZE_METRICS });
  const gazeFinalizePromiseRef = useRef(null);
  const gazeFinalizeResolverRef = useRef(null);

  // State
  const [status, setStatus] = useState('idle');
  const [micActive, setMicActive] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [, setTranscript] = useState([]);
  const [error, setError] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [, setQuestionCount] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [selfViewHidden, setSelfViewHidden] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [gazeMetrics, setGazeMetrics] = useState({
    connected: false,
    eyeContact: false,
    eyeContactPct: null,
    gazeDirection: 'DETECTOR_UNAVAILABLE',
    activeFlag: null,
    detectorReady: false,
    faceDetected: false,
    trackingActive: false,
    calibrationState: 'detector_unavailable',
    calibrationProgress: 0,
    calibrationQuality: null,
    calibrationValid: false,
  });
  const capturedAiRef = useRef(new Map());
  const capturedUserRef = useRef(new Map());
  const capturedAiResponseIdsRef = useRef(new Set());

  // Collect all AI and user messages for saving
  const aiMessagesRef = useRef([]);
  const userMessagesRef = useRef([]);
  // Track last AI spoken text for echo detection
  const lastAiSpokenTextRef = useRef('');
  // Track the last question text sent to AI via sendServerQuestion — for immediate echo detection
  // before audio transcript events arrive (timing race condition mitigation)
  const lastSentQuestionTextRef = useRef('');
  // Track last AI output item id to associate following conversation items as user replies
  const lastAIItemRef = useRef(null);
  // Track last committed input item id (optional)
  const lastCommittedInputItemRef = useRef(null);
  // Track counted response IDs to avoid double-counting questions
  const countedResponseIdsRef = useRef(new Set());
  const turnEvaluationsRef = useRef([]);
  const askedQuestionIdsRef = useRef([]);
  const adaptiveInFlightRef = useRef(false);
  const requestAdaptiveTurnRef = useRef(null);
  const pendingUserTranscriptRef = useRef({});
  const finalUserTranscriptItemIdsRef = useRef(new Set());
  const pendingOpeningQuestionRef = useRef(null);
  const pendingOpeningInstructionRef = useRef(null);
  const transcriptionFallbackNotifiedRef = useRef(false);
  const openingResponseSentRef = useRef(false);
  const sessionConfiguredRef = useRef(false);
  const browserSpeechRef = useRef(null);
  const browserSpeechShouldRunRef = useRef(false);
  const lastUserTranscriptRef = useRef({ text: '', at: 0 });
  const aiSpeakingRef = useRef(false);
  const lastAiAudioStoppedAtRef = useRef(0);
  const lastUserSpeechSignalAtRef = useRef(0);
  const captureStatsRef = useRef({
    captured_user_turns: 0,
    captured_ai_turns: 0,
    dropped_events: {},
  });

  // --- End / transcript reliability guards ---
  const endInProgressRef = useRef(false);
  const isEndingRef = useRef(false);
  const lastMessageAtRef = useRef(Date.now());

  // Error recovery state
  const [endError, setEndError] = useState(null);
  const [showEndErrorDialog, setShowEndErrorDialog] = useState(false);

  // In-session capture warnings: null | 'fallback' | 'no_audio' | 'audio_blocked'
  const [captureWarning, setCaptureWarning] = useState(null);
  const [continuityWarning, setContinuityWarning] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const pendingTranscriptPayloadRef = useRef(null);
  const pendingRambleInterruptRef = useRef(false);
  const fillerPlayingRef = useRef(false);

  // Utility
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const {
    isPlaying: fillerIsPlaying,
    currentFiller,
    playFiller,
    stopFiller,
  } = useConversationalFillers();

  useEffect(() => {
    fillerPlayingRef.current = fillerIsPlaying;
  }, [fillerIsPlaying]);

  const incrementDroppedEvent = useCallback((reason) => {
    if (!reason) return;
    const stats = captureStatsRef.current;
    const key = String(reason);
    stats.dropped_events[key] = (stats.dropped_events[key] || 0) + 1;
  }, []);

  const setAiSpeakingState = useCallback((active) => {
    aiSpeakingRef.current = Boolean(active);
    setAiSpeaking(Boolean(active));
    if (!active) {
      lastAiAudioStoppedAtRef.current = Date.now();
    }
  }, []);

  const markUserSpeechSignal = useCallback(() => {
    lastUserSpeechSignalAtRef.current = Date.now();
  }, []);

  const rememberByTtl = useCallback((storeRef, key, ttlMs = DEDUPE_TTL_MS) => {
    if (!key) return false;
    const now = Date.now();
    const prev = storeRef.current.get(key);
    if (prev && now - prev < ttlMs) {
      return true;
    }
    storeRef.current.set(key, now);

    // small in-place cleanup to keep map bounded in long calls
    if (storeRef.current.size > 500) {
      const cutoff = now - ttlMs;
      Array.from(storeRef.current.entries()).forEach(([entryKey, ts]) => {
        if (ts < cutoff) {
          storeRef.current.delete(entryKey);
        }
      });
    }

    return false;
  }, []);

  /**
   * Echo detection: returns true if userText appears to be the mic picking up the AI's own
   * speech output (hardware loopback / AEC failure). Compares word-level overlap against the
   * last few AI messages AND the last sent question (to catch echoes that arrive before the
   * audio transcript event fires — a common timing race condition).
   */
  const isEchoOfAI = useCallback((userText) => {
    if (!userText) return false;
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2);
    const userWords = new Set(normalize(userText));
    if (userWords.size < 3) return false; // too short to be a meaningful echo check

    // Build corpus of recent AI speech: last 3 AI transcript messages + the last sent question
    const candidates = [
      ...aiMessagesRef.current.slice(-3).map((m) => m.text || ''),
      lastSentQuestionTextRef.current,
      lastAiSpokenTextRef.current,
    ].filter(Boolean);

    for (const aiText of candidates) {
      const aiWords = new Set(normalize(aiText));
      if (aiWords.size === 0) continue;
      let overlap = 0;
      for (const w of userWords) { if (aiWords.has(w)) overlap++; }
      if (overlap / userWords.size >= 0.60) {
        debugRealtime('[echo_detection] Discarding user transcript as AI echo:', userText);
        return true;
      }
    }
    return false;
  }, []);

  // Add transcript entry
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callback uses refs only; adding state deps would re-register listeners
  const addTranscript = useCallback((speaker, text, meta = {}) => {
    const ts = new Date().toISOString();
    const transcriptMeta = annotateCaptureEntry({
      speaker,
      text,
      timestamp: ts,
      evidenceSource:
        meta.evidence_source ||
        (speaker === 'ai'
          ? 'realtime_model_audio'
          : speaker === 'user'
            ? 'realtime_input_transcription'
            : 'ui_system_notice'),
      trustedForEvaluation:
        typeof meta.trusted_for_evaluation === 'boolean'
          ? meta.trusted_for_evaluation
          : speaker === 'ai' || speaker === 'user',
      transcriptOrigin: meta.transcript_origin || null,
    });

    // Update drain tracking
    lastMessageAtRef.current = Date.now();

    if (speaker === 'ai' || speaker === 'user') {
      setTranscript(prev => [...prev, {
        speaker,
        text,
        timestamp: ts
      }]);
    }

    // Also collect for saving (refs are source of truth)
    if (speaker === 'ai') {
      aiMessagesRef.current.push({ speaker: 'ai', text, timestamp: ts, ...transcriptMeta });
      captureStatsRef.current.captured_ai_turns += 1;
    } else if (speaker === 'user') {
      const normalized = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const now = Date.now();
      if (
        normalized &&
        lastUserTranscriptRef.current.text === normalized &&
        now - lastUserTranscriptRef.current.at < 4000
      ) {
        incrementDroppedEvent('duplicate_user_recent_text');
        return;
      }
      lastUserTranscriptRef.current = { text: normalized, at: now };
      userMessagesRef.current.push({ speaker: 'user', text, timestamp: ts, ...transcriptMeta });
      captureStatsRef.current.captured_user_turns += 1;
      setCaptureWarning(null); // audio confirmed — dismiss any capture warning
      if (transcriptMeta.trusted_for_evaluation === false) {
        setContinuityWarning({
          tone: 'warning',
          message: 'Browser speech fallback kept the interview moving. Fallback candidate transcript will remain visible, but it will not be used as trusted scoring evidence.',
        });
      }
      if (!isEndingRef.current && typeof requestAdaptiveTurnRef.current === 'function') {
        requestAdaptiveTurnRef.current(text, ts);
      }
    }
  }, [incrementDroppedEvent]);

  const incrementQuestionCount = useCallback((responseId, text = '') => {
    if (!responseId || countedResponseIdsRef.current.has(responseId)) {
      return false;
    }
    const normalizedText = String(text || '').trim();
    if (normalizedText && normalizedText.length <= 10) {
      return false;
    }
    countedResponseIdsRef.current.add(responseId);
    setQuestionCount((prev) => prev + 1);
    return true;
  }, []);

  const commitAiTranscript = useCallback((text, responseId) => {
    const finalText = String(text || '').trim();
    if (!finalText) {
      return false;
    }
    if (responseId && capturedAiResponseIdsRef.current.has(responseId)) {
      incrementDroppedEvent('duplicate_ai_response');
      return false;
    }
    const key = `${responseId || 'ai'}:${finalText}`;
    if (rememberByTtl(capturedAiRef, key)) {
      return false;
    }
    if (responseId) {
      capturedAiResponseIdsRef.current.add(responseId);
    }
    addTranscript('ai', finalText, {
      evidence_source: 'realtime_output_audio_transcript',
      trusted_for_evaluation: true,
      transcript_origin: 'server_audio_transcript',
    });
    lastAiSpokenTextRef.current = finalText;
    incrementQuestionCount(responseId, finalText);
    return true;
  }, [addTranscript, incrementDroppedEvent, incrementQuestionCount, rememberByTtl]);

  const commitUserTranscript = useCallback((text, itemId, meta = {}) => {
    const finalText = String(text || '').trim();
    if (!finalText) {
      incrementDroppedEvent('empty_user_transcription');
      return false;
    }
    const key = `${itemId || 'user'}:${finalText}`;
    if (rememberByTtl(capturedUserRef, key)) {
      incrementDroppedEvent('duplicate_user_transcription');
      return false;
    }
    if (isEchoOfAI(finalText)) {
      incrementDroppedEvent('echo_of_ai_discarded');
      return false;
    }
    addTranscript('user', finalText, meta);
    setMicActive(false);
    return true;
  }, [addTranscript, incrementDroppedEvent, isEchoOfAI, rememberByTtl]);

  const sendRealtimeQuestion = useCallback((questionText, options = {}) => {
    const q = String(questionText || '').trim();
    if (!q || !dcRef.current || dcRef.current.readyState !== 'open') return false;
    stopFiller();
    setIsThinking(false);
    lastSentQuestionTextRef.current = q;
    const wrappedInstruction = String(options?.instruction || '').trim()
      || buildInterviewerUtteranceInstruction(
        q,
        options?.refusalMessage || null,
        options,
      );
    dcRef.current.send(
      JSON.stringify({
        type: 'response.create',
        response: {
          instructions: wrappedInstruction,
        },
      }),
    );
    debugRealtime('[realtime] Sent interviewer prompt', {
      opening: Boolean(options?.opening),
      recovery: Boolean(options?.recovery),
    });
    return true;
  }, [stopFiller]);

  const stopSoniaPlayback = useCallback(() => {
    stopFiller();
    const audio = audioElementRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // no-op
      }
    }
    setAiSpeakingState(false);
  }, [setAiSpeakingState, stopFiller]);

  const handleVadSpeechStart = useCallback(() => {
    setMicActive(true);
    markUserSpeechSignal();
    if (aiSpeakingRef.current || fillerPlayingRef.current) {
      stopSoniaPlayback();
      setContinuityWarning({
        tone: 'warning',
        message: 'Candidate barge-in detected. Sonia paused so you can continue.',
      });
    }
  }, [markUserSpeechSignal, stopSoniaPlayback]);

  const handleVadSpeechEnd = useCallback(() => {
    setMicActive(false);
    markUserSpeechSignal();
    if (pendingRambleInterruptRef.current) {
      pendingRambleInterruptRef.current = false;
      const rambleInterrupt = buildAdaptiveTurnFallbackQuestion({
        interviewType,
        role: targetRole,
        company: targetCompany,
        questionMix,
      });
      stopFiller();
      setContinuityWarning({
        tone: 'warning',
        message: 'Sonia is stepping in to keep the interview moving. Please keep answers concise.',
      });
      sendRealtimeQuestion(rambleInterrupt, { recovery: true });
    }
  }, [
    interviewType,
    markUserSpeechSignal,
    questionMix,
    sendRealtimeQuestion,
    stopFiller,
    targetCompany,
    targetRole,
  ]);

  const handleVadRambleThreshold = useCallback(() => {
    pendingRambleInterruptRef.current = true;
    setContinuityWarning({
      tone: 'warning',
      message: 'Sonia may interrupt if the answer keeps running. Keep your main point focused.',
    });
  }, []);

  const shouldBargeIn = useCallback(() => aiSpeakingRef.current || fillerPlayingRef.current, []);

  const vad = useVAD({
    threshold: 0.02,
    silenceMs: 450,
    rambleThresholdMs: 180000,
    onSpeechStart: handleVadSpeechStart,
    onSpeechEnd: handleVadSpeechEnd,
    onBargeIn: stopSoniaPlayback,
    onRambleThreshold: handleVadRambleThreshold,
    shouldBargeIn,
  });

  useEffect(() => {
    const handleOffline = () => {
      setNetworkOnline(false);
      if (hasJoined) {
        setStatus((prev) => (prev === 'ending' ? prev : 'disconnected'));
        setError('Internet disconnected. Interview paused. Reconnect when network is back.');
        addTranscript('system', 'Network disconnected. Interview paused.');
      }
    };
    const handleOnline = () => {
      setNetworkOnline(true);
      if (hasJoined) {
        addTranscript('system', 'Network restored. Click Reconnect to continue.');
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [addTranscript, hasJoined]);

  // Timer
  useEffect(() => {
    let interval;
    if (hasJoined && (status === 'connected' || status === 'ready')) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hasJoined, status]);

  // Periodic no-audio silence check: if connected >30s with no user turns captured, warn
  useEffect(() => {
    if (!hasJoined || (status !== 'connected' && status !== 'ready')) return;
    const silenceCheck = setInterval(() => {
      const userTurns = captureStatsRef.current.captured_user_turns;
      if (userTurns === 0) {
        setCaptureWarning(prev => (prev === 'fallback' ? 'fallback' : 'no_audio'));
      } else {
        setCaptureWarning(null);
      }
    }, 30000);
    return () => clearInterval(silenceCheck);
  }, [hasJoined, status]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !micMuted;
    });
  }, [micMuted]);

  const buildGazeWsUrl = useCallback((token) => {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000';
    const base = API_BASE_URL || fallbackOrigin;
    let url;
    try {
      url = new URL(`/ws/gaze/${sessionId}`, base);
    } catch {
      url = new URL(`/ws/gaze/${sessionId}`, fallbackOrigin);
    }
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    if (token) {
      url.searchParams.set('token', token);
    }
    return url.toString();
  }, [sessionId]);

  const settleGazeFinalize = useCallback((payload) => {
    if (typeof gazeFinalizeResolverRef.current !== 'function') return;
    const resolver = gazeFinalizeResolverRef.current;
    gazeFinalizeResolverRef.current = null;
    gazeFinalizePromiseRef.current = null;
    resolver(payload);
  }, []);

  const stopGazeMonitoring = useCallback((options = {}) => {
    const resetDetector = options.resetDetector !== false;
    if (gazeRafRef.current) {
      cancelAnimationFrame(gazeRafRef.current);
      gazeRafRef.current = 0;
    }
    if (resetDetector) {
      if (faceDetectorRef.current?.close) {
        try {
          faceDetectorRef.current.close();
        } catch {
          // no-op
        }
      }
      faceDetectorRef.current = null;
      detectorInitPromiseRef.current = null;
      detectInFlightRef.current = false;
      gazeSampleHistoryRef.current = [];
      gazeCalibrationRef.current = {
        status: 'idle',
        frames: [],
        baseline: null,
        completedAt: null,
        quality: null,
        valid: false,
      };
      clientGazeRef.current = { ...NO_GAZE_METRICS };
    }
    if (gazeWsRef.current) {
      try {
        gazeWsRef.current.close();
      } catch {
        // no-op
      }
      gazeWsRef.current = null;
    }
    if (gazeBatcherRef.current) {
      gazeBatcherRef.current.close();
      gazeBatcherRef.current = null;
    }
    settleGazeFinalize({ finalized: false, reason: resetDetector ? 'STOP' : 'SOCKET_CLOSED' });
    setGazeMetrics((prev) => ({
      ...prev,
      connected: false,
      activeFlag: null,
      faceDetected: resetDetector ? false : prev.faceDetected,
      detectorReady: resetDetector ? false : prev.detectorReady,
      trackingActive: resetDetector ? false : prev.trackingActive,
      calibrationState: resetDetector ? 'detector_unavailable' : prev.calibrationState,
      calibrationProgress: resetDetector ? 0 : prev.calibrationProgress,
      calibrationQuality: resetDetector ? null : prev.calibrationQuality,
      calibrationValid: resetDetector ? false : prev.calibrationValid,
      gazeDirection: resetDetector ? 'DETECTOR_UNAVAILABLE' : prev.gazeDirection,
    }));
  }, [settleGazeFinalize]);

  const createOrReuseFaceDetector = useCallback(async () => {
    if (faceDetectorRef.current) {
      return faceDetectorRef.current;
    }
    if (detectorInitPromiseRef.current) {
      return detectorInitPromiseRef.current;
    }
    detectorInitPromiseRef.current = (async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(GAZE_WASM_ROOT);
        let detector = null;
        for (const delegate of ['GPU', 'CPU']) {
          try {
            detector = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: GAZE_MODEL_ASSET_URL,
                delegate,
              },
              runningMode: 'VIDEO',
              numFaces: 1,
              outputFaceBlendshapes: false,
              outputFacialTransformationMatrixes: false,
            });
            break;
          } catch (delegateError) {
            if (delegate === 'CPU') {
              throw delegateError;
            }
          }
        }
        faceDetectorRef.current = detector;
        gazeSampleHistoryRef.current = [];
        gazeCalibrationRef.current = {
          status: 'collecting',
          frames: [],
          baseline: null,
          completedAt: null,
          quality: null,
          valid: false,
        };
        return detector;
      } catch (error) {
        console.warn('Failed to initialize MediaPipe gaze detector:', error);
        faceDetectorRef.current = null;
        return null;
      } finally {
        detectorInitPromiseRef.current = null;
      }
    })();
    return detectorInitPromiseRef.current;
  }, []);

  const classifyLandmarkResult = useCallback((landmarks) => {
    const calibration = gazeCalibrationRef.current;
    const progressFromFrames = Math.round(
      clamp((calibration.frames?.length || 0) / GAZE_CALIBRATION_FRAMES, 0, 1) * 100,
    );
    if (!Array.isArray(landmarks) || !landmarks.length) {
      gazeSampleHistoryRef.current = [];
      return {
        detectorReady: true,
        gazeDirection: 'NO_FACE',
        eyeContact: false,
        conf: 0.0,
        faceDetected: false,
        trackingActive: calibration.status === 'complete',
        calibrationState: calibration.status === 'complete' ? 'complete' : 'calibrating',
        calibrationProgress: calibration.status === 'complete' ? 100 : progressFromFrames,
        calibrationQuality: calibration.quality,
        calibrationValid: Boolean(calibration.valid),
        algorithmVersion: GAZE_ALGORITHM_VERSION,
        source: GAZE_ALGORITHM_VERSION,
      };
    }

    const sample = computeLandmarkSample(landmarks);
    if (!sample) {
      return {
        detectorReady: true,
        gazeDirection: 'NO_FACE',
        eyeContact: false,
        conf: 0.0,
        faceDetected: false,
        trackingActive: false,
        calibrationState: 'calibrating',
        calibrationProgress: progressFromFrames,
        calibrationQuality: calibration.quality,
        calibrationValid: Boolean(calibration.valid),
        algorithmVersion: GAZE_ALGORITHM_VERSION,
        source: GAZE_ALGORITHM_VERSION,
      };
    }

    if (calibration.status !== 'complete') {
      calibration.status = 'collecting';
      calibration.frames = [...calibration.frames, sample].slice(-GAZE_CALIBRATION_FRAMES);
      const calibrationProgress = Math.round(
        clamp(calibration.frames.length / GAZE_CALIBRATION_FRAMES, 0, 1) * 100,
      );
      if (calibration.frames.length < GAZE_CALIBRATION_FRAMES) {
        return {
          detectorReady: true,
          gazeDirection: 'CALIBRATING',
          eyeContact: false,
          conf: Number(clamp(sample.faceArea * 5, 0.45, 0.9).toFixed(4)),
          faceDetected: true,
          trackingActive: false,
          calibrationState: 'calibrating',
          calibrationProgress,
          calibrationQuality: calibration.quality,
          calibrationValid: Boolean(calibration.valid),
          algorithmVersion: GAZE_ALGORITHM_VERSION,
          source: GAZE_ALGORITHM_VERSION,
        };
      }
      const calibrationSummary = summarizeCalibrationFrames(calibration.frames);
      calibration.quality = calibrationSummary.quality;
      calibration.valid = calibrationSummary.valid;
      if (!calibration.valid) {
        calibration.frames = calibration.frames.slice(-Math.ceil(GAZE_CALIBRATION_FRAMES * 0.7));
        return {
          detectorReady: true,
          gazeDirection: 'CALIBRATING',
          eyeContact: false,
          conf: Number(clamp(sample.faceArea * 5, 0.45, 0.9).toFixed(4)),
          faceDetected: true,
          trackingActive: false,
          calibrationState: 'calibrating',
          calibrationProgress,
          calibrationQuality: calibration.quality,
          calibrationValid: false,
          algorithmVersion: GAZE_ALGORITHM_VERSION,
          source: GAZE_ALGORITHM_VERSION,
        };
      }
      calibration.baseline = {
        horizontal: average(calibration.frames.map((frame) => frame.horizontal)) || 0,
        vertical: average(calibration.frames.map((frame) => frame.vertical)) || 0,
        headX: average(calibration.frames.map((frame) => frame.headX)) || 0,
        headY: average(calibration.frames.map((frame) => frame.headY)) || 0,
      };
      calibration.status = 'complete';
      calibration.completedAt = Date.now();
      gazeSampleHistoryRef.current = [];
    }

    gazeSampleHistoryRef.current = [...gazeSampleHistoryRef.current, sample].slice(-GAZE_SMOOTHING_WINDOW);
    const averagedSample = {
      horizontal: average(gazeSampleHistoryRef.current.map((frame) => frame.horizontal)) || sample.horizontal,
      vertical: average(gazeSampleHistoryRef.current.map((frame) => frame.vertical)) || sample.vertical,
      headX: average(gazeSampleHistoryRef.current.map((frame) => frame.headX)) || sample.headX,
      headY: average(gazeSampleHistoryRef.current.map((frame) => frame.headY)) || sample.headY,
      faceArea: average(gazeSampleHistoryRef.current.map((frame) => frame.faceArea)) || sample.faceArea,
    };
    const classified = classifyCalibratedGaze(averagedSample, calibration.baseline);
    return {
      detectorReady: true,
      gazeDirection: classified.direction,
      eyeContact: classified.direction === 'ON_SCREEN',
      conf: classified.conf,
      faceDetected: true,
      trackingActive: true,
      calibrationState: 'complete',
      calibrationProgress: 100,
      calibrationQuality: calibration.quality,
      calibrationValid: Boolean(calibration.valid),
      algorithmVersion: GAZE_ALGORITHM_VERSION,
      source: GAZE_ALGORITHM_VERSION,
    };
  }, []);

  const runGazePreflight = useCallback(async () => {
    const stream = localStreamRef.current;
    const video = localVideoRef.current;
    if (!stream || !video) {
      return;
    }

    try {
      video.srcObject = stream;
      await video.play();
    } catch {
      // ignore preview warmup failure
    }

    const detector = await createOrReuseFaceDetector();
    if (!detector) {
      clientGazeRef.current = { ...NO_GAZE_METRICS };
      setGazeMetrics((prev) => ({
        ...prev,
        detectorReady: false,
        trackingActive: false,
        calibrationState: 'detector_unavailable',
      }));
      return;
    }

    const canvas = gazeCanvasRef.current || document.createElement('canvas');
    gazeCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    canvas.width = 320;
    canvas.height = 240;

    const startedAt = Date.now();
    let lastSample = {
      detectorReady: true,
      gazeDirection: 'CALIBRATING',
      eyeContact: false,
      conf: 0.0,
      faceDetected: false,
      trackingActive: false,
      calibrationState: 'calibrating',
      calibrationQuality: null,
      calibrationValid: false,
      algorithmVersion: GAZE_ALGORITHM_VERSION,
      source: GAZE_ALGORITHM_VERSION,
    };
    while (Date.now() - startedAt < GAZE_PREFLIGHT_MS) {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const result = await detector.detectForVideo(video, performance.now());
        lastSample = classifyLandmarkResult(result?.faceLandmarks?.[0] || null);
        const nextSample = lastSample;
        setGazeMetrics((prev) => ({
          ...prev,
          detectorReady: nextSample.detectorReady !== false,
          gazeDirection: nextSample.gazeDirection || 'DETECTOR_UNAVAILABLE',
          faceDetected: Boolean(nextSample.faceDetected),
          trackingActive: Boolean(nextSample.trackingActive),
          calibrationState: nextSample.calibrationState || 'calibrating',
          calibrationProgress: Number(nextSample.calibrationProgress || 0),
          calibrationQuality: nextSample.calibrationQuality ?? null,
          calibrationValid: Boolean(nextSample.calibrationValid),
        }));
        if (nextSample.trackingActive) {
          break;
        }
      } catch {
        // ignore transient detector errors during warmup
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    clientGazeRef.current = lastSample;
    setGazeMetrics((prev) => ({
      ...prev,
      detectorReady: lastSample.detectorReady !== false,
      gazeDirection: lastSample.gazeDirection || 'DETECTOR_UNAVAILABLE',
      faceDetected: Boolean(lastSample.faceDetected),
      trackingActive: Boolean(lastSample.trackingActive),
      calibrationState: lastSample.calibrationState || 'calibrating',
      calibrationProgress: Number(lastSample.calibrationProgress || 0),
      calibrationQuality: lastSample.calibrationQuality ?? null,
      calibrationValid: Boolean(lastSample.calibrationValid),
    }));
  }, [classifyLandmarkResult, createOrReuseFaceDetector]);

  const startGazeMonitoring = useCallback(async (token) => {
    const stream = localStreamRef.current;
    if (!stream) return { connected: false, detectorReady: false, reason: 'NO_STREAM' };
    const video = localVideoRef.current;
    if (video) {
      try {
        video.srcObject = stream;
        await video.play();
      } catch (e) {
        console.warn('Local preview play error:', e);
      }
    }

    stopGazeMonitoring({ resetDetector: false });
    const ws = new WebSocket(buildGazeWsUrl(token));
    gazeWsRef.current = ws;
    gazeBatcherRef.current = createGazeTelemetryBatcher((payload) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    }, {
      maxBatchSize: 5,
      flushIntervalMs: 100,
    });
    let readyResolved = false;
    let readyResolver = null;
    const readyPromise = new Promise((resolve) => {
      readyResolver = resolve;
    });
    const settleReady = (payload) => {
      if (readyResolved || typeof readyResolver !== 'function') return;
      readyResolved = true;
      readyResolver(payload);
    };

    const sendCameraState = (enabled) => {
      gazeBatcherRef.current?.enqueue({ type: 'camera_state', enabled, t: Date.now() });
    };

    ws.onopen = async () => {
      const detector = await createOrReuseFaceDetector();
      if (!detector && !clientGazeRef.current.detectorReady) {
        clientGazeRef.current = { ...NO_GAZE_METRICS };
        settleReady({ connected: true, detectorReady: false, reason: 'NO_DETECTOR' });
      }

      setGazeMetrics((prev) => ({ ...prev, connected: true }));
      gazeBatcherRef.current?.enqueue({ type: 'init', t: Date.now() });
      sendCameraState(!cameraOffRef.current);

      let lastSent = 0;
      const interval = 1000 / 6; // 6 FPS
      const canvas = gazeCanvasRef.current || document.createElement('canvas');
      gazeCanvasRef.current = canvas;
      const ctx = canvas.getContext('2d');
      canvas.width = 320;
      canvas.height = 240;

      const loop = (ts) => {
        gazeRafRef.current = requestAnimationFrame(loop);
        if (!video || !ctx || ws.readyState !== WebSocket.OPEN) return;
        if (cameraOffRef.current) return;
        if (ts - lastSent < interval) return;
        lastSent = ts;
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const detector = faceDetectorRef.current;
          if (detector && !detectInFlightRef.current) {
            detectInFlightRef.current = true;
            detector.detectForVideo(video, performance.now())
              .then((result) => {
                clientGazeRef.current = classifyLandmarkResult(result?.faceLandmarks?.[0] || null);
                setGazeMetrics((prev) => ({
                  ...prev,
                  connected: true,
                  detectorReady: clientGazeRef.current.detectorReady !== false,
                  gazeDirection: clientGazeRef.current.gazeDirection || 'DETECTOR_UNAVAILABLE',
                  faceDetected: Boolean(clientGazeRef.current.faceDetected),
                  trackingActive: Boolean(clientGazeRef.current.trackingActive),
                  calibrationState: clientGazeRef.current.calibrationState || 'calibrating',
                  calibrationProgress: Number(clientGazeRef.current.calibrationProgress || 0),
                  calibrationQuality: clientGazeRef.current.calibrationQuality ?? null,
                  calibrationValid: Boolean(clientGazeRef.current.calibrationValid),
                }));
                if (!readyResolved && clientGazeRef.current.detectorReady) {
                  settleReady({
                    connected: true,
                    detectorReady: true,
                    reason: clientGazeRef.current.trackingActive ? 'LANDMARKS_ACTIVE' : 'CALIBRATING',
                  });
                }
              })
              .catch(() => {
                clientGazeRef.current = { ...NO_GAZE_METRICS };
              })
              .finally(() => {
                detectInFlightRef.current = false;
              });
          }
          const dataUrl = clientGazeRef.current.detectorReady ? '' : canvas.toDataURL('image/jpeg', 0.6);
          gazeBatcherRef.current?.enqueue({
            type: 'frame',
            t: Date.now(),
            data: dataUrl,
            clientMetrics: clientGazeRef.current,
          });
        } catch (e) {
          // Ignore transient draw errors while camera initializes.
        }
      };
      gazeRafRef.current = requestAnimationFrame(loop);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'metrics') {
          const pctRaw = Number(message.eyeContactPct);
          setGazeMetrics({
            connected: true,
            eyeContact: Boolean(message.eyeContact),
            eyeContactPct: Number.isFinite(pctRaw) ? pctRaw : null,
            gazeDirection: message.gazeDirection || 'DETECTOR_UNAVAILABLE',
            activeFlag: message.activeFlag || null,
            detectorReady: message.detectorReady !== false,
            faceDetected: Boolean(message.faceDetected),
            trackingActive: Boolean(message.trackingActive),
            calibrationState: message.calibrationState || (message.trackingActive ? 'complete' : 'calibrating'),
            calibrationProgress: Number(message.calibrationProgress || (message.trackingActive ? 100 : clientGazeRef.current.calibrationProgress || 0)),
            calibrationQuality: message.calibrationQuality ?? clientGazeRef.current.calibrationQuality ?? null,
            calibrationValid: Boolean(message.calibrationValid ?? clientGazeRef.current.calibrationValid),
          });
          settleReady({
            connected: true,
            detectorReady: message.detectorReady !== false,
            reason: 'METRICS',
          });
        } else if (message.type === 'finalized') {
          const summary = message.summary || {};
          setGazeMetrics((prev) => ({
            ...prev,
            connected: false,
            eyeContactPct: Number.isFinite(Number(summary.eyeContactPct)) ? Number(summary.eyeContactPct) : prev.eyeContactPct,
            activeFlag: null,
            calibrationState: summary.calibrationState || prev.calibrationState,
            calibrationQuality: summary.calibrationQuality ?? prev.calibrationQuality,
            calibrationValid: Boolean(summary.calibrationValid ?? prev.calibrationValid),
          }));
          settleGazeFinalize({ finalized: true, summary });
        } else if (message.type === 'error') {
          console.warn('Gaze monitor error:', message.error || 'Unknown gaze websocket error');
          setGazeMetrics((prev) => ({ ...prev, connected: false, trackingActive: false }));
          settleReady({ connected: false, detectorReady: false, reason: 'WS_ERROR_MESSAGE' });
        }
      } catch {
        // no-op
      }
    };

    ws.onclose = () => {
      if (gazeRafRef.current) {
        cancelAnimationFrame(gazeRafRef.current);
        gazeRafRef.current = 0;
      }
      gazeBatcherRef.current?.close();
      gazeBatcherRef.current = null;
      setGazeMetrics((prev) => ({ ...prev, connected: false, activeFlag: null, faceDetected: false, trackingActive: false }));
      gazeWsRef.current = null;
      settleGazeFinalize({ finalized: false, reason: 'WS_CLOSE' });
      settleReady({ connected: false, detectorReady: false, reason: 'WS_CLOSE' });
    };

    ws.onerror = () => {
      gazeBatcherRef.current?.close();
      gazeBatcherRef.current = null;
      setGazeMetrics((prev) => ({ ...prev, connected: false, faceDetected: false, trackingActive: false }));
      settleGazeFinalize({ finalized: false, reason: 'WS_ERROR' });
      settleReady({ connected: false, detectorReady: false, reason: 'WS_ERROR' });
    };

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          connected: true,
          detectorReady: clientGazeRef.current.detectorReady !== false,
          reason: 'TIMEOUT',
        });
      }, 650);
    });
    const startupState = await Promise.race([readyPromise, timeoutPromise]);
    return startupState;
  }, [buildGazeWsUrl, classifyLandmarkResult, createOrReuseFaceDetector, settleGazeFinalize, stopGazeMonitoring]);

  const finalizeGazeMonitoring = useCallback(async () => {
    const ws = gazeWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      stopGazeMonitoring({ resetDetector: false });
      return { finalized: false, reason: 'NO_SOCKET' };
    }
    if (!gazeFinalizePromiseRef.current) {
      gazeFinalizePromiseRef.current = new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          gazeFinalizeResolverRef.current = null;
          gazeFinalizePromiseRef.current = null;
          resolve({ finalized: false, reason: 'TIMEOUT' });
        }, 1000);
        gazeFinalizeResolverRef.current = (payload) => {
          clearTimeout(timeoutId);
          resolve(payload);
        };
      });
      gazeBatcherRef.current?.flush();
      ws.send(JSON.stringify({
        type: 'finalize',
        t: Date.now(),
        clientMetrics: clientGazeRef.current,
      }));
    }
    try {
      return await gazeFinalizePromiseRef.current;
    } catch {
      return { finalized: false, reason: 'FAILED' };
    } finally {
      stopGazeMonitoring({ resetDetector: false });
    }
  }, [stopGazeMonitoring]);

  useEffect(() => {
    cameraOffRef.current = cameraOff;
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !cameraOff;
      });
    }
    if (gazeWsRef.current && gazeWsRef.current.readyState === WebSocket.OPEN) {
      try {
        gazeBatcherRef.current?.enqueue({ type: 'camera_state', enabled: !cameraOff, t: Date.now() });
      } catch {
        // no-op
      }
    }
  }, [cameraOff]);

  useEffect(() => {
    return () => {
      stopGazeMonitoring();
    };
  }, [stopGazeMonitoring]);

  const requestAdaptiveTurn = useCallback(async (userTurnText) => {
    if (!userTurnText || !userTurnText.trim()) return;
    if (adaptiveInFlightRef.current) return;
    if (isEndingRef.current) return;
    if (!dcRef.current || dcRef.current.readyState !== 'open') return;

    adaptiveInFlightRef.current = true;
    setIsThinking(true);
    playFiller('thinking', { delayMs: 350, seed: userTurnText });
    const recoverAdaptiveTurn = (message, detail = null) => {
      const fallbackQuestion = buildAdaptiveTurnFallbackQuestion({
        interviewType,
        role: targetRole,
        company: targetCompany,
        questionMix,
      });
      const sent = sendRealtimeQuestion(fallbackQuestion, { recovery: true });
      setContinuityWarning({
        tone: sent ? 'warning' : 'error',
        message:
          message ||
          (sent
            ? 'Adaptive scoring is temporarily unavailable. Sonia is continuing with a safe fallback question.'
            : 'Adaptive scoring failed and Sonia could not send the recovery question. Reconnect and continue the interview.'),
      });
      setIsThinking(false);
      stopFiller();
      if (detail) {
        console.warn('[adaptive-turn] recovery detail:', detail);
      }
    };

    try {
      const token = await getToken();
      const transcriptWindow = [...aiMessagesRef.current, ...userMessagesRef.current]
        .map((m) => ({
          speaker: m.speaker || 'ai',
          text: m.text,
          timestamp: m.timestamp,
        }))
        .filter((m) => m.text && m.text.trim().length > 0)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(-16);

      const decision = await requestNextInterviewTurn({
        authFetch,
        baseUrl: API_BASE_URL,
        token,
        sessionId,
        payload: {
          last_user_turn: userTurnText,
          transcript_window: transcriptWindow,
          interviewType,
          difficulty,
          role: targetRole || null,
          company: targetCompany || null,
          questionMix,
          interviewStyle,
          durationMinutes,
          askedQuestionIds: askedQuestionIdsRef.current,
          selectedSkills: selectedSkills || [],
        },
      });

      setContinuityWarning(null);
      if (decision?.turn_scores) {
        turnEvaluationsRef.current.push({
          ...decision.turn_scores,
          question_id: decision.question_id || null,
          reason: decision.reason || null,
          followup_type: decision.followup_type || null,
          difficulty_next: decision.difficulty_next || null,
          timestamp: new Date().toISOString(),
        });
      }

      if (decision?.question_id && !String(decision.question_id).startsWith('followup_') && decision.question_id !== 'fallback_generic') {
        askedQuestionIdsRef.current = Array.from(new Set([...askedQuestionIdsRef.current, decision.question_id]));
      }

      if (decision?.recoverable_error?.message) {
        setContinuityWarning({
          tone: 'warning',
          message: decision.recoverable_error.message,
        });
      }

      if (decision?.next_question && dcRef.current && dcRef.current.readyState === 'open') {
        const nextQuestion = String(decision.next_question || '').trim();
        if (nextQuestion) {
          if (decision?.policy_action === 'REFUSED_META_CONTROL' && decision?.refusal_message) {
            addTranscript('system', decision.refusal_message);
          }
          sendRealtimeQuestion(nextQuestion, {
            instruction: decision?.utterance_instruction,
            refusalMessage: decision?.policy_action === 'REFUSED_META_CONTROL' ? decision?.refusal_message : null,
            opening: false,
          });
        }
      }
    } catch (err) {
      console.warn('[adaptive-turn] error:', err);
      recoverAdaptiveTurn(
        'Adaptive scoring failed during the interview. Sonia is continuing with a safe fallback question.',
        err,
      );
    } finally {
      adaptiveInFlightRef.current = false;
      setIsThinking(false);
      stopFiller();
    }
  }, [
    sendRealtimeQuestion,
    getToken,
    sessionId,
    interviewType,
    difficulty,
    addTranscript,
    targetRole,
    targetCompany,
    questionMix,
    interviewStyle,
    durationMinutes,
    selectedSkills,
    playFiller,
    stopFiller,
  ]);

  useEffect(() => {
    requestAdaptiveTurnRef.current = requestAdaptiveTurn;
  }, [requestAdaptiveTurn]);

  const stopBrowserSpeechRecognition = useCallback(() => {
    browserSpeechShouldRunRef.current = false;
    if (browserSpeechRef.current) {
      try {
        browserSpeechRef.current.onresult = null;
        browserSpeechRef.current.onerror = null;
        browserSpeechRef.current.onend = null;
        browserSpeechRef.current.stop();
      } catch (e) {
        try {
          browserSpeechRef.current.abort();
        } catch (_) {
          // no-op
        }
      }
      browserSpeechRef.current = null;
    }
  }, []);

  const startBrowserSpeechRecognition = useCallback(() => {
    if (!ENABLE_BROWSER_SR_FALLBACK) {
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      incrementDroppedEvent('browser_speech_not_supported');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (!result || !result.isFinal || !result[0]) continue;
          const text = String(result[0].transcript || '').trim();
          if (!text) continue;
          const echoCandidate = isEchoOfAI(text);
          const speechDecision = shouldAcceptBrowserSpeechResult({
            text,
            aiSpeaking: aiSpeakingRef.current,
            msSinceAiAudioStopped: lastAiAudioStoppedAtRef.current
              ? Date.now() - lastAiAudioStoppedAtRef.current
              : Number.POSITIVE_INFINITY,
            msSinceUserSpeechSignal: lastUserSpeechSignalAtRef.current
              ? Date.now() - lastUserSpeechSignalAtRef.current
              : Number.POSITIVE_INFINITY,
            userSpeechSignalAfterLastAiAudio:
              !lastAiAudioStoppedAtRef.current ||
              lastUserSpeechSignalAtRef.current > lastAiAudioStoppedAtRef.current,
            looksLikeAssistantEcho: echoCandidate,
            aiAudioCooldownMs: BROWSER_SR_AI_AUDIO_COOLDOWN_MS,
            userSpeechWindowMs: BROWSER_SR_USER_SPEECH_WINDOW_MS,
          });
          if (!speechDecision.accept) {
            incrementDroppedEvent(speechDecision.reason);
            continue;
          }
          const key = `browser-sr:${text.toLowerCase().replace(/\s+/g, ' ')}`;
          if (!rememberByTtl(capturedUserRef, key)) {
            addTranscript('user', text, {
              evidence_source: 'browser_speech_fallback',
              trusted_for_evaluation: false,
              transcript_origin: 'browser_speech_fallback',
            });
            markUserSpeechSignal();
          } else {
            incrementDroppedEvent('duplicate_browser_speech_text');
          }
        }
      };

      recognition.onerror = (event) => {
        const code = event?.error || 'unknown';
        incrementDroppedEvent(`browser_speech_error_${code}`);
      };

      recognition.onend = () => {
        if (!browserSpeechShouldRunRef.current) return;
        try {
          recognition.start();
        } catch (e) {
          incrementDroppedEvent('browser_speech_restart_failed');
        }
      };

      browserSpeechRef.current = recognition;
      browserSpeechShouldRunRef.current = true;
      recognition.start();
    } catch (e) {
      incrementDroppedEvent('browser_speech_start_failed');
    }
  }, [addTranscript, incrementDroppedEvent, isEchoOfAI, markUserSpeechSignal, rememberByTtl]);

  // Connect to Realtime API (proven logic from RealtimeTestPage)
  const handleConnect = useCallback(async () => {
    if (status === 'connecting' || status === 'connected' || status === 'ready') {
      return;
    }

    if (!effectiveUser) {
      setError('Please sign in first.');
      return;
    }

    if (!networkOnline) {
      setError('Internet disconnected. Please restore network and try reconnecting.');
      return;
    }

    const isReconnectAttempt = hasJoined && (status === 'disconnected' || status === 'error' || status === 'failed');

    setStatus('connecting');
    setError(null);
    setCaptureWarning(null);
    setContinuityWarning(null);
    transcriptionFallbackNotifiedRef.current = false;
    if (!isReconnectAttempt) {
      setTranscript([]);
      aiMessagesRef.current = [];
      userMessagesRef.current = [];
      turnEvaluationsRef.current = [];
      askedQuestionIdsRef.current = [];
      adaptiveInFlightRef.current = false;
      pendingUserTranscriptRef.current = {};
      finalUserTranscriptItemIdsRef.current = new Set();
      pendingOpeningQuestionRef.current = null;
      pendingOpeningInstructionRef.current = null;
      openingResponseSentRef.current = false;
      sessionConfiguredRef.current = false;
      setIsThinking(false);
      pendingRambleInterruptRef.current = false;
      lastAiSpokenTextRef.current = '';
      lastSentQuestionTextRef.current = '';
      lastAIItemRef.current = null;
      lastCommittedInputItemRef.current = null;
      countedResponseIdsRef.current = new Set();
      lastAiAudioStoppedAtRef.current = 0;
      lastUserSpeechSignalAtRef.current = 0;
      aiSpeakingRef.current = false;
      setAiSpeaking(false);
      transcriptionFallbackNotifiedRef.current = false;
      capturedAiRef.current = new Map();
      capturedUserRef.current = new Map();
      capturedAiResponseIdsRef.current = new Set();
      lastUserTranscriptRef.current = { text: '', at: 0 };
      setMicActive(false);
      setCameraOff(false);
      setSelfViewHidden(false);
    } else {
      // no-op: reconnect attempt, no UI transcript noise
    }
    stopGazeMonitoring();
    stopBrowserSpeechRecognition();
    stopFiller();
    if (!isReconnectAttempt) {
      captureStatsRef.current = {
        captured_user_turns: 0,
        captured_ai_turns: 0,
        dropped_events: {},
      };
    }

    try {
      // Step 1: Get user media
      let stream = localStreamRef.current;
      const hasLiveStream = Boolean(
        stream && stream.getTracks().some((track) => track.readyState === 'live'),
      );
      if (!hasLiveStream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: {
              width: { ideal: 960 },
              height: { ideal: 540 },
              facingMode: 'user'
            }
          });
        } catch (mediaError) {
          if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
            const errorMsg = 'Camera and microphone permissions are required. Please allow access in your browser settings and try again.';
            setError(errorMsg);
            addTranscript('system', errorMsg);
            setStatus('error');
            if (!isReconnectAttempt) {
              setHasJoined(false);
            }
            setShowPermissionModal(true);
            setPermissionError(mediaError);
            return;
          } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
            const errorMsg = 'Camera or microphone not found. Please connect both devices and try again.';
            setError(errorMsg);
            addTranscript('system', errorMsg);
            setStatus('error');
            if (!isReconnectAttempt) {
              setHasJoined(false);
            }
            return;
          } else {
            throw mediaError;
          }
        }
      } else if (isReconnectAttempt) {
        // reusing existing stream, no UI noise needed
      }

      localStreamRef.current = stream;
      setMicActive(false);
      if (localVideoRef.current) {
        try {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play();
        } catch (previewErr) {
          console.warn('Local video preview failed:', previewErr);
        }
      }
      await vad.start(stream);
      await runGazePreflight();

      // Step 2: Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Track connection state
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;

        if (state === 'connected') {
          setStatus('ready');
        } else if (state === 'failed' || state === 'disconnected') {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setStatus('disconnected');
            setError('Internet disconnected. Interview paused. Reconnect when network is back.');
            return;
          }
          setStatus('error');
          setError(`Connection ${state}`);
        }
      };

      pc.oniceconnectionstatechange = () => {
        debugRealtime('[realtime] ICE state:', pc.iceConnectionState);
      };

      // Step 3: Add local audio tracks
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Step 4: Handle remote audio (AI voice)
      const audioElement = new Audio();
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      audioElement.preload = 'auto';
      audioElement.volume = 1;
      audioElementRef.current = audioElement;

      audioElement.onplaying = () => {
        audioResumeActionRef.current = null;
        setCaptureWarning((prev) => (prev === 'audio_blocked' ? null : prev));
      };

      pc.ontrack = async (event) => {
        debugRealtime('[realtime] Remote track received', event);
        audioElement.srcObject = event.streams[0];
        try {
          await audioElement.play();
          audioResumeActionRef.current = null;
          setCaptureWarning((prev) => (prev === 'audio_blocked' ? null : prev));
        } catch (err) {
          console.error('Audio play error:', err);
          if (err?.name === 'NotAllowedError') {
            setCaptureWarning('audio_blocked');
            const resumeAudio = async () => {
              try {
                await audioElement.play();
                audioResumeActionRef.current = null;
                setCaptureWarning((prev) => (prev === 'audio_blocked' ? null : prev));
              } catch (resumeErr) {
                console.error('Audio resume error:', resumeErr);
              }
            };
            audioResumeActionRef.current = resumeAudio;
            window.addEventListener('pointerdown', resumeAudio, { once: true });
          } else {
            setCaptureWarning('audio_blocked');
            setError(`Audio playback failed: ${err.message}`);
          }
        }
      };

      // Step 5: Create DataChannel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      const sendSessionUpdate = () => {
        if (dc.readyState !== 'open') return false;
        dc.send(JSON.stringify(buildRealtimeSessionUpdateEvent({
          voice: REALTIME_VOICE,
          transcriptionModel: TRANSCRIPTION_MODEL,
          interviewServerControlEnabled: INTERVIEW_SERVER_CONTROL_ENABLED,
        })));
        debugRealtime('[realtime] Sent canonical session.update');
        return true;
      };

      const tryStartOpeningTurn = () => {
        const openingQuestion = pendingOpeningQuestionRef.current;
        if (!canSendOpeningPrompt({
          channelState: dcRef.current?.readyState,
          sessionConfigured: sessionConfiguredRef.current,
          openingQuestion,
          openingAlreadySent: openingResponseSentRef.current,
        })) {
          return false;
        }
        const sent = sendRealtimeQuestion(openingQuestion, {
          opening: true,
          instruction: pendingOpeningInstructionRef.current,
        });
        if (sent) {
          openingResponseSentRef.current = true;
          pendingOpeningQuestionRef.current = null;
          pendingOpeningInstructionRef.current = null;
        }
        return sent;
      };

      dc.onopen = () => {
        setStatus('connected');

        if (dc.readyState === 'open') {
          try {
            sendSessionUpdate();
          } catch (err) {
            console.error('Error sending session.update:', err);
          }
        }
      };

      dc.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const msgType = msg?.type || '';
          if (!msgType) {
            debugRealtime('[realtime] Received event without type', msg);
            return;
          }
          debugRealtime('[realtime] Message received:', msgType, msg);

          if (msgType === 'session.created') {
            debugRealtime('[realtime] Session created');
          } else if (msgType === 'session.updated') {
            sessionConfiguredRef.current = true;
            tryStartOpeningTurn();
          } else if (msgType === 'error') {
            const errMsg = msg.error?.message || 'Azure API error';
            if (errMsg.includes("response.modalities")) {
              console.warn('Ignored Azure warning:', errMsg);
              incrementDroppedEvent('azure_unknown_response_modalities');
            } else {
              setError(errMsg);
              addTranscript('system', `Error: ${errMsg}`);
            }
          } else if (msgType === 'conversation.item.input_audio_transcription.failed') {
            incrementDroppedEvent('input_audio_transcription_failed');
            if (!transcriptionFallbackNotifiedRef.current) {
              transcriptionFallbackNotifiedRef.current = true;
              addTranscript('system', 'Realtime transcription failed, browser speech fallback is active.');
              setCaptureWarning('fallback');
            }
            if (ENABLE_BROWSER_SR_FALLBACK && !browserSpeechRef.current) {
              startBrowserSpeechRecognition();
            }
          } else if (msgType === 'response.output_text.delta') {
            if (msg.delta) {
              setAiSpeakingState(true);
            }
          } else if (msgType === 'response.output_text.done') {
            setAiSpeakingState(false);
          } else if (msgType === 'response.output_item.added') {
            try {
              const item = msg.item || {};
              const itemId = item.id || item.item_id || item.itemId || msg.item_id || msg.itemId || null;
              if (itemId) lastAIItemRef.current = itemId;
            } catch (e) {
              debugRealtime('Failed to capture output item id:', e);
            }
          } else if (msgType === 'response.output_audio_transcript.delta') {
            const text = msg.delta || msg.transcript || msg.text || msg.transcript_delta || null;
            if (text) {
              setAiSpeakingState(true);
            }
          } else if (msgType === 'response.output_audio_transcript.done' || msgType === 'response.output_audio_transcript.completed') {
            setAiSpeakingState(false);
            const responseId = msg.response_id || msg.response?.id || 'audio';
            commitAiTranscript(msg.text || msg.transcript, responseId);
          } else if (msgType === 'response.done') {
            setAiSpeakingState(false);
            const responseId = msg.response_id || msg.response?.id || 'done';
            commitAiTranscript(extractResponseDoneText(msg), responseId);
          } else if (msgType === 'response.completed') {
            setAiSpeakingState(false);
            const responseId = msg.response_id || msg.response?.id;
            incrementQuestionCount(responseId);
          } else if (msgType === 'output_audio_buffer.started') {
            setAiSpeakingState(true);
          } else if (msgType === 'output_audio_buffer.stopped') {
            setAiSpeakingState(false);
          }

          // Handle user transcription events (fallbacks + conversation items)
          else if (
            msgType.includes('input_audio_transcription') &&
            msgType.endsWith('.delta')
          ) {
            const itemId = msg.item_id || msg.itemId || msg.conversation_item_id || msg.conversationItemId;
            const delta = typeof msg.delta === 'string' ? msg.delta : '';
            if (itemId && delta && !finalUserTranscriptItemIdsRef.current.has(itemId)) {
              pendingUserTranscriptRef.current[itemId] = `${pendingUserTranscriptRef.current[itemId] || ''}${delta}`;
            }
          }
          else if (
            msgType === 'input_audio_buffer.committed' ||
            msgType === 'input_audio_buffer.commit'
          ) {
            const committedItemId = msg.item_id || msg.itemId || msg.conversation_item_id || null;
            if (committedItemId) {
              lastCommittedInputItemRef.current = committedItemId;
            }
            markUserSpeechSignal();
          } else if (
            (msgType.includes('input_audio_transcription') || msgType.includes('input_audio_buffer.transcription')) &&
            (msgType.endsWith('.completed') || msgType.endsWith('.done') || msgType.endsWith('completed') || msgType.endsWith('done'))
          ) {
            const itemId = msg.item_id || msg.itemId || msg.conversation_item_id || msg.conversationItemId || 'user';
            if (itemId) {
              finalUserTranscriptItemIdsRef.current.add(itemId);
            }
            let text = extractTranscriptText(msg);
            if (!text && itemId && pendingUserTranscriptRef.current[itemId]) {
              text = pendingUserTranscriptRef.current[itemId].trim();
            }
            if (itemId && pendingUserTranscriptRef.current[itemId]) {
              delete pendingUserTranscriptRef.current[itemId];
            }
            commitUserTranscript(text, itemId, {
              evidence_source: 'realtime_input_transcription',
              trusted_for_evaluation: true,
              transcript_origin: 'server_input_transcription',
            });
          } else if (
            msgType === 'conversation.item.added' ||
            msgType === 'conversation.item.done' ||
            msgType === 'conversation.item.created' ||
            msgType === 'conversation.item.completed'
          ) {
            try {
              const parsed = classifyConversationItem({
                msg,
              });
              if (!parsed.text && parsed.itemId && pendingUserTranscriptRef.current[parsed.itemId]) {
                parsed.text = pendingUserTranscriptRef.current[parsed.itemId].trim();
                delete pendingUserTranscriptRef.current[parsed.itemId];
              }

              if (parsed.isUserReply && parsed.text) {
                if (!commitUserTranscript(parsed.text, parsed.itemId || 'item', {
                  evidence_source: 'realtime_conversation_item',
                  trusted_for_evaluation: true,
                  transcript_origin: 'server_conversation_fallback',
                })) {
                  incrementDroppedEvent('duplicate_user_conversation_item');
                }
              } else if (parsed.isAssistantReply && parsed.text) {
                incrementDroppedEvent('assistant_conversation_item');
              } else {
                incrementDroppedEvent(parsed.dropReason || 'unclassified_conversation_item');
              }
            } catch (e) {
              incrementDroppedEvent('conversation_item_parse_error');
              console.warn('Error extracting conversation item text:', e);
            }
          } else if (msg.type === 'input_audio_buffer.speech_started') {
            setMicActive(true);
            markUserSpeechSignal();
          } else if (msg.type === 'input_audio_buffer.speech_stopped') {
            setMicActive(false);
            markUserSpeechSignal();
          }
        } catch (err) {
          console.error('Error parsing message:', err);
          addTranscript('system', `Error parsing message: ${err.message}`);
        }
      };

      dc.onerror = (err) => {
        console.error('DataChannel error:', err);
        setMicActive(false);
        setAiSpeakingState(false);
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setStatus('disconnected');
          setError('Internet disconnected. Interview paused. Reconnect when network is back.');
          return;
        }
        setError('DataChannel error occurred');
      };

      dc.onclose = () => {
        setMicActive(false);
        setAiSpeakingState(false);
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setError('Internet disconnected. Interview paused. Reconnect when network is back.');
        }
        setStatus('disconnected');
      };

      // Step 6: Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Step 7: Send to backend with Clerk auth
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token unavailable for interview session');
      }
      const resp = await authFetch(`${API_BASE_URL}/api/realtime/webrtc`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdpOffer: offer.sdp,
          sessionId: sessionId,
          interviewType: interviewType || 'mixed',
          difficulty: difficulty || 'medium',
          role: targetRole || undefined,
          company: targetCompany || undefined,
          questionMix: questionMix || 'balanced',
          interviewStyle: interviewStyle || 'neutral',
          durationMinutes: durationMinutes || 15,
          selectedSkills: selectedSkills || [],
        })
      });

      if (!resp.ok) {
        const apiError = await buildApiErrorFromResponse(resp, {
          defaultMessage: resp.status === 404
            ? 'Backend route not found (404). Check if server is running and route exists.'
            : `HTTP ${resp.status} from backend`,
        });

        if (apiError.code === 'TRIAL_CODE_REQUIRED') {
          apiError.recoveryTarget = {
            pathname: '/interview-config',
            state: {
              type: interviewType,
              recoveryMessage: apiError.userMessage || 'Redeem a valid trial code before starting.',
            },
          };
        }
        throw apiError;
      }

      const data = await resp.json();
      if (!data.sdpAnswer) {
        throw new Error('No SDP answer in response');
      }
      if (typeof data.effectiveDurationMinutes === 'number' && data.effectiveDurationMinutes > 0) {
        setEffectiveDurationMinutes(data.effectiveDurationMinutes);
      }
      if (typeof data.trialMode === 'boolean') {
        setTrialMode(data.trialMode);
      }
      if (data.planTier) {
        setPlanTier(data.planTier);
      }
      if (Array.isArray(data.selectedSkills)) {
        setSelectedSkills(data.selectedSkills);
      }
      if (
        data.openingQuestionId &&
        !String(data.openingQuestionId).startsWith('followup_') &&
        data.openingQuestionId !== 'fallback_generic' &&
        data.openingQuestionId !== 'fallback_opening'
      ) {
        askedQuestionIdsRef.current = Array.from(
          new Set([...askedQuestionIdsRef.current, data.openingQuestionId]),
        );
      }

      let gazeBootstrap = null;
      try {
        gazeBootstrap = await startGazeMonitoring(token);
      } catch (gazeErr) {
        console.warn('Failed to bootstrap gaze monitoring:', gazeErr);
      }
      if (!gazeBootstrap?.connected) {
        addTranscript('system', 'Gaze monitoring is unavailable at startup.');
      } else if (gazeBootstrap.detectorReady === false) {
        addTranscript('system', 'Gaze detector is limited in this environment.');
      } else {
        addTranscript('system', 'Gaze calibration complete.');
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: data.sdpAnswer });
      if (data.openingQuestion && String(data.openingQuestion).trim()) {
        pendingOpeningQuestionRef.current = String(data.openingQuestion).trim();
        pendingOpeningInstructionRef.current = String(data.openingQuestionInstruction || '').trim();
        tryStartOpeningTurn();
      }

    } catch (err) {
      console.error('Connection error:', err);
      setStatus('error');

      let errorMessage = getApiErrorMessage(err, {
        backendLabel: 'interview service',
        defaultMessage: 'Connection failed',
      });
      if (err.message && err.message.includes('Permission denied')) {
        errorMessage = 'Camera and microphone permissions are required. Please allow access in browser settings and try again.';
      } else if (err.message && err.message.includes('NotAllowedError')) {
        errorMessage = 'Camera and microphone access was denied. Please check your browser permissions and try again.';
      } else if (err.message && err.message.includes('NotFoundError')) {
        errorMessage = 'Camera or microphone was not found. Please connect both devices and try again.';
      } else if (isBackendUnavailableError(err)) {
        errorMessage = 'Cannot reach the interview service. Start the backend server and reconnect.';
      }

      const recoveryTarget = err?.recoveryTarget || null;

      setError(errorMessage);
      addTranscript('system', `Error: ${errorMessage}`);
      if (!isReconnectAttempt) {
        setHasJoined(false);
      }

      // Cleanup on error
      if (localStreamRef.current && !isReconnectAttempt) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      stopGazeMonitoring();
      stopBrowserSpeechRecognition();
      vad.stop();
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (recoveryTarget) {
        navigate(recoveryTarget.pathname, {
          replace: true,
          state: recoveryTarget.state,
        });
        return;
      }
    }
  }, [
    status,
    hasJoined,
    networkOnline,
    addTranscript,
    getToken,
    effectiveUser,
    sessionId,
    interviewType,
    difficulty,
    targetRole,
    targetCompany,
    questionMix,
    interviewStyle,
    durationMinutes,
    selectedSkills,
    navigate,
    sendRealtimeQuestion,
    commitAiTranscript,
    commitUserTranscript,
    incrementQuestionCount,
    incrementDroppedEvent,
    startGazeMonitoring,
    runGazePreflight,
    stopGazeMonitoring,
    startBrowserSpeechRecognition,
    stopBrowserSpeechRecognition,
    setAiSpeakingState,
    markUserSpeechSignal,
    stopFiller,
    vad,
  ]);

  // Build canonical transcript payload (structured/hybrid/raw)
  const buildCanonicalTranscriptPayload = useCallback(() => {
    const pendingUserMessages = Object.values(pendingUserTranscriptRef.current || {})
      .map((value) => String(value || '').trim())
      .filter((text) => text.length > 0)
      .map((text, idx) => ({
        speaker: 'user',
        text,
        timestamp: new Date(Date.now() - (idx + 1) * 100).toISOString(),
        evidence_source: 'pending_transcript_delta',
        trusted_for_evaluation: false,
        transcript_origin: 'pending_input_delta',
      }));
    return buildCanonicalTranscriptPayloadFromMessages({
      aiMessages: aiMessagesRef.current,
      userMessages: userMessagesRef.current,
      pendingUserMessages,
    });
  }, []);

  // Save transcript and generate report with canonical payload
  // eslint-disable-next-line react-hooks/exhaustive-deps -- uses refs which don't need deps
  const saveAndGenerateReport = useCallback(async (options = {}) => {
    try {
      const transcriptPayload = options.transcript || buildCanonicalTranscriptPayload();
      const sessionFeedback = options.sessionFeedback || null;
      const captureStats = captureStatsRef.current || {};
      
      console.log('📦 Transcript payload:', JSON.stringify(transcriptPayload, null, 2));
      console.log('[capture-summary]', captureStats);

      // If absolutely no messages, cannot save
      if (transcriptPayload.raw_messages.length === 0) {
        setCaptureWarning('no_audio');
        throw createSessionEndError(
          SESSION_END_ERROR_CODES.EMPTY_CAPTURE,
          'No interview turns were captured. We did not generate a report. Resume the interview and answer at least one question before ending the session.'
        );
      }

      // Calculate metrics (user-centric)
      const userMessages = transcriptPayload.raw_messages.filter((entry) => {
        const speaker = String(entry.speaker || '').toLowerCase();
        return speaker === 'user' || speaker === 'candidate';
      });
      const aiMessages = transcriptPayload.raw_messages.filter((entry) => {
        const speaker = String(entry.speaker || '').toLowerCase();
        return speaker === 'ai' || speaker === 'interviewer' || speaker === 'sonia';
      });

      const userWordCount = userMessages.reduce((sum, entry) => {
        return sum + (entry.text ? entry.text.split(/\s+/).length : 0);
      }, 0);
      const aiWordCount = aiMessages.reduce((sum, entry) => {
        return sum + (entry.text ? entry.text.split(/\s+/).length : 0);
      }, 0);

      const durationMinutes = Math.max(1, Math.round(timeElapsed / 60));
      const answeredCount = Math.max(transcriptPayload.qa_pairs.length, userMessages.length);
      const eyeContactMetric = Number.isFinite(gazeMetrics.eyeContactPct) ? gazeMetrics.eyeContactPct : null;

      if (userMessages.length === 0 || userWordCount === 0) {
        setCaptureWarning('no_audio');
        throw createSessionEndError(
          SESSION_END_ERROR_CODES.NO_CANDIDATE_AUDIO,
          'No candidate answer was captured. We did not generate a report. Please verify microphone and transcript capture, then try again.'
        );
      }

      // Auth header
      let headers = { 'Content-Type': 'application/json' };
      try {
        const token = await getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (authErr) {
        console.warn('Could not get auth token:', authErr);
      }

      // Send canonical transcript payload
      const token = await getToken();

      const captureResp = await authFetch(`${API_BASE_URL}/api/interview/${sessionId}/capture`, token, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          trusted_transcript: transcriptPayload.trusted_raw_messages || [],
          fallback_transcript: transcriptPayload.fallback_raw_messages || [],
          word_timestamps: [],
          capture_integrity: transcriptPayload.capture_integrity || {},
          transcript_origin: 'server_transcript',
          evaluation_source: 'server_transcript',
        }),
      });

      if (!captureResp.ok && captureResp.status !== 404) {
        const captureError = await buildApiErrorFromResponse(captureResp, {
          defaultMessage: 'We could not persist trusted interview evidence. Please retry.',
        });
        console.error('❌ Capture persistence failed:', captureError);
        throw captureError;
      }

      const saveResp = await authFetch(`${API_BASE_URL}/api/interview/${sessionId}/transcript`, token, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          session_id: sessionId,
          transcript: transcriptPayload,
          turn_evaluations: turnEvaluationsRef.current,
          interview_type: interviewType || 'mixed',
          duration_minutes: durationMinutes,
          questions_answered: answeredCount,
          metrics: {
            questions_answered: answeredCount,
            total_words: userWordCount,
            ai_total_words: aiWordCount,
            candidate_word_count: userWordCount,
            interviewer_word_count: aiWordCount,
            total_duration: durationMinutes,
            speaking_time: durationMinutes * 60,
            silence_time: 0,
            eye_contact_pct: eyeContactMetric,
            session_feedback: sessionFeedback,
            turn_evaluations: turnEvaluationsRef.current,
            duration_minutes_requested: durationMinutes,
            duration_minutes_effective: effectiveDurationMinutes,
            trial_mode: trialMode,
            plan_tier: planTier,
            asked_question_ids: askedQuestionIdsRef.current,
            selected_skills: selectedSkills,
            capture_stats: captureStats,
          },
          session_feedback: sessionFeedback,
          meta: {
            ended_at: new Date().toISOString(),
            client_version: '2.0.0-production-grade',
            duration_minutes_requested: durationMinutes,
            duration_minutes_effective: effectiveDurationMinutes,
            trial_mode: trialMode,
            plan_tier: planTier,
            adaptive_asked_question_ids: askedQuestionIdsRef.current,
            selected_skills: selectedSkills,
            capture_stats: captureStats,
          }
        })
      });

      if (!saveResp.ok) {
        const saveError = await buildApiErrorFromResponse(saveResp, {
          defaultMessage: 'We could not save this interview report. Please retry.',
        });
        console.error('❌ Transcript save failed:', saveError);
        throw saveError;
      }

      const raw = await saveResp.text();
      console.log("📦 RAW transcript response:", raw);

      let data = {};
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.error("❌ Failed to parse JSON from backend");
        throw new Error('Invalid response from backend');
      }

      console.log('✅ Parsed transcript response:', data);
      if (data.capture_status || data.evaluation_source) {
        console.log('[evaluation-summary]', {
          capture_status: data.capture_status,
          evaluation_source: data.evaluation_source,
          turns_evaluated: data.turns_evaluated,
          contract_passed: data.contract_passed,
          validation_flags: data.validation_flags,
        });
      }
      if (data.contract_passed === false) {
        console.warn('[evaluation-contract]', {
          contract_passed: false,
          validation_flags: data.validation_flags || [],
        });
      }

      if (!data.report_id) {
        throw new Error('Backend did not return report_id');
      }

      console.log("📄 Report ID:", data.report_id);

      return data;

    } catch (err) {
      console.error('❌ Error saving report:', err);
      throw err;
    }
  }, [sessionId, getToken, interviewType, timeElapsed, buildCanonicalTranscriptPayload, effectiveDurationMinutes, trialMode, planTier, selectedSkills, gazeMetrics.eyeContactPct]);

  // Production-grade disconnect flow with single-flight guard and drain
  const runSaveFlow = useCallback(async (sessionFeedback = null) => {
    // Drain in-flight messages before building transcript payload
    console.log('[runSaveFlow] Starting drain...');
    const drainStart = Date.now();
    const quietMs = 700;
    const timeoutMs = 4500;
    while (Date.now() - drainStart < timeoutMs) {
      const quietFor = Date.now() - lastMessageAtRef.current;
      const hasPendingTranscriptDeltas = Object.keys(pendingUserTranscriptRef.current || {}).length > 0;
      if (quietFor >= quietMs && !hasPendingTranscriptDeltas) {
        console.log(`[Drain] Quiescence reached after ${Date.now() - drainStart}ms`);
        break;
      }
      await sleep(50);
    }

    // Flush gaze WS with an explicit finalize handshake so persisted gaze state is complete.
    await finalizeGazeMonitoring();

    const transcriptPayload = buildCanonicalTranscriptPayload();
    isEndingRef.current = true;
    pendingTranscriptPayloadRef.current = transcriptPayload;

    console.log('[runSaveFlow] Calling saveAndGenerateReport...');
    const saveData = await saveAndGenerateReport({ transcript: transcriptPayload, sessionFeedback });
    return saveData;
  }, [buildCanonicalTranscriptPayload, finalizeGazeMonitoring, saveAndGenerateReport]);

  const handleDisconnect = useCallback(async (sessionFeedback = null) => {
    // Single-flight guard
    if (endInProgressRef.current) {
      console.log('[handleDisconnect] Already in progress, ignoring');
      return;
    }

    endInProgressRef.current = true;
    setStatus('ending');
    setEndError(null);

    try {
      const saveData = await runSaveFlow(sessionFeedback);
      const reportId = saveData?.report_id;

      // Close connections only AFTER successful save
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      stopGazeMonitoring();
      stopBrowserSpeechRecognition();
      if (dcRef.current) {
        dcRef.current.close();
        dcRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
        audioElementRef.current = null;
      }
      audioResumeActionRef.current = null;
      vad.stop();
      stopFiller();

      setStatus('idle');
      setMicActive(false);
      setAiSpeakingState(false);
      endInProgressRef.current = false;

      navigate(`/report/${reportId}`, {
        state: {
          openFeedbackDialog: true,
          contractWarning: saveData?.contract_passed === false
            ? {
                validation_flags: saveData?.validation_flags || [],
                message: 'Score forced to 0 due to missing or invalid evaluation evidence.',
              }
            : null,
        },
      });

    } catch (err) {
      console.error('[handleDisconnect] Save failed:', err);
      setEndError(err);
      setShowEndErrorDialog(true);
      setStatus('connected'); // Revert to allow retry
      isEndingRef.current = false;
      // DO NOT close connections - keep them alive for retry
      // DO NOT reset endInProgressRef - modal controls that
    } finally {
    }
  }, [runSaveFlow, navigate, setAiSpeakingState, stopBrowserSpeechRecognition, stopFiller, stopGazeMonitoring, vad]);

  // Retry handler
  const handleRetryEnd = useCallback(async () => {
    setEndError(null);
    setShowEndErrorDialog(false);

    try {
      const saveData = await runSaveFlow();
      const reportId = saveData?.report_id;

      // Close connections after successful retry
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      stopGazeMonitoring();
      stopBrowserSpeechRecognition();
      if (dcRef.current) {
        dcRef.current.close();
        dcRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
        audioElementRef.current = null;
      }
      audioResumeActionRef.current = null;
      vad.stop();
      stopFiller();

      setStatus('idle');
      setAiSpeakingState(false);
      endInProgressRef.current = false;

      navigate(`/report/${reportId}`, {
        state: {
          openFeedbackDialog: true,
          contractWarning: saveData?.contract_passed === false
            ? {
                validation_flags: saveData?.validation_flags || [],
                message: 'Score forced to 0 due to missing or invalid evaluation evidence.',
              }
            : null,
        },
      });

    } catch (err) {
      console.error('[handleRetryEnd] Retry failed:', err);
      setEndError(err);
      setShowEndErrorDialog(true);
      isEndingRef.current = false;
    } finally {
    }
  }, [runSaveFlow, navigate, setAiSpeakingState, stopBrowserSpeechRecognition, stopGazeMonitoring, stopFiller, vad]);

  const handleResumeInterview = useCallback(() => {
    setEndError(null);
    setShowEndErrorDialog(false);
    setStatus('connected');
    endInProgressRef.current = false;
    isEndingRef.current = false;
  }, []);

  // End without saving handler
  const handleEndWithoutSaving = useCallback(async () => {
    setShowEndErrorDialog(false);

    try {
      // Close all connections
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      stopGazeMonitoring();
      stopBrowserSpeechRecognition();
      if (dcRef.current) {
        dcRef.current.close();
        dcRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
        audioElementRef.current = null;
      }
      audioResumeActionRef.current = null;
      vad.stop();
      stopFiller();
    } finally {
      setStatus('idle');
      setMicActive(false);
      setAiSpeakingState(false);
      endInProgressRef.current = false;
      isEndingRef.current = false;
      pendingTranscriptPayloadRef.current = null;
      navigate('/dashboard');
    }
  }, [navigate, setAiSpeakingState, stopBrowserSpeechRecognition, stopFiller, stopGazeMonitoring, vad]);

  const gazeStatus = useMemo(() => {
    const liveFlag = mapLiveGazeFlag(gazeMetrics.activeFlag, gazeMetrics.gazeDirection);
    if (cameraOff) {
      return { label: 'Camera Off', tone: 'warn' };
    }
    if (!gazeMetrics.connected) {
      if (status === 'connecting' && gazeMetrics.detectorReady) {
        return { label: 'Gaze Ready', tone: 'ok' };
      }
      return { label: 'Gaze Offline', tone: 'neutral' };
    }
    if (!gazeMetrics.detectorReady) {
      return { label: 'Detector Unavailable', tone: 'neutral' };
    }
    if (!gazeMetrics.faceDetected && !liveFlag) {
      return { label: 'Face Not Detected', tone: 'warn' };
    }
    if (!Number.isFinite(gazeMetrics.eyeContactPct)) {
      const progress = Math.max(0, Math.min(100, Number(gazeMetrics.calibrationProgress || 0)));
      return { label: progress > 0 ? `Calibrating ${progress}%` : 'Calibrating', tone: 'neutral' };
    }
    if (liveFlag === 'FACE_NOT_VISIBLE') {
      return { label: 'Face Not Visible', tone: 'warn' };
    }
    if (liveFlag === 'LOOKING_DOWN') {
      return { label: 'Looking Down', tone: 'warn' };
    }
    if (liveFlag === 'LOOKING_UP') {
      return { label: 'Looking Up', tone: 'warn' };
    }
    if (liveFlag === 'OFF_SCREEN') {
      return { label: 'Looking Away', tone: 'warn' };
    }
    return { label: 'On Screen', tone: 'ok' };
  }, [cameraOff, gazeMetrics, status]);

  const stageAssistLabel = useMemo(() => {
    if (status === 'connecting' || status === 'idle') {
      return 'Connecting Sonia and preparing the interview session.';
    }
    if (cameraOff) {
      return 'Camera is off. Turn it back on if you want gaze tracking and a full interview recording setup.';
    }
    if (gazeMetrics.detectorReady && gazeMetrics.calibrationState !== 'complete') {
      const progress = Math.max(0, Math.min(100, Number(gazeMetrics.calibrationProgress || 0)));
      return progress > 0
        ? `Center your face and look toward Sonia for a moment. Gaze calibration is ${progress}% complete.`
        : 'Center your face and look toward Sonia for a moment so gaze calibration can finish.';
    }
    if (gazeMetrics.detectorReady && !gazeMetrics.faceDetected) {
      return 'Keep your full face in frame. The system tracks eye direction as well as face presence.';
    }
    if (captureWarning === 'audio_blocked') {
      return 'Browser audio is blocked. Use the stage button to enable Sonia playback before continuing.';
    }
    if (isThinking && currentFiller?.text) {
      return `Sonia is thinking aloud: ${currentFiller.text}`;
    }
    if (aiSpeaking) {
      return 'Sonia is speaking. Let the question finish, then answer directly and stay specific.';
    }
    if (micActive) {
      return 'We are listening now. Finish your point cleanly and keep your examples concrete.';
    }
    if (captureWarning === 'no_audio') {
      return 'No candidate speech has been captured yet. Check your mic, browser permissions, and transcript flow.';
    }
    if (status === 'connected' || status === 'ready') {
      return 'Sonia is waiting. Answer directly, stay concrete, and stop once your point is made.';
    }
    return 'Interview session ready.';
  }, [aiSpeaking, cameraOff, captureWarning, currentFiller?.text, gazeMetrics.calibrationProgress, gazeMetrics.calibrationState, gazeMetrics.detectorReady, gazeMetrics.faceDetected, isThinking, micActive, status]);

  const stageStatusLabel = useMemo(() => {
    if (status === 'connecting' || status === 'idle') {
      return 'Connecting';
    }
    if (status === 'error' || status === 'disconnected' || status === 'failed') {
      return 'Reconnect Needed';
    }
    if (aiSpeaking) {
      return 'Sonia Speaking';
    }
    if (micActive) {
      return 'Listening';
    }
    if (status === 'connected' || status === 'ready') {
      return 'Live';
    }
    return 'Ready';
  }, [aiSpeaking, micActive, status]);

  const runtimeBadges = useMemo(() => {
    const badges = [];
    if (hasJoined && status === 'connecting') {
      badges.push({ label: 'Resuming', tone: 'neutral' });
    }
    if (continuityWarning?.message || captureWarning || status === 'error' || status === 'disconnected' || status === 'failed') {
      badges.push({ label: 'Recovery Mode', tone: 'warn' });
    }
    if (isThinking) {
      badges.push({ label: 'Thinking', tone: 'neutral' });
    }
    if (aiSpeaking || fillerIsPlaying) {
      badges.push({ label: 'Sonia Speaking', tone: 'live' });
    }
    if (micActive) {
      badges.push({ label: 'Listening', tone: 'ok' });
    }
    if (!badges.length) {
      badges.push({ label: stageStatusLabel, tone: 'neutral' });
    }
    return badges;
  }, [
    aiSpeaking,
    captureWarning,
    continuityWarning?.message,
    fillerIsPlaying,
    hasJoined,
    isThinking,
    micActive,
    stageStatusLabel,
    status,
  ]);

  const handleResumeSoniaAudio = useCallback(async () => {
    try {
      if (audioResumeActionRef.current) {
        await audioResumeActionRef.current();
      }
    } catch (err) {
      console.error('Audio resume CTA failed:', err);
    }
  }, []);

  if (!effectiveUser) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Please sign in to access the interview.</Typography>
      </Box>
    );
  }

  const endErrorPresentation = getEndErrorPresentation(endError);
  const showCaptureRecoveryAction = isCaptureEndError(endError);

  return (
    <div className="session-shell meet-shell">
      {/* Top Bar */}
      <div className="session-topbar meet-topbar">
        <div className="meet-topbar-left">
          <Typography style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
            Interview Session
          </Typography>
          <span className="meet-subtle">
            {interviewType} • {effectiveDurationMinutes}m target ({planTier})
          </span>
        </div>
        <div className="meet-topbar-right" aria-hidden="true" />
      </div>

      {(status === 'error' || status === 'disconnected' || status === 'failed') && (
        <div className="meet-conn-banner">
          {networkOnline
            ? 'Connection issue detected. Click Reconnect to continue.'
            : 'Internet disconnected. Interview is paused until your network returns.'}
        </div>
      )}

      {captureWarning === 'fallback' && (
        <div className="meet-capture-banner meet-capture-banner--warn">
          ⚠️ Transcription issue detected — browser fallback is active. Check your microphone and browser permissions.
        </div>
      )}
      {captureWarning === 'no_audio' && (
        <div className="meet-capture-banner meet-capture-banner--error">
          🎙️ No speech detected yet. Please check your microphone is unmuted and permissions are granted.
        </div>
      )}
      {captureWarning === 'audio_blocked' && (
        <div className="meet-capture-banner meet-capture-banner--warn">
          🔊 Sonia audio is blocked by the browser. Use the stage button to enable playback.
        </div>
      )}
      {continuityWarning?.message && (
        <div className={`meet-capture-banner ${continuityWarning.tone === 'error' ? 'meet-capture-banner--error' : 'meet-capture-banner--warn'}`}>
          {continuityWarning.message}
        </div>
      )}

      <div className="meet-runtime-badges" aria-label="Interview status">
        {runtimeBadges.map((badge) => (
          <span key={badge.label} className={`meet-runtime-badge ${badge.tone}`}>
            {badge.label}
          </span>
        ))}
      </div>

      {/* Main Stage */}
      <div className="meet-stage-wrap">
        <div className="meet-stage">
        <div className={`meet-gaze-badge ${gazeStatus.tone}`}>
          {gazeStatus.label}
        </div>
          <div className="meet-stage-meta">
            <span>{interviewType}</span>
            <span>•</span>
            <span>{effectiveDurationMinutes}m target</span>
            <span>•</span>
            <span>{stageStatusLabel}</span>
          </div>
          <div className={`meet-avatar-ring ${aiSpeaking ? 'speaking' : ''} ${status === 'connecting' || status === 'idle' ? 'idle' : ''}`}>
            {soniaAvatarSrc && !avatarLoadError && (
              <img
                src={soniaAvatarSrc}
                alt="Sonia interviewer avatar"
                className={`meet-sonia-avatar-image ${aiSpeaking ? 'speaking' : 'idle'}`}
                onError={() => setAvatarLoadError(true)}
                onLoad={() => setAvatarLoadError(false)}
              />
            )}
            {avatarLoadError && (
              <div className="meet-sonia-orb" aria-hidden="true">
                <div className="meet-sonia-ring outer" />
                <div className="meet-sonia-ring" />
                <div className="meet-sonia-core" />
                <div className="meet-sonia-wave">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>
          <div className="meet-nameplate">Sonia</div>
          <div className="meet-agent-status">{stageAssistLabel}</div>
          {captureWarning === 'audio_blocked' && (
            <div className="meet-stage-audio-cta">
              <div className="meet-stage-audio-copy">Sonia is connected. Browser autoplay is blocking her voice.</div>
              <Button variant="contained" onClick={handleResumeSoniaAudio}>
                Enable Sonia Audio
              </Button>
            </div>
          )}
          <div className={`meet-stage-status ${micActive ? 'listening' : aiSpeaking ? 'speaking' : ''}`}>
            {stageStatusLabel}
          </div>
          {hasJoined && (
            <div className={`meet-self-view ${selfViewHidden ? 'collapsed' : ''}`}>
              <div className="meet-self-header">
                <div className="meet-self-meta">
                  <span>You</span>
                  <span className={`meet-self-chip ${(micMuted || cameraOff) ? 'warn' : micActive ? 'live' : 'ok'}`}>
                    {micMuted ? 'Mic Off' : 'Mic On'} · {cameraOff ? 'Cam Off' : 'Cam On'} · {micActive ? 'Listening' : aiSpeaking ? 'Sonia Live' : 'Ready'}
                  </span>
                </div>
                <div className="meet-self-actions">
                  <button
                    type="button"
                    className={`meet-self-action-btn ${micMuted ? 'off' : 'on'}`}
                    onClick={() => setMicMuted(prev => !prev)}
                    aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                    title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {micMuted ? <MicOff fontSize="inherit" /> : <Mic fontSize="inherit" />}
                  </button>
                  <button
                    type="button"
                    className={`meet-self-action-btn ${cameraOff ? 'off' : 'on'}`}
                    onClick={() => setCameraOff(prev => !prev)}
                    aria-label={cameraOff ? 'Turn on camera' : 'Turn off camera'}
                    title={cameraOff ? 'Turn on camera' : 'Turn off camera'}
                  >
                    {cameraOff ? <VideocamOff fontSize="inherit" /> : <Videocam fontSize="inherit" />}
                  </button>
                  <button
                    type="button"
                    className="meet-self-toggle"
                    onClick={() => setSelfViewHidden((prev) => !prev)}
                    aria-label={selfViewHidden ? 'Expand self view' : 'Collapse self view'}
                  >
                    {selfViewHidden ? 'Show' : 'Hide'}
                  </button>
                </div>
              </div>
              <video
                ref={localVideoRef}
                className={`meet-self-video ${cameraOff ? 'off' : ''} ${selfViewHidden ? 'preview-hidden' : ''}`}
                autoPlay
                muted
                playsInline
              />
              {!selfViewHidden && cameraOff && (
                <div className="meet-self-video-overlay">Camera Off</div>
              )}
            </div>
          )}
          <canvas ref={gazeCanvasRef} className="meet-hidden-canvas" />
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="meet-controls">
        {!hasJoined ? (
          <div className="meet-controls-row">
            <Button
              variant="contained"
              onClick={() => {
                setHasJoined(true);
                handleConnect();
              }}
              disabled={hasJoined || !networkOnline || status === 'connecting' || status === 'connected' || status === 'ready'}
              sx={{ minWidth: { xs: '170px', md: '200px' }, borderRadius: '999px', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' }, fontSize: { xs: '14px', md: '15px' }, fontWeight: 600, padding: { xs: '10px 22px', md: '10px 30px' }, textTransform: 'none' }}
            >
              Join Interview
            </Button>
          </div>
        ) : (
          <div className="meet-controls-row">
            {(status === 'error' || status === 'disconnected' || status === 'failed') && (
              <Button
                variant="outlined"
                onClick={handleConnect}
                disabled={!networkOnline || status === 'connecting' || endInProgressRef.current}
                sx={{ borderRadius: '999px', textTransform: 'none', minWidth: '120px' }}
              >
                Reconnect
              </Button>
            )}
            <button
              type="button"
              className="meet-control-btn end"
              onClick={() => handleDisconnect()}
              disabled={endInProgressRef.current}
              aria-label="End call"
              title="End call"
            >
              <CallEnd />
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="meet-error">
          {error}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Permission Modal */}
      <Dialog
        open={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Camera and Microphone Access Required</DialogTitle>
        <DialogContent>
          <Typography>
            This interview requires camera and microphone access. Please allow both permissions to continue.
            {permissionError && (
              <Box sx={{ mt: 2, p: 2, background: '#fef2f2', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: '#991b1b' }}>
                  Error: {permissionError.message || permissionError.name}
                </Typography>
              </Box>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPermissionModal(false)}>Close</Button>
          <Button onClick={() => setShowPermissionModal(false)} variant="contained">
            Try Again
          </Button>
        </DialogActions>
      </Dialog>

      {/* Retry Error Dialog */}
      <Dialog open={showEndErrorDialog} onClose={() => {}} disableEscapeKeyDown>
        <DialogTitle>{endErrorPresentation.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {endErrorPresentation.description}
          </Typography>
          {endError && (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 12, color: '#ef4444' }}>
              {String(endError?.message || endError)}
            </pre>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEndWithoutSaving} color="error">
            End Without Saving
          </Button>
          <Button
            onClick={showCaptureRecoveryAction ? handleResumeInterview : handleRetryEnd}
            variant="contained"
            autoFocus
          >
            {endErrorPresentation.primaryActionLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
