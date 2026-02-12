import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';
import { authFetch } from '../utils/apiClient';
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
  Rating,
  TextField,
} from '@mui/material';
import '../ui.css';

// Support both Create React App (process.env) and Vite (import.meta.env)
const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "";

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
  const [difficulty, setDifficulty] = useState('medium');
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [questionMix, setQuestionMix] = useState('balanced');
  const [interviewStyle, setInterviewStyle] = useState('neutral');

  useEffect(() => {
    const config = sessionStorage.getItem('interviewConfig');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setInterviewType(parsed.type || typeFromUrl || 'behavioral');
        setDurationMinutes(parsed.duration ? parseInt(parsed.duration, 10) : 15);
        setDifficulty(parsed.difficulty || 'medium');
        setTargetRole(parsed.role || '');
        setTargetCompany(parsed.company || '');
        setQuestionMix(parsed.questionMix || 'balanced');
        setInterviewStyle(parsed.interviewStyle || 'neutral');
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
  const capturedAiRef = useRef(new Set());
  const capturedUserRef = useRef(new Set());

  // Collect all AI and user messages for saving
  const aiMessagesRef = useRef([]);
  const userMessagesRef = useRef([]);
  // Track last AI output item id to associate following conversation items as user replies
  const lastAIItemRef = useRef(null);
  // Track last committed input item id (optional)
  const lastCommittedInputItemRef = useRef(null);
  // Track counted response IDs to avoid double-counting questions
  const countedResponseIdsRef = useRef(new Set());

  // --- End / transcript reliability guards ---
  const endInProgressRef = useRef(false);
  const isEndingRef = useRef(false);
  const lastMessageAtRef = useRef(Date.now());

  // Error recovery state
  const [endError, setEndError] = useState(null);
  const [showEndErrorDialog, setShowEndErrorDialog] = useState(false);
  const pendingTranscriptPayloadRef = useRef(null);
  const [showEndFeedbackDialog, setShowEndFeedbackDialog] = useState(false);
  const [endExperienceRating, setEndExperienceRating] = useState(0);
  const [endFeedbackComment, setEndFeedbackComment] = useState('');
  const [endFeedbackError, setEndFeedbackError] = useState('');

  // Utility
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Add transcript entry
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callback uses refs only; adding state deps would re-register listeners
  const addTranscript = useCallback((speaker, text) => {
    // Stop accepting new transcript writes when ending interview
    if (isEndingRef.current) {
      console.log('[addTranscript] BLOCKED - interview is ending');
      return;
    }
    
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
      aiMessagesRef.current.push({ text, timestamp: ts });
    } else if (speaker === 'user') {
      userMessagesRef.current.push({ text, timestamp: ts });
      console.log(`[addTranscript] userMessagesRef now:`, JSON.stringify(userMessagesRef.current, null, 2));
    }
  }, []);

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

      dc.onopen = () => {
        addTranscript('system', 'DataChannel opened');
        setStatus('connected');

        // Send session.update with turn detection
        if (dc.readyState === 'open') {
          try {
            dc.send(JSON.stringify({
              type: 'session.update',
              session: {
                type: 'realtime',
                audio: {
                  input: {
                    turn_detection: {
                      type: 'server_vad',
                      threshold: 0.7,
                      prefix_padding_ms: 300,
                      silence_duration_ms: 600,
                      create_response: true,
                      interrupt_response: false
                    },
                    transcription: {
                      model: 'gpt-4o-mini-transcribe',
                      language: 'en'
                    }
                  },
                  output: {
                    voice: 'alloy'
                  }
                }
              }
            }));
            addTranscript('system', 'Sent session.update (audio.input.turn_detection + voice)');
          } catch (err) {
            console.error('Error sending session.update:', err);
          }

          // Send initial response.create (no modalities - configured on session)
          try {
            dc.send(JSON.stringify({
              type: 'response.create',
              response: {
                instructions: "You MUST speak ONLY in English. Introduce yourself as Sonia in English: 'Hello, I'm Sonia, and I'll be conducting your interview today.' Then ask the first interview question in English only."
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

          // Handle messages
          if (msg.type === 'session.created') {
            addTranscript('system', 'Azure session created');
          } else if (msg.type === 'session.updated') {
            addTranscript('system', 'Session updated');
          } else if (msg.type === 'error') {
            // Ignore harmless unknown-parameter errors we caused earlier (modalities); don't show them in UI
            const errMsg = msg.error?.message || 'Azure API error';
            if (errMsg.includes("response.modalities")) {
              console.warn('Ignored Azure warning:', errMsg);
            } else {
              setError(errMsg);
              addTranscript('system', `Error: ${errMsg}`);
            }
          } else if (msg.type === 'response.output_text.delta') {
            if (msg.delta) {
              setAiSpeaking(true);
            }
          } else if (msg.type === 'response.output_text.done') {
            setAiSpeaking(false);
            const finalText = msg.text || msg.transcript;
            const responseId = msg.response_id || msg.response?.id || 'text';
            const key = `${responseId}:${finalText}`;
            if (finalText && finalText.trim().length > 0 && !capturedAiRef.current.has(key)) {
              capturedAiRef.current.add(key);
              addTranscript('ai', finalText);
            }
          } else if (msg.type === 'response.output_item.added') {
            // Remember the last AI output item id so we can detect the user reply that follows
            try {
              const item = msg.item || {};
              const itemId = item.id || item.item_id || item.itemId || msg.item_id || msg.itemId || null;
              if (itemId) lastAIItemRef.current = itemId;
            } catch (e) {
              console.warn('Failed to capture output item id:', e);
            }
          } else if (msg.type === 'response.output_audio_transcript.delta') {
            const text = msg.delta || msg.transcript || msg.text || msg.transcript_delta || null;
            if (text) {
              setAiSpeaking(true);
            }
          } else if (msg.type === 'response.output_audio_transcript.done' || msg.type === 'response.output_audio_transcript.completed') {
            setAiSpeaking(false);
            const finalText = msg.text || msg.transcript;
            const responseId = msg.response_id || msg.response?.id || 'audio';
            const key = `${responseId}:${finalText}`;
            if (finalText && finalText.trim().length > 0 && !capturedAiRef.current.has(key)) {
              capturedAiRef.current.add(key);
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
          } else if (msg.type === 'response.completed') {
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
          else if (msg.type === 'input_audio_transcription.completed' || msg.type === 'input_audio_transcription.done') {
            const text = msg.text || msg.transcript;
            const itemId = msg.item_id || msg.conversation_item_id || 'user';
            const key = `${itemId}:${text}`;
            console.log('[input_audio_transcription.completed] text:', text);
            if (text && text.trim().length > 0 && !capturedUserRef.current.has(key)) {
              capturedUserRef.current.add(key);
              addTranscript('user', text);
              setMicActive(false);
            } else if (!text) {
              console.warn('[input_audio_transcription.completed] No user text found in message:', msg);
            }
          } else if (msg.type === 'conversation.item.added' || msg.type === 'conversation.item.done') {
            // Debug: log the full message object for diagnosis
            console.log('[DEBUG][conversation.item.*] FULL MSG:', JSON.stringify(msg, null, 2));
            // Some events include user contributions as conversation items
            const item = msg.item || msg;
            try {
              // Extract text robustly from several possible shapes
              let text = null;
              if (item.content && Array.isArray(item.content) && item.content.length > 0) {
                text = item.content.map(c => {
                  if (typeof c === 'string') return c;
                  if (c.text) return c.text;
                  if (c.parts && Array.isArray(c.parts)) return c.parts.map(p => p.text || p).join('');
                  return null;
                }).filter(Boolean).join(' ');
              }
              if (!text && item.text) text = item.text;
              if (!text && item.content_text) text = item.content_text;
              // Fallback: check for user_transcript field added by backend patch
              if ((!text || text.trim().length === 0) && msg.user_transcript) {
                text = msg.user_transcript;
              }

              // Determine if this conversation item is a user reply by checking role or relation to last AI item
              const role = item.role || (item.metadata && item.metadata.role) || item.author?.role || null;
              const prevId = msg.previous_item_id || item.previous_item_id || null;
              const itemId = item.id || item.item_id || item.itemId || msg.item_id || null;

              const isUserReply = (role && (role === 'user' || role === 'candidate')) || (prevId && lastAIItemRef.current && prevId === lastAIItemRef.current) || (itemId && lastCommittedInputItemRef.current && itemId === lastCommittedInputItemRef.current);

              // Log the full item object for user turns for debugging
              if (isUserReply) {
                console.log('[conversation.item.*][FULL USER ITEM]', JSON.stringify(item, null, 2));
              }

              console.log('[conversation.item.*] text:', text, '| isUserReply:', isUserReply, '| role:', role, '| prevId:', prevId, '| lastAIItemRef:', lastAIItemRef.current);

              if (isUserReply && text && text.trim().length > 0) {
                const key = `${itemId || prevId || 'item'}:${text}`;
                if (!capturedUserRef.current.has(key)) {
                  capturedUserRef.current.add(key);
                  addTranscript('user', text);
                }
              } else if (text && text.trim().length > 0) {
                // Fallback: if text exists but isUserReply is false, still log it for debugging
                console.warn('[conversation.item.*] Text found but not classified as user reply:', text, item);
              }
            } catch (e) {
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

      addTranscript('system', 'SDP answer received from backend');

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
  ]);

  // Build canonical transcript payload (structured/hybrid/raw)
  const buildCanonicalTranscriptPayload = useCallback(() => {
    const ai = aiMessagesRef.current.map(m => ({ ...m, speaker: 'ai' }));
    const user = userMessagesRef.current.map(m => ({ ...m, speaker: 'user' }));

    // Merge into a single ordered list
    const raw_messages = [...ai, ...user]
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
          console.warn('[transcript] ⚠️ AI question without answer:', pendingQuestion.text);
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
          console.warn('[transcript] ⚠️ User answer without AI question:', m.text);
        }
      }
    }

    if (pendingQuestion) {
      unpaired.push({ type: 'unanswered_question', text: pendingQuestion.text, timestamp: pendingQuestion.timestamp });
      console.warn('[transcript] ⚠️ Trailing AI question:', pendingQuestion.text);
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
      
      console.log('📦 Transcript payload:', JSON.stringify(transcriptPayload, null, 2));

      // If absolutely no messages, cannot save
      if (transcriptPayload.raw_messages.length === 0) {
        throw new Error('No messages captured - cannot generate report');
      }

      // Calculate metrics
      const totalWords = transcriptPayload.raw_messages.reduce((sum, entry) => {
        return sum + (entry.text ? entry.text.split(/\s+/).length : 0);
      }, 0);

      const durationMinutes = Math.max(1, Math.round(timeElapsed / 60));

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
          interview_type: interviewType || 'mixed',
          duration_minutes: durationMinutes,
          questions_answered: transcriptPayload.qa_pairs.length,
          metrics: {
            questions_answered: transcriptPayload.qa_pairs.length,
            total_words: totalWords,
            total_duration: durationMinutes,
            speaking_time: durationMinutes * 60,
            silence_time: 0,
            eye_contact_pct: null,
            session_feedback: sessionFeedback,
          },
          session_feedback: sessionFeedback,
          meta: {
            ended_at: new Date().toISOString(),
            client_version: '2.0.0-production-grade'
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

      if (!data.report_id) {
        throw new Error('Backend did not return report_id');
      }

      console.log("📄 Report ID:", data.report_id);

      return data.report_id;

    } catch (err) {
      console.error('❌ Error saving report:', err);
      throw err;
    }
  }, [sessionId, getToken, interviewType, timeElapsed, buildCanonicalTranscriptPayload]);

  // Production-grade disconnect flow with single-flight guard and drain
  const runSaveFlow = useCallback(async (sessionFeedback = null) => {
    // Drain in-flight messages before building transcript payload
    isEndingRef.current = true;
    console.log('[runSaveFlow] Starting drain...');
    const drainStart = Date.now();
    const quietMs = 200;
    const timeoutMs = 800;
    while (Date.now() - drainStart < timeoutMs) {
      const quietFor = Date.now() - lastMessageAtRef.current;
      if (quietFor >= quietMs) {
        console.log(`[Drain] Quiescence reached after ${Date.now() - drainStart}ms`);
        break;
      }
      await sleep(50);
    }

    const transcriptPayload = buildCanonicalTranscriptPayload();
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

      navigate(`/report/${reportId}`);

    } catch (err) {
      console.error('[handleDisconnect] Save failed:', err);
      setEndError(err);
      setShowEndErrorDialog(true);
      setStatus('connected'); // Revert to allow retry
      // DO NOT close connections - keep them alive for retry
      // DO NOT reset endInProgressRef - modal controls that
    } finally {
    }
  }, [runSaveFlow, navigate]);

  // Retry handler
  const handleRetryEnd = useCallback(async () => {
    setEndError(null);
    setShowEndErrorDialog(false);

    try {
      const reportId = await runSaveFlow({
        rating: endExperienceRating,
        comment: endFeedbackComment.trim() || null,
        submitted_at: new Date().toISOString(),
      });

      // Close connections after successful retry
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
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

      navigate(`/report/${reportId}`);

    } catch (err) {
      console.error('[handleRetryEnd] Retry failed:', err);
      setEndError(err);
      setShowEndErrorDialog(true);
    } finally {
    }
  }, [runSaveFlow, navigate, endExperienceRating, endFeedbackComment]);

  const handleOpenEndFeedback = useCallback(() => {
    if (endInProgressRef.current || status === 'ending') {
      return;
    }
    setEndFeedbackError('');
    setShowEndFeedbackDialog(true);
  }, [status]);

  const handleConfirmEndFeedback = useCallback(async () => {
    if (!endExperienceRating || endExperienceRating < 1) {
      setEndFeedbackError('Please provide a rating before ending the interview.');
      return;
    }
    setShowEndFeedbackDialog(false);
    await handleDisconnect({
      rating: endExperienceRating,
      comment: endFeedbackComment.trim() || null,
      submitted_at: new Date().toISOString(),
    });
  }, [endExperienceRating, endFeedbackComment, handleDisconnect]);

  // End without saving handler
  const handleEndWithoutSaving = useCallback(async () => {
    setShowEndErrorDialog(false);

    try {
      // Close all connections
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
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
  }, [navigate]);

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
          <span className="meet-subtle">{interviewType}</span>
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
              sx={{ minWidth: '200px', borderRadius: '999px', backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' }, fontSize: '15px', fontWeight: 600, padding: '10px 30px', textTransform: 'none' }}
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
              onClick={handleOpenEndFeedback}
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

      <Dialog
        open={showEndFeedbackDialog}
        onClose={() => setShowEndFeedbackDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Before You End</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Please share a quick rating for this interview session before generating your results.
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Session Rating (Required)
            </Typography>
            <Rating
              value={endExperienceRating}
              onChange={(_, value) => {
                setEndExperienceRating(value || 0);
                if (value && value > 0) {
                  setEndFeedbackError('');
                }
              }}
            />
          </Box>
          <TextField
            label="Comments (Optional)"
            multiline
            rows={3}
            fullWidth
            value={endFeedbackComment}
            onChange={(e) => setEndFeedbackComment(e.target.value)}
            placeholder="Anything we should improve?"
          />
          {endFeedbackError && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
              {endFeedbackError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEndFeedbackDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmEndFeedback}>
            Submit & End Interview
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
