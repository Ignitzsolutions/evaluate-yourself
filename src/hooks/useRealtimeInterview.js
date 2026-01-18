import { useState, useEffect, useRef, useCallback } from 'react';

// Support both Create React App (process.env) and Vite (import.meta.env)
const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:8000";

const DEBUG =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_REALTIME_DEBUG === 'true') ||
  process.env.REACT_APP_REALTIME_DEBUG === 'true';

export default function useRealtimeInterview(sessionId, interviewType = null) {
  // WebRTC refs
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioElementRef = useRef(null);
  
  // State refs
  const startedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const isConnectedRef = useRef(false);
  const soniaSpeakingRef = useRef(false);
  const candidateSpeakingRef = useRef(false);
  
  // Transcript state
  const [interviewState, setInterviewState] = useState({
    status: 'idle', // idle | connecting | connected | listening | responding | error | closed
    error: null,
    micActive: false,
    aiSpeaking: false
  });
  
  const [aiTranscript, setAiTranscript] = useState([]);
  const [userTranscript, setUserTranscript] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [reportId, setReportId] = useState(null);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  const [lastError, setLastError] = useState(null);

  // Debug logging helper
  const debugLog = useCallback((eventType, data) => {
    if (DEBUG) {
      // Sanitize data (remove tokens, SDP full contents)
      const sanitized = { ...data };
      if (sanitized.sdpOffer) sanitized.sdpOffer = sanitized.sdpOffer.substring(0, 100) + '...';
      if (sanitized.sdpAnswer) sanitized.sdpAnswer = sanitized.sdpAnswer.substring(0, 100) + '...';
      if (sanitized.token) sanitized.token = '***';
      console.log('[Realtime Debug]', eventType, sanitized);
    }
  }, []);

  // Send event via DataChannel
  const sendEvent = useCallback((event) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('⚠️ DataChannel not open, cannot send event');
      return;
    }
    try {
      dcRef.current.send(JSON.stringify(event));
      debugLog('Event sent', event);
    } catch (error) {
      console.error('Error sending event:', error);
      setLastError({ type: 'send_error', error: error.message });
    }
  }, [debugLog]);

  // Start interview - WebRTC connection
  const startInterview = useCallback(async () => {
    if (startedRef.current || isConnectingRef.current) {
      console.warn('⚠️ Interview already started or connecting');
      return;
    }

    if (!sessionId) {
      setInterviewState(prev => ({ ...prev, status: 'error', error: 'No session ID provided' }));
      return;
    }

    startedRef.current = true;
    isConnectingRef.current = true;
    setInterviewState(prev => ({ ...prev, status: 'connecting', error: null }));

    try {
      // Step 1: Get user media (microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      localStreamRef.current = stream;
      setInterviewState(prev => ({ ...prev, micActive: true }));

      // Step 2: Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Step 3: Add local audio tracks
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Step 4: Handle remote audio (Sonia's voice)
      const audioElement = new Audio();
      audioElementRef.current = audioElement;
      
      pc.ontrack = async (event) => {
        debugLog('Remote track received', { streams: event.streams.length });
        audioElement.srcObject = event.streams[0];
        try {
          await audioElement.play();
          setShowAudioPrompt(false);
        } catch (error) {
          if (error.name === 'NotAllowedError') {
            console.warn('Audio autoplay blocked, showing prompt');
            setShowAudioPrompt(true);
          } else {
            console.error('Error playing audio:', error);
            setLastError({ type: 'audio_error', error: error.message });
          }
        }
      };

      // Step 5: Create DataChannel for JSON events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        debugLog('DataChannel opened', {});
        isConnectedRef.current = true;
        setInterviewState(prev => ({ ...prev, status: 'connected' }));
        
        // Send session.update with turn detection enabled
        sendEvent({
          type: 'session.update',
          session: {
            turn_detection: {
              type: 'server_vad',
              threshold: 0.7,
              silence_duration_ms: 600
            }
          }
        });

        // Send response.create ONCE to trigger initial greeting
        sendEvent({
          type: 'response.create',
          response: {
            modalities: ['text', 'audio'],
            instructions: "Introduce yourself as Sonia and ask the first interview question."
          }
        });
      };

      dc.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handleDataChannelMessage(msg);
        } catch (error) {
          console.error('Error parsing DataChannel message:', error);
          if (DEBUG) {
            console.log('[Realtime Debug] Raw message:', e.data);
          }
        }
      };

      dc.onerror = (error) => {
        console.error('DataChannel error:', error);
        setLastError({ type: 'datachannel_error', error: 'DataChannel error occurred' });
      };

      dc.onclose = () => {
        debugLog('DataChannel closed', {});
        isConnectedRef.current = false;
      };

      // Step 6: Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      debugLog('SDP offer created', { type: offer.type });

      // Step 7: Get configuration from sessionStorage
      const configStr = sessionStorage.getItem('interviewConfig');
      let config = {};
      if (configStr) {
        try {
          config = JSON.parse(configStr);
        } catch (e) {
          console.error('Error parsing interview config:', e);
        }
      }

      // Step 8: Send to backend for SDP negotiation
      const resp = await fetch(`${API_BASE_URL}/api/realtime/webrtc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdpOffer: offer.sdp,
          sessionId: sessionId,
          interviewType: config.type || interviewType || 'mixed',
          difficulty: config.difficulty || 'mid',
          role: config.role,
          company: config.company,
          jobLevel: config.jobLevel || 'mid',
          questionMix: config.questionMix || 'balanced',
          questionMixRatio: config.questionMixRatio,
          interviewStyle: config.interviewStyle || 'neutral'
        })
      });

      if (!resp.ok) {
        // Get the actual error response from backend
        const text = await resp.text();
        let errorMessage = `HTTP ${resp.status} from backend`;
        
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // If not JSON, use the text as-is
          errorMessage = text || errorMessage;
        }
        
        // Distinguish between route not found vs Azure API error
        if (resp.status === 404 && !text.includes('Realtime API')) {
          errorMessage = `Backend route not found (404). Check if server is running and route exists.`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await resp.json();
      if (!data.sdpAnswer) {
        throw new Error('No SDP answer in response');
      }

      // Step 9: Set remote description
      await pc.setRemoteDescription({ type: 'answer', sdp: data.sdpAnswer });
      debugLog('SDP answer set', { type: 'answer' });

      // Connection state tracking
      pc.onconnectionstatechange = () => {
        debugLog('Connection state changed', { state: pc.connectionState });
        if (pc.connectionState === 'connected') {
          setInterviewState(prev => ({ ...prev, status: 'listening' }));
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setInterviewState(prev => ({ ...prev, status: 'error', error: 'Connection failed' }));
        }
      };

      pc.oniceconnectionstatechange = () => {
        debugLog('ICE connection state changed', { state: pc.iceConnectionState });
      };

      isConnectingRef.current = false;
      setInterviewState(prev => ({ ...prev, status: 'listening' }));

    } catch (error) {
      console.error('Error starting interview:', error);
      isConnectingRef.current = false;
      startedRef.current = false;
      setInterviewState(prev => ({ ...prev, status: 'error', error: error.message }));
      setLastError({ type: 'connection_error', error: error.message });
      
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
  }, [sessionId, interviewType, debugLog, sendEvent]);

  // Handle DataChannel messages (Event Contract)
  const handleDataChannelMessage = useCallback((msg) => {
    debugLog('Message received', { type: msg.type });

    // Session lifecycle events
    if (msg.type === 'session.created') {
      debugLog('Session created', { session_id: msg.session?.id });
    } else if (msg.type === 'session.updated') {
      debugLog('Session updated', {});
    } else if (msg.type === 'error') {
      console.error('Error from Azure:', msg);
      setLastError({ type: 'azure_error', error: msg.error?.message || 'Unknown error' });
      setInterviewState(prev => ({ ...prev, status: 'error', error: msg.error?.message }));
    }
    
    // Model output events (Sonia's speech)
    else if (msg.type === 'response.output_text.delta') {
      if (msg.delta) {
        setCurrentQuestion(prev => (prev || '') + msg.delta);
        soniaSpeakingRef.current = true;
        setInterviewState(prev => ({ ...prev, aiSpeaking: true }));
      }
    } else if (msg.type === 'response.output_text.done') {
      const fullText = msg.text || currentQuestion;
      if (fullText) {
        setAiTranscript(prev => [...prev, {
          text: fullText,
          timestamp: new Date().toISOString(),
          speaker: 'interviewer'
        }]);
        setCurrentQuestion('');
        soniaSpeakingRef.current = false;
        setInterviewState(prev => ({ ...prev, aiSpeaking: false }));
      }
    } else if (msg.type === 'response.completed') {
      soniaSpeakingRef.current = false;
      setInterviewState(prev => ({ ...prev, aiSpeaking: false }));
      setQuestionCount(prev => prev + 1);
    }
    
    // Candidate transcription events (CRITICAL)
    else if (msg.type === 'input_audio_transcription.completed') {
      const text = msg.text || msg.transcript;
      if (text) {
        setUserTranscript(prev => [...prev, {
          text: text,
          timestamp: new Date().toISOString(),
          speaker: 'candidate'
        }]);
        candidateSpeakingRef.current = false;
        setInterviewState(prev => ({ ...prev, micActive: false }));
      }
    } else if (msg.type === 'input_audio_buffer.speech_started') {
      candidateSpeakingRef.current = true;
      setInterviewState(prev => ({ ...prev, micActive: true }));
    } else if (msg.type === 'input_audio_buffer.speech_stopped') {
      candidateSpeakingRef.current = false;
      setInterviewState(prev => ({ ...prev, micActive: false }));
    } else if (msg.type === 'input_audio_buffer.committed') {
      // Audio committed, waiting for transcription
    }
    
    // Turn management events
    else if (msg.type === 'conversation.item.created') {
      debugLog('Conversation item created', { item_id: msg.item?.id });
    } else if (msg.type === 'conversation.item.input_audio_transcription.completed') {
      // Alternative transcription event path
      const text = msg.transcript || msg.text;
      if (text) {
        setUserTranscript(prev => [...prev, {
          text: text,
          timestamp: new Date().toISOString(),
          speaker: 'candidate'
        }]);
      }
    }
    
    // Ignore all other events (per Event Contract)
    else {
      if (DEBUG) {
        console.log('[Realtime Debug] Unhandled event:', msg.type);
      }
    }
  }, [currentQuestion, debugLog]);

  // Stop interview - cleanup
  const stopInterview = useCallback(async () => {
    if (!startedRef.current) return;

    try {
      // 1. Stop all local media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // 2. Close data channel
      if (dcRef.current) {
        dcRef.current.close();
        dcRef.current = null;
      }

      // 3. Close peer connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      // 4. Clear audio element
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
        audioElementRef.current = null;
      }

      // 5. Clear all refs
      isConnectedRef.current = false;
      isConnectingRef.current = false;
      startedRef.current = false;
      soniaSpeakingRef.current = false;
      candidateSpeakingRef.current = false;

      // 6. Reset UI state
      setInterviewState({ status: 'idle', error: null, micActive: false, aiSpeaking: false });
      setShowAudioPrompt(false);

      // 7. Flush transcript to backend
      const finalTranscript = [
        ...aiTranscript.map(t => ({ ...t, speaker: 'interviewer' })),
        ...userTranscript.map(t => ({ ...t, speaker: 'candidate' }))
      ];

      if (finalTranscript.length > 0 && sessionId) {
        try {
          await fetch(`${API_BASE_URL}/api/interview/${sessionId}/transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: finalTranscript })
          });
        } catch (error) {
          console.error('Error saving transcript:', error);
        }
      }

    } catch (error) {
      console.error('Error stopping interview:', error);
    }
  }, [sessionId, aiTranscript, userTranscript]);

  // Enable audio (for autoplay prompt)
  const enableAudio = useCallback(async () => {
    if (audioElementRef.current) {
      try {
        await audioElementRef.current.play();
        setShowAudioPrompt(false);
      } catch (error) {
        console.error('Error enabling audio:', error);
        setLastError({ type: 'audio_error', error: error.message });
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopInterview();
    };
  }, [stopInterview]);

  return {
    interviewState,
    aiTranscript,
    userTranscript,
    currentQuestion,
    questionCount,
    reportId,
    showAudioPrompt,
    lastError,
    startInterview,
    stopInterview,
    enableAudio
  };
}
