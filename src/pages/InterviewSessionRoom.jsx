import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';
import { authFetch } from '../utils/apiClient';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { classifyConversationItem, extractTranscriptText } from '../utils/realtimeTranscript';
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
  Avatar,
  Box,
} from '@mui/material';
import '../ui.css';

const API_BASE_URL = getApiBaseUrl();
const REALTIME_VOICE = (process.env.REACT_APP_REALTIME_VOICE || 'alloy').trim() || 'alloy';
const ADAPTIVE_MANUAL_TURN_CONTROL = String(process.env.REACT_APP_ADAPTIVE_MANUAL_TURN_CONTROL || 'false').toLowerCase() === 'true';
const ENABLE_BROWSER_SR_FALLBACK = String(process.env.REACT_APP_ENABLE_BROWSER_SR_FALLBACK || 'true').toLowerCase() === 'true';
const DUAL_TRANSCRIPTION_KEYS = String(process.env.REACT_APP_REALTIME_SESSION_DUAL_TRANSCRIPTION_KEYS || 'true').toLowerCase() === 'true';
const TRANSCRIPTION_MODEL = (process.env.REACT_APP_REALTIME_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe').trim() || 'gpt-4o-mini-transcribe';
const DEDUPE_TTL_MS = 8000;

export default function InterviewSessionRoom() {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();

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
  const [difficulty, setDifficulty] = useState('medium');
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [questionMix, setQuestionMix] = useState('balanced');
  const [interviewStyle, setInterviewStyle] = useState('neutral');
  const [planTier, setPlanTier] = useState('trial');
  const [trialMode, setTrialMode] = useState(true);

  useEffect(() => {
    const config = sessionStorage.getItem('interviewConfig');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setInterviewType(parsed.type || typeFromUrl || 'behavioral');
        const configuredDuration = parsed.duration ? parseInt(parsed.duration, 10) : 15;
        setDurationMinutes(configuredDuration);
        setEffectiveDurationMinutes(configuredDuration);
        setDifficulty(parsed.difficulty || 'medium');
        setTargetRole(parsed.role || '');
        setTargetCompany(parsed.company || '');
        setQuestionMix(parsed.questionMix || 'balanced');
        setInterviewStyle(parsed.interviewStyle || 'neutral');
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
  const audioElementRef = useRef(null);

  // State
  const [status, setStatus] = useState('idle');
  const [, setMicActive] = useState(false);
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
  const capturedAiRef = useRef(new Map());
  const capturedUserRef = useRef(new Map());

  // Collect all AI and user messages for saving
  const aiMessagesRef = useRef([]);
  const userMessagesRef = useRef([]);
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
  const transcriptionReapplyAttemptedRef = useRef(false);
  const browserSpeechRef = useRef(null);
  const browserSpeechShouldRunRef = useRef(false);
  const lastUserTranscriptRef = useRef({ text: '', at: 0 });
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
  const pendingTranscriptPayloadRef = useRef(null);

  // Utility
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const incrementDroppedEvent = useCallback((reason) => {
    if (!reason) return;
    const stats = captureStatsRef.current;
    const key = String(reason);
    stats.dropped_events[key] = (stats.dropped_events[key] || 0) + 1;
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

  // Add transcript entry
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callback uses refs only; adding state deps would re-register listeners
  const addTranscript = useCallback((speaker, text) => {
    const ts = new Date().toISOString();
    console.log(`[addTranscript] speaker: ${speaker}, text:`, text);
    
    // Update drain tracking
    lastMessageAtRef.current = Date.now();
    
    setTranscript(prev => [...prev, {
      speaker,
      text,
      timestamp: ts
    }]);

    // Also collect for saving (refs are source of truth)
    if (speaker === 'ai') {
      aiMessagesRef.current.push({ speaker: 'ai', text, timestamp: ts });
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
      userMessagesRef.current.push({ speaker: 'user', text, timestamp: ts });
      captureStatsRef.current.captured_user_turns += 1;
      console.log(`[addTranscript] userMessagesRef now:`, JSON.stringify(userMessagesRef.current, null, 2));
      if (!isEndingRef.current && typeof requestAdaptiveTurnRef.current === 'function') {
        requestAdaptiveTurnRef.current(text, ts);
      }
    }
  }, [incrementDroppedEvent]);

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

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !micMuted;
    });
  }, [micMuted]);

  const requestAdaptiveTurn = useCallback(async (userTurnText) => {
    if (!userTurnText || !userTurnText.trim()) return;
    if (adaptiveInFlightRef.current) return;
    if (isEndingRef.current) return;
    if (!dcRef.current || dcRef.current.readyState !== 'open') return;

    adaptiveInFlightRef.current = true;
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

      const resp = await authFetch(`${API_BASE_URL}/api/interview/${sessionId}/adaptive-turn`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.warn('[adaptive-turn] failed:', resp.status, text);
        return;
      }

      const decision = await resp.json();
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

      if (ADAPTIVE_MANUAL_TURN_CONTROL && decision?.next_question && dcRef.current && dcRef.current.readyState === 'open') {
        dcRef.current.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              instructions: decision.next_question,
            },
          }),
        );
      }
    } catch (err) {
      console.warn('[adaptive-turn] error:', err);
    } finally {
      adaptiveInFlightRef.current = false;
    }
  }, [
    getToken,
    sessionId,
    interviewType,
    difficulty,
    targetRole,
    targetCompany,
    questionMix,
    interviewStyle,
    durationMinutes,
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
          const key = `browser-sr:${text.toLowerCase().replace(/\s+/g, ' ')}`;
          if (!rememberByTtl(capturedUserRef, key)) {
            addTranscript('user', text);
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
      addTranscript('system', 'Browser speech fallback enabled');
    } catch (e) {
      incrementDroppedEvent('browser_speech_start_failed');
    }
  }, [addTranscript, incrementDroppedEvent, rememberByTtl]);

  // Connect to Realtime API (proven logic from RealtimeTestPage)
  const handleConnect = useCallback(async () => {
    if (status === 'connecting' || status === 'connected' || status === 'ready') {
      return;
    }

    if (!user) {
      setError('Please sign in first.');
      return;
    }

    setStatus('connecting');
    setError(null);
    setTranscript([]);
    aiMessagesRef.current = [];
    userMessagesRef.current = [];
    turnEvaluationsRef.current = [];
    askedQuestionIdsRef.current = [];
    adaptiveInFlightRef.current = false;
    pendingUserTranscriptRef.current = {};
    finalUserTranscriptItemIdsRef.current = new Set();
    transcriptionReapplyAttemptedRef.current = false;
    capturedAiRef.current = new Map();
    capturedUserRef.current = new Map();
    stopBrowserSpeechRecognition();
    captureStatsRef.current = {
      captured_user_turns: 0,
      captured_ai_turns: 0,
      dropped_events: {},
    };

    try {
      // Step 1: Get user media
      addTranscript('system', 'Requesting microphone permission...');
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      } catch (mediaError) {
        if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
          const errorMsg = 'Microphone permission denied. Please allow microphone access in your browser settings and try again.';
          setError(errorMsg);
          addTranscript('system', errorMsg);
          setStatus('error');
          setShowPermissionModal(true);
          setPermissionError(mediaError);
          return;
        } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
          const errorMsg = 'No microphone found. Please connect a microphone and try again.';
          setError(errorMsg);
          addTranscript('system', errorMsg);
          setStatus('error');
          return;
        } else {
          throw mediaError;
        }
      }

      localStreamRef.current = stream;
      setMicActive(true);
      addTranscript('system', 'Microphone access granted');
      startBrowserSpeechRecognition();

      // Step 2: Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Track connection state
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        addTranscript('system', `Connection state: ${state}`);

        if (state === 'connected') {
          setStatus('ready');
        } else if (state === 'failed' || state === 'disconnected') {
          setStatus('error');
          setError(`Connection ${state}`);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        addTranscript('system', `ICE state: ${iceState}`);
      };

      // Step 3: Add local audio tracks
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Step 4: Handle remote audio (AI voice)
      const audioElement = new Audio();
      audioElementRef.current = audioElement;

      pc.ontrack = async (event) => {
        console.log('Remote track received', event);
        audioElement.srcObject = event.streams[0];
        try {
          await audioElement.play();
          addTranscript('system', 'Audio playback started');
        } catch (err) {
          console.error('Audio play error:', err);
          setError(`Audio playback failed: ${err.message}`);
        }
      };

      // Step 5: Create DataChannel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      const sendSessionUpdate = (forceDualKeys = DUAL_TRANSCRIPTION_KEYS) => {
        if (dc.readyState !== 'open') return false;
        const sessionPayload = {
          type: 'session.update',
          session: {
            type: 'realtime',
            audio: {
              input: {
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.55,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                  create_response: true,
                  interrupt_response: true,
                },
                transcription: {
                  model: TRANSCRIPTION_MODEL,
                  language: 'en',
                },
              },
              output: {
                voice: REALTIME_VOICE,
              },
            },
          },
        };

        if (forceDualKeys) {
          sessionPayload.session.turn_detection = {
            type: 'server_vad',
            threshold: 0.55,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: true,
            interrupt_response: true,
          };
          sessionPayload.session.input_audio_transcription = {
            model: TRANSCRIPTION_MODEL,
            language: 'en',
          };
        }

        dc.send(JSON.stringify(sessionPayload));
        addTranscript(
          'system',
          `Sent session.update (voice=${REALTIME_VOICE}, transcription=${TRANSCRIPTION_MODEL}, dualKeys=${forceDualKeys ? 'on' : 'off'})`,
        );
        return true;
      };

      dc.onopen = () => {
        addTranscript('system', 'DataChannel opened');
        setStatus('connected');

        // Send session.update with turn detection
        if (dc.readyState === 'open') {
          try {
            sendSessionUpdate(DUAL_TRANSCRIPTION_KEYS);
          } catch (err) {
            console.error('Error sending session.update:', err);
          }

          // Send initial response.create (no modalities - configured on session)
          try {
            dc.send(JSON.stringify({
              type: 'response.create',
              response: {
                instructions: "Introduce yourself as Sonia and ask the first interview question in English. Speak clearly at a slightly slower pace with short pauses."
              }
            }));
            addTranscript('system', 'Sent response.create');
          } catch (err) {
            console.error('Error sending response.create:', err);
          }
        }
      };

      dc.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          console.log('Message received:', msg.type, msg);
          const msgType = msg?.type || '';
          if (!msgType) {
            console.debug('[realtime] Received event without type', msg);
            return;
          }

          // Handle messages
          if (msgType === 'session.created') {
            addTranscript('system', 'Azure session created');
          } else if (msgType === 'session.updated') {
            const configuredVoice =
              msg?.session?.audio?.output?.voice ||
              msg?.session?.voice ||
              REALTIME_VOICE;
            const hasTranscriptionConfig = Boolean(
              msg?.session?.input_audio_transcription ||
              msg?.session?.audio?.input?.transcription
            );
            addTranscript(
              'system',
              `Session updated (voice=${configuredVoice}, transcription=${hasTranscriptionConfig ? 'enabled' : 'missing'})`
            );
            if (!hasTranscriptionConfig && !transcriptionReapplyAttemptedRef.current) {
              transcriptionReapplyAttemptedRef.current = true;
              try {
                const resent = sendSessionUpdate(true);
                if (resent) {
                  addTranscript('system', 'Re-applied transcription config for compatibility');
                }
              } catch (reapplyErr) {
                console.warn('Failed to re-apply transcription config:', reapplyErr);
                incrementDroppedEvent('transcription_reapply_failed');
              }
            }
          } else if (msgType === 'error') {
            // Ignore harmless unknown-parameter errors we caused earlier (modalities); don't show them in UI
            const errMsg = msg.error?.message || 'Azure API error';
            if (errMsg.includes("response.modalities")) {
              console.warn('Ignored Azure warning:', errMsg);
            } else {
              setError(errMsg);
              addTranscript('system', `Error: ${errMsg}`);
            }
          } else if (msgType === 'response.output_text.delta') {
            if (msg.delta) {
              setAiSpeaking(true);
            }
          } else if (msgType === 'response.output_text.done') {
            setAiSpeaking(false);
            const finalText = msg.text || msg.transcript;
            const responseId = msg.response_id || msg.response?.id || 'text';
            const key = `${responseId}:${finalText}`;
            if (finalText && finalText.trim().length > 0 && !rememberByTtl(capturedAiRef, key)) {
              addTranscript('ai', finalText);
            }
          } else if (msgType === 'response.output_item.added') {
            // Remember the last AI output item id so we can detect the user reply that follows
            try {
              const item = msg.item || {};
              const itemId = item.id || item.item_id || item.itemId || msg.item_id || msg.itemId || null;
              if (itemId) lastAIItemRef.current = itemId;
            } catch (e) {
              console.warn('Failed to capture output item id:', e);
            }
          } else if (msgType === 'response.output_audio_transcript.delta') {
            const text = msg.delta || msg.transcript || msg.text || msg.transcript_delta || null;
            if (text) {
              setAiSpeaking(true);
            }
          } else if (msgType === 'response.output_audio_transcript.done' || msgType === 'response.output_audio_transcript.completed') {
            setAiSpeaking(false);
            const finalText = msg.text || msg.transcript;
            const responseId = msg.response_id || msg.response?.id || 'audio';
            const key = `${responseId}:${finalText}`;
            if (finalText && finalText.trim().length > 0 && !rememberByTtl(capturedAiRef, key)) {
              addTranscript('ai', finalText);
            }
            // Count question if we haven't seen response.completed for this response_id
            const countId = msg.response_id;
            if (finalText && finalText.trim().length > 10 && countId && !countedResponseIdsRef.current.has(countId)) {
              countedResponseIdsRef.current.add(countId);
              setQuestionCount(prev => {
                const newCount = prev + 1;
                console.log(`📊 Question count incremented to ${newCount} (from response.output_audio_transcript.done, response_id: ${countId})`);
                return newCount;
              });
            }
          } else if (msgType === 'response.completed') {
            setAiSpeaking(false);
            // Increment question count - this is the primary event for question completion
            const responseId = msg.response_id || msg.response?.id;
            if (responseId && !countedResponseIdsRef.current.has(responseId)) {
              countedResponseIdsRef.current.add(responseId);
              setQuestionCount(prev => {
                const newCount = prev + 1;
                console.log(`📊 Question count incremented to ${newCount} (from response.completed, response_id: ${responseId})`);
                return newCount;
              });
            }
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
              console.log('[input_audio_buffer.committed] item id:', committedItemId);
            }
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
            const key = `${itemId}:${text}`;
            console.log('[input_audio_transcription.*] text:', text);
            if (text && text.trim().length > 0 && !rememberByTtl(capturedUserRef, key)) {
              addTranscript('user', text);
              setMicActive(false);
            } else if (!text) {
              incrementDroppedEvent('empty_user_transcription');
              console.warn('[input_audio_transcription.*] No user text found in message:', msg);
            } else {
              incrementDroppedEvent('duplicate_user_transcription');
            }
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

              console.log('[conversation.item.*]', parsed);

              if (parsed.isUserReply && parsed.text) {
                const key = `${parsed.itemId || 'item'}:${parsed.text}`;
                if (!rememberByTtl(capturedUserRef, key)) {
                  addTranscript('user', parsed.text);
                } else {
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
            addTranscript('system', 'User started speaking');
          } else if (msg.type === 'input_audio_buffer.speech_stopped') {
            setMicActive(false);
            addTranscript('system', 'User stopped speaking');
          }
        } catch (err) {
          console.error('Error parsing message:', err);
          addTranscript('system', `Error parsing message: ${err.message}`);
        }
      };

      dc.onerror = (err) => {
        console.error('DataChannel error:', err);
        setError('DataChannel error occurred');
      };

      dc.onclose = () => {
        addTranscript('system', 'DataChannel closed');
        setStatus('disconnected');
      };

      // Step 6: Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addTranscript('system', 'SDP offer created');

      // Step 7: Send to backend with Clerk auth
      addTranscript('system', `Sending SDP offer to backend...`);
      const token = await getToken();
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
          durationMinutes: durationMinutes || 15
        })
      });

      if (!resp.ok) {
        const text = await resp.text();
        let errorMessage = `HTTP ${resp.status} from backend`;

        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }

        if (resp.status === 404 && !text.includes('Realtime API')) {
          errorMessage = `Backend route not found (404). Check if server is running and route exists.`;
        }

        addTranscript('system', `Backend error: ${errorMessage}`);
        throw new Error(errorMessage);
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

      addTranscript('system', 'SDP answer received from backend');
      if (typeof data.effectiveDurationMinutes === 'number' && data.effectiveDurationMinutes > 0) {
        addTranscript('system', `Session limit enforced: ${data.effectiveDurationMinutes} minutes (${data.planTier || 'trial'} plan).`);
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: data.sdpAnswer });
      addTranscript('system', 'Remote description set, connection establishing...');

    } catch (err) {
      console.error('Connection error:', err);
      setStatus('error');

      let errorMessage = err.message || 'Connection failed';
      if (err.message && err.message.includes('Permission denied')) {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and try again.';
      } else if (err.message && err.message.includes('NotAllowedError')) {
        errorMessage = 'Microphone access was denied. Please check your browser permissions and try again.';
      } else if (err.message && err.message.includes('NotFoundError')) {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      }

      setError(errorMessage);
      addTranscript('system', `Error: ${errorMessage}`);

      // Cleanup on error
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      stopBrowserSpeechRecognition();
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    }
  }, [
    status,
    addTranscript,
    getToken,
    user,
    sessionId,
    interviewType,
    difficulty,
    targetRole,
    targetCompany,
    questionMix,
    interviewStyle,
    durationMinutes,
    incrementDroppedEvent,
    rememberByTtl,
    startBrowserSpeechRecognition,
    stopBrowserSpeechRecognition,
  ]);

  // Build canonical transcript payload (structured/hybrid/raw)
  const buildCanonicalTranscriptPayload = useCallback(() => {
    const ai = aiMessagesRef.current.map(m => ({ ...m, speaker: 'ai' }));
    const user = userMessagesRef.current.map(m => ({ ...m, speaker: 'user' }));
    const pendingUserMessages = Object.values(pendingUserTranscriptRef.current || {})
      .map((value) => String(value || '').trim())
      .filter((text) => text.length > 0)
      .map((text, idx) => ({
        speaker: 'user',
        text,
        timestamp: new Date(Date.now() - (idx + 1) * 100).toISOString(),
      }));

    // Merge into a single ordered list
    const raw_messages = [...ai, ...user, ...pendingUserMessages]
      .filter(m => m.text && String(m.text).trim().length > 0)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    console.log(`[buildPayload] Total messages: ${raw_messages.length}`);

    // Attempt Q/A pairing
    const qa_pairs = [];
    const unpaired = [];
    let pendingQuestion = null;

    for (const m of raw_messages) {
      if (m.speaker === 'ai') {
        if (pendingQuestion) {
          // Previous question had no answer
          unpaired.push({ type: 'unanswered_question', text: pendingQuestion.text, timestamp: pendingQuestion.timestamp });
          console.info('[transcript] AI question without paired user answer yet:', pendingQuestion.text);
        }
        pendingQuestion = { text: m.text, timestamp: m.timestamp };
      } else {
        // user message
        if (pendingQuestion) {
          qa_pairs.push({
            question: pendingQuestion.text,
            answer: m.text,
            timestamp: m.timestamp
          });
          pendingQuestion = null;
        } else {
          unpaired.push({ type: 'answer_without_question', text: m.text, timestamp: m.timestamp, speaker: 'user' });
          console.info('[transcript] User answer without paired AI question:', m.text);
        }
      }
    }

    if (pendingQuestion) {
      unpaired.push({ type: 'unanswered_question', text: pendingQuestion.text, timestamp: pendingQuestion.timestamp });
      console.info('[transcript] Trailing AI question at end of call:', pendingQuestion.text);
    }

    // Determine mode
    let mode = 'structured';
    if (qa_pairs.length === 0 && raw_messages.length > 0) {
      mode = 'raw';
    } else if (unpaired.length > 0) {
      mode = 'hybrid';
    }

    console.log(`[buildPayload] Mode: ${mode}, QA pairs: ${qa_pairs.length}, Unpaired: ${unpaired.length}`);

    return {
      mode,
      qa_pairs,
      unpaired,
      raw_messages,
    };
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
        throw new Error('No messages captured - cannot generate report');
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
            eye_contact_pct: null,
            session_feedback: sessionFeedback,
            turn_evaluations: turnEvaluationsRef.current,
            duration_minutes_requested: durationMinutes,
            duration_minutes_effective: effectiveDurationMinutes,
            trial_mode: trialMode,
            plan_tier: planTier,
            asked_question_ids: askedQuestionIdsRef.current,
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
            capture_stats: captureStats,
          }
        })
      });

      if (!saveResp.ok) {
        const errText = await saveResp.text().catch(() => 'Unknown error');
        console.error('❌ Transcript save failed:', errText);
        throw new Error(`Save failed: ${errText}`);
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
        });
      }

      if (!data.report_id) {
        throw new Error('Backend did not return report_id');
      }

      console.log("📄 Report ID:", data.report_id);

      return data.report_id;

    } catch (err) {
      console.error('❌ Error saving report:', err);
      throw err;
    }
  }, [sessionId, getToken, interviewType, timeElapsed, buildCanonicalTranscriptPayload, effectiveDurationMinutes, trialMode, planTier]);

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

    const transcriptPayload = buildCanonicalTranscriptPayload();
    isEndingRef.current = true;
    pendingTranscriptPayloadRef.current = transcriptPayload;

    console.log('[runSaveFlow] Calling saveAndGenerateReport...');
    const reportId = await saveAndGenerateReport({ transcript: transcriptPayload, sessionFeedback });

    return reportId;
  }, [buildCanonicalTranscriptPayload, saveAndGenerateReport]);

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
      const reportId = await runSaveFlow(sessionFeedback);

      // Close connections only AFTER successful save
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
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

      setStatus('idle');
      setMicActive(false);
      setAiSpeaking(false);
      endInProgressRef.current = false;

      navigate(`/report/${reportId}`, { state: { openFeedbackDialog: true } });

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
  }, [runSaveFlow, navigate, stopBrowserSpeechRecognition]);

  // Retry handler
  const handleRetryEnd = useCallback(async () => {
    setEndError(null);
    setShowEndErrorDialog(false);

    try {
      const reportId = await runSaveFlow();

      // Close connections after successful retry
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
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

      setStatus('idle');
      endInProgressRef.current = false;

      navigate(`/report/${reportId}`, { state: { openFeedbackDialog: true } });

    } catch (err) {
      console.error('[handleRetryEnd] Retry failed:', err);
      setEndError(err);
      setShowEndErrorDialog(true);
      isEndingRef.current = false;
    } finally {
    }
  }, [runSaveFlow, navigate, stopBrowserSpeechRecognition]);

  // End without saving handler
  const handleEndWithoutSaving = useCallback(async () => {
    setShowEndErrorDialog(false);

    try {
      // Close all connections
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
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
    } finally {
      setStatus('idle');
      setMicActive(false);
      setAiSpeaking(false);
      endInProgressRef.current = false;
      isEndingRef.current = false;
      pendingTranscriptPayloadRef.current = null;
      navigate('/dashboard');
    }
  }, [navigate, stopBrowserSpeechRecognition]);

  if (!user) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Please sign in to access the interview.</Typography>
      </Box>
    );
  }

  return (
    <div className="session-shell meet-shell">
      {/* Top Bar */}
      <div className="session-topbar meet-topbar">
        <div className="meet-topbar-left">
          <Typography style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
            Interview Session
          </Typography>
          <span className="meet-subtle">
            {interviewType} • {effectiveDurationMinutes}m limit {trialMode ? `(trial)` : `(${planTier})`}
          </span>
        </div>
        <div className="meet-topbar-right" aria-hidden="true" />
      </div>

      {(status === 'error' || status === 'disconnected' || status === 'failed') && (
        <div className="meet-conn-banner">
          Connection issue detected. Please check your network.
        </div>
      )}

      {/* Main Stage */}
      <div className="meet-stage-wrap">
        <div className="meet-stage">
          <div className={`meet-avatar-ring ${aiSpeaking ? 'speaking' : ''} ${status === 'connecting' || status === 'idle' ? 'idle' : ''}`}>
            <div className="meet-memoji" aria-hidden="true" />
            <Avatar className="meet-avatar">S</Avatar>
          </div>
          <div className="meet-nameplate">Sonia</div>
          {(status === 'connecting' || status === 'idle') && (
            <div className="meet-stage-status">Connecting…</div>
          )}
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
              disabled={hasJoined || status === 'connecting' || status === 'connected' || status === 'ready'}
              sx={{ minWidth: { xs: '170px', md: '200px' }, borderRadius: '999px', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' }, fontSize: { xs: '14px', md: '15px' }, fontWeight: 600, padding: { xs: '10px 22px', md: '10px 30px' }, textTransform: 'none' }}
            >
              Join Interview
            </Button>
          </div>
        ) : (
          <div className="meet-controls-row">
            <div className="meet-controls-cluster" role="group" aria-label="Call controls">
              <button
                type="button"
                className={`meet-control-btn ${micMuted ? 'off' : 'on'}`}
                onClick={() => setMicMuted(prev => !prev)}
                aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                aria-pressed={micMuted}
                title={micMuted ? 'Unmute' : 'Mute'}
              >
                {micMuted ? <MicOff /> : <Mic />}
              </button>
              <button
                type="button"
                className={`meet-control-btn ${cameraOff ? 'off' : 'on'}`}
                onClick={() => setCameraOff(prev => !prev)}
                aria-label={cameraOff ? 'Turn on camera' : 'Turn off camera'}
                aria-pressed={cameraOff}
                title={cameraOff ? 'Camera on' : 'Camera off'}
              >
                {cameraOff ? <VideocamOff /> : <Videocam />}
              </button>
            </div>
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
        <DialogTitle>Microphone Permission Required</DialogTitle>
        <DialogContent>
          <Typography>
            To conduct the interview, we need access to your microphone.
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
        <DialogTitle>Couldn't Generate Report</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The interview is still connected. You can retry generating the report, or end without saving.
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
          <Button onClick={handleRetryEnd} variant="contained" autoFocus>
            Retry
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
