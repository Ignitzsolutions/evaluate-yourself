import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';
import { authFetch } from '../utils/apiClient';
import {
  ExitToApp,
  Dashboard as DashboardIcon,
  Assessment,
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
  CircularProgress,
} from '@mui/material';
import '../ui.css';

// Support both Create React App (process.env) and Vite (import.meta.env)
const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:8000";

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
  const [maxQuestions, setMaxQuestions] = useState(6);

  useEffect(() => {
    const config = sessionStorage.getItem('interviewConfig');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setInterviewType(parsed.type || typeFromUrl || 'behavioral');
        setMaxQuestions(parsed.duration ? parseInt(parsed.duration) : 6);
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
  const [micActive, setMicActive] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [error, setError] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [reportAvailable, setReportAvailable] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportId, setReportId] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);

  // Collect all AI and user messages for saving
  const aiMessagesRef = useRef([]);
  const userMessagesRef = useRef([]);
  // Track last AI output item id to associate following conversation items as user replies
  const lastAIItemRef = useRef(null);
  // Track last committed input item id (optional)
  const lastCommittedInputItemRef = useRef(null);
  // Track counted response IDs to avoid double-counting questions
  const countedResponseIdsRef = useRef(new Set());

  // Add transcript entry
  const addTranscript = useCallback((speaker, text) => {
    setTranscript(prev => [...prev, {
      speaker,
      text,
      timestamp: new Date().toISOString()
    }]);

    // Also collect for saving
    if (speaker === 'ai') {
      aiMessagesRef.current.push({ text, timestamp: new Date().toISOString() });
    } else if (speaker === 'user') {
      userMessagesRef.current.push({ text, timestamp: new Date().toISOString() });
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
              setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last && last.speaker === 'ai' && !last.final) {
                  const combined = last.text + msg.delta;
                  // update aiMessagesRef last entry if exists
                  if (aiMessagesRef.current.length > 0) {
                    aiMessagesRef.current[aiMessagesRef.current.length - 1].text = combined;
                    aiMessagesRef.current[aiMessagesRef.current.length - 1].timestamp = new Date().toISOString();
                  } else {
                    aiMessagesRef.current.push({ text: combined, timestamp: new Date().toISOString() });
                  }
                  return [...prev.slice(0, -1), { ...last, text: combined }];
                }
                const entry = { speaker: 'ai', text: msg.delta, final: false, timestamp: new Date().toISOString() };
                aiMessagesRef.current.push({ text: entry.text, timestamp: entry.timestamp });
                return [...prev, entry];
              });
            }
          } else if (msg.type === 'response.output_text.done') {
            setAiSpeaking(false);
            setTranscript(prev => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === 'ai') {
                const finalText = msg.text || last.text;
                // update aiMessagesRef last entry to final
                if (aiMessagesRef.current.length > 0) {
                  aiMessagesRef.current[aiMessagesRef.current.length - 1].text = finalText;
                } else {
                  aiMessagesRef.current.push({ text: finalText, timestamp: new Date().toISOString() });
                }
                return [...prev.slice(0, -1), { ...last, text: finalText, final: true }];
              }
              return prev;
            });
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
            // Many SDKs send audio-based transcript events with the partial transcript text
            const text = msg.delta || msg.transcript || msg.text || msg.transcript_delta || null;
            if (text) {
              setAiSpeaking(true);
              setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last && last.speaker === 'ai' && !last.final) {
                  const combined = last.text + text;
                  // update aiMessagesRef last entry if exists
                  if (aiMessagesRef.current.length > 0) {
                    aiMessagesRef.current[aiMessagesRef.current.length - 1].text = combined;
                    aiMessagesRef.current[aiMessagesRef.current.length - 1].timestamp = new Date().toISOString();
                  } else {
                    aiMessagesRef.current.push({ text: combined, timestamp: new Date().toISOString() });
                  }
                  return [...prev.slice(0, -1), { ...last, text: combined }];
                }
                const entry = { speaker: 'ai', text: text, final: false, timestamp: new Date().toISOString() };
                aiMessagesRef.current.push({ text: entry.text, timestamp: entry.timestamp });
                return [...prev, entry];
              });
            }
          } else if (msg.type === 'response.output_audio_transcript.done' || msg.type === 'response.output_audio_transcript.completed') {
            setAiSpeaking(false);
            setTranscript(prev => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === 'ai') {
                const finalText = msg.text || msg.transcript || last.text;
                if (aiMessagesRef.current.length > 0) {
                  aiMessagesRef.current[aiMessagesRef.current.length - 1].text = finalText;
                } else {
                  aiMessagesRef.current.push({ text: finalText, timestamp: new Date().toISOString() });
                }
                return [...prev.slice(0, -1), { ...last, text: finalText, final: true }];
              }
              return prev;
            });
            // Count question if we haven't seen response.completed for this response_id
            const responseId = msg.response_id;
            const finalText = msg.text || msg.transcript;
            if (finalText && finalText.trim().length > 10 && responseId && !countedResponseIdsRef.current.has(responseId)) {
              countedResponseIdsRef.current.add(responseId);
              setQuestionCount(prev => {
                const newCount = prev + 1;
                console.log(`📊 Question count incremented to ${newCount} (from response.output_audio_transcript.done, response_id: ${responseId})`);
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
            if (text) {
              addTranscript('user', text);
              setMicActive(false);
            }
          } else if (msg.type && msg.type.startsWith('input_audio_transcription') && msg.delta) {
            // partial transcription while user is speaking
            const partial = msg.delta || msg.text || msg.transcript;
            if (partial) {
              // show partial as 'system' typing indicator or temporary user line
              setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last && last.speaker === 'user' && !last.final) {
                  // append
                  const combined = last.text + partial;
                  // update userMessagesRef
                  if (userMessagesRef.current.length > 0) {
                    userMessagesRef.current[userMessagesRef.current.length - 1].text = combined;
                    userMessagesRef.current[userMessagesRef.current.length - 1].timestamp = new Date().toISOString();
                  } else {
                    userMessagesRef.current.push({ text: combined, timestamp: new Date().toISOString() });
                  }
                  return [...prev.slice(0, -1), { ...last, text: combined }];
                }
                const entry = { speaker: 'user', text: partial, final: false, timestamp: new Date().toISOString() };
                userMessagesRef.current.push({ text: entry.text, timestamp: entry.timestamp });
                return [...prev, entry];
              });
            }
          } else if (msg.type === 'conversation.item.added' || msg.type === 'conversation.item.done') {
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

              // Determine if this conversation item is a user reply by checking role or relation to last AI item
              const role = item.role || (item.metadata && item.metadata.role) || item.author?.role || null;
              const prevId = msg.previous_item_id || item.previous_item_id || null;
              const itemId = item.id || item.item_id || item.itemId || msg.item_id || null;

              const isUserReply = (role && (role === 'user' || role === 'candidate')) || (prevId && lastAIItemRef.current && prevId === lastAIItemRef.current) || (itemId && lastCommittedInputItemRef.current && itemId === lastCommittedInputItemRef.current);

              if (isUserReply && text) {
                // avoid duplicates
                const last = transcript[transcript.length - 1];
                if (!last || last.speaker !== 'user' || last.text !== text) {
                  addTranscript('user', text);
                }
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
          difficulty: 'mid'
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
  }, [status, addTranscript, getToken, user, sessionId, interviewType]);

  // Save transcript and generate report
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveAndGenerateReport = useCallback(async () => {
    try {
      // Combine transcripts
      const combined = [
        ...aiMessagesRef.current.map(t => ({
          speaker: 'interviewer',
          text: t.text,
          timestamp: t.timestamp
        })),
        ...userMessagesRef.current.map(t => ({
          speaker: 'candidate',
          text: t.text,
          timestamp: t.timestamp
        }))
      ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Calculate metrics
      const totalWords = combined.reduce((sum, entry) => {
        return sum + (entry.text ? entry.text.split(/\s+/).length : 0);
      }, 0);
      
      // Calculate duration in minutes (from timeElapsed state)
      const durationMinutes = Math.max(1, Math.round(timeElapsed / 60));

      // Get auth token to associate report with user
      let headers = { 'Content-Type': 'application/json' };
      try {
        const token = await getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (authErr) {
        console.warn('Could not get auth token for transcript save:', authErr);
      }

      // Save transcript with metrics
      const saveResp = await fetch(`${API_BASE_URL}/api/interview/${sessionId}/transcript`, {
        method: 'POST',
        headers: headers,
          body: JSON.stringify({ 
          transcript: combined,
          interview_type: interviewType || 'mixed',
          duration_minutes: durationMinutes,
          questions_answered: questionCount,  // Send as questions_answered for backend
          metrics: {
            questions_answered: questionCount,
            total_words: totalWords,
            total_duration: durationMinutes,
            speaking_time: durationMinutes * 60, // Approximate speaking time in seconds
            silence_time: 0, // Not tracked currently
            eye_contact_pct: null // Not tracked currently
          }
        })
      });

      if (!saveResp.ok) {
        console.error('Failed to save transcript');
        const errText = await saveResp.text().catch(() => null);
        return { ok: false, error: errText };
      }

      const data = await saveResp.json().catch(() => ({}));
      console.log('✅ Transcript saved - interview data preserved', data);
      return data; 
    } catch (err) {
      console.error('Error saving/generating report:', err);
    }
  }, [sessionId, getToken]);

  // Disconnect
  const handleDisconnect = useCallback(async () => {
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
    setError(null);

    // Show Report button immediately and start report generation
    setReportAvailable(true);
    setReportLoading(true);
    try {
      const resp = await saveAndGenerateReport();
      if (resp && resp.report_id) {
        setReportId(resp.report_id);
        // Automatically navigate to the report page
        navigate(`/report/${resp.report_id}`);
      } else {
        // Fallback to sessionId if report_id is not available
        navigate(`/report/${sessionId}`);
      }
    } catch (e) {
      console.error('Error saving/generating report:', e);
      // Navigate to report page with sessionId even on error
      navigate(`/report/${sessionId}`);
    } finally {
      setReportLoading(false);
    }
  }, [saveAndGenerateReport, navigate, sessionId]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Please sign in to access the interview.</Typography>
      </Box>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Avenir, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          height: '60px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Typography style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
            Interview Session
          </Typography>
          <span style={{ fontSize: '14px', color: '#6b7280', textTransform: 'capitalize' }}>
            {interviewType}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#374151' }}>
            {formatTime(timeElapsed)}
          </span>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Q{questionCount} / {maxQuestions}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: status === 'connected' || status === 'ready' ? '#4ade80' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: status === 'connected' || status === 'ready' ? '#4ade80' : '#9ca3af'
              }}
            />
            {status}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {reportAvailable && sessionId && (
            <button
              onClick={() => navigate(reportId ? `/report/${reportId}` : `/report/${sessionId}`)}
              style={{
                background: 'transparent',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '14px',
                color: '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Assessment style={{ fontSize: '16px' }} />
              {reportLoading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span>Generating...</span>
                  <CircularProgress size={16} />
                </span>
              ) : (
                'Report'
              )}
            </button>
          )}

          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'transparent',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '14px',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <DashboardIcon style={{ fontSize: '16px' }} />
            Dashboard
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '14px',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ExitToApp style={{ fontSize: '16px' }} />
            Exit
          </button>
        </div>
      </div>

      {/* Main Content - Single Panel Layout */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', padding: '24px', gap: '24px', minHeight: 0, justifyContent: 'center' }}>
        {/* Video Tiles Panel */}
        <div style={{ flex: '0 0 80%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: 0 }}>
          {/* Video Tiles Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1, minHeight: 0 }}>
            {/* User Tile */}
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fafafa', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>You</Typography>
                <span style={{ fontSize: '12px', color: micActive ? '#4ade80' : '#9ca3af' }}>{micActive ? '🎤 Mic On' : '🔇 Mic Off'}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <Avatar style={{ width: '80px', height: '80px', background: '#e0e0e0', color: '#6b7280', fontSize: '32px', fontWeight: 600 }}>U</Avatar>
                  <Typography style={{ fontSize: '14px', color: '#6b7280' }}>Camera off</Typography>
                </div>
              </div>
            </div>

            {/* Sonia Tile */}
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fafafa', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Typography style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Sonia</Typography>
                  <span style={{ fontSize: '11px', background: '#4ade80', color: '#ffffff', padding: '2px 8px', borderRadius: '12px' }}>Live</span>
                </div>
                {aiSpeaking && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '40px 20px' }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>
                  👤
                </div>
                <Typography style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
                  {aiSpeaking ? 'Sonia is speaking...' : 'Ready to interview'}
                </Typography>
              </div>
            </div>
          </div>

          {/* Controls */}
          {!hasJoined ? (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', paddingTop: '16px' }}>
              <Button
                variant="contained"
                onClick={() => {
                  setHasJoined(true);
                  // hide previous report until this interview ends
                  setReportAvailable(false);
                  handleConnect();
                }}
                disabled={hasJoined || status === 'connecting' || status === 'connected' || status === 'ready'}
                sx={{ minWidth: '160px', borderRadius: '6px', backgroundColor: '#ff6b35', '&:hover': { backgroundColor: '#ff5722' }, fontSize: '16px', fontWeight: 600, padding: '10px 24px' }}
              >
                Join Interview
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingTop: '16px' }}>
              <Button
                variant="contained"
                color="error"
                onClick={handleDisconnect}
                disabled={status === 'idle' || status === 'disconnected'}
                sx={{ minWidth: '140px', borderRadius: '6px', color: '#ffffff', backgroundColor: '#ef4444', '&:hover': { backgroundColor: '#dc2626' } }}
              >
                End Call
              </Button>
              
              {micActive && (
                <Typography style={{ fontSize: '13px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🎤 Listening
                </Typography>
              )}
              
              {aiSpeaking && (
                <Typography style={{ fontSize: '13px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔊 Speaking
                </Typography>
              )}
              
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Status:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: status === 'connected' || status === 'ready' ? '#4ade80' : '#9ca3af' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: status === 'connected' || status === 'ready' ? '#4ade80' : '#9ca3af' }} />
                  {status}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Right Panel: Transcript - Hidden for cleaner UI */}
        {/* Transcript data is still collected in the background for report generation */}
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 24px', fontSize: '14px', color: '#991b1b', borderBottom: '1px solid #e0e0e0' }}>
          ⚠️ {error}
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
    </div>
  );
}
