import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { authFetch } from '../utils/apiClient';
import { getApiBaseUrl } from '../utils/apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

const DEBUG =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_REALTIME_DEBUG === 'true') ||
  process.env.REACT_APP_REALTIME_DEBUG === 'true';

export default function useRealtimeInterview(sessionId, interviewType = null) {
  const { getToken, isSignedIn } = useAuth();
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
  
  // Transcript refs (for internal storage - always current)
  const aiTranscriptRef = useRef([]);
  const userTranscriptRef = useRef([]);
  // Track which transcripts we've already captured (by response_id or item_id) to prevent duplicates
  const capturedTranscriptsRef = useRef(new Set());
  
  // Transcript state (for UI display - optional)
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
  const [reportId] = useState(null);
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

  // Handle DataChannel messages (Event Contract) - defined before startInterview to avoid use-before-define
  const handleDataChannelMessage = useCallback((msg) => {
    debugLog('Message received', { type: msg.type });
    
    // Enhanced logging for transcript-related events
    if (msg.type && (
      msg.type.includes('text') || 
      msg.type.includes('transcription') || 
      msg.type.includes('response') ||
      msg.type.includes('conversation')
    )) {
      console.log('📝 Transcript event:', msg.type, msg);
    }

    // Session lifecycle events
    if (msg.type === 'session.created') {
      debugLog('Session created', { session_id: msg.session?.id });
    } else if (msg.type === 'session.updated') {
      debugLog('Session updated', {});
    } else if (msg.type === 'error') {
      // Enhanced error logging - show full payload
      console.error('❌ Error from Azure Realtime API:', msg);
      console.error('❌ Azure error JSON:', JSON.stringify(msg, null, 2));
      if (msg.error) {
        console.error('❌ Azure error.details:', msg.error);
        console.error('❌ Azure error.message:', msg.error.message);
        console.error('❌ Azure error.code:', msg.error.code);
        console.error('❌ Azure error.type:', msg.error.type);
      }
      const errorMessage = msg.error?.message || msg.error?.code || 'Unknown error from Azure';
      setLastError({ type: 'azure_error', error: errorMessage, fullError: msg });
      setInterviewState(prev => ({ ...prev, status: 'error', error: errorMessage }));
    }
    
    // Model output events (Sonia's speech)
    // Handle text-based responses
    else if (msg.type === 'response.output_text.delta' || msg.type === 'response.text.delta') {
      if (msg.delta) {
        setCurrentQuestion(prev => (prev || '') + msg.delta);
        soniaSpeakingRef.current = true;
        setInterviewState(prev => ({ ...prev, aiSpeaking: true }));
      }
    } else if (msg.type === 'response.output_text.done' || msg.type === 'response.text.done') {
      const fullText = msg.text || msg.content || currentQuestion;
      if (fullText) {
        console.log('✅ Adding AI transcript (text):', fullText.substring(0, 50) + (fullText.length > 50 ? '...' : ''));
        const newEntry = {
          text: fullText,
          timestamp: new Date().toISOString(),
          speaker: 'interviewer'
        };
        aiTranscriptRef.current = [...aiTranscriptRef.current, newEntry];
        setAiTranscript(prev => {
          const exists = prev.some(t => t.text === fullText);
          if (exists) return prev;
          return [...prev, newEntry];
        });
        setCurrentQuestion('');
        soniaSpeakingRef.current = false;
        setInterviewState(prev => ({ ...prev, aiSpeaking: false }));
      }
    }
    // Handle audio transcript events (Azure Realtime API uses these)
    else if (msg.type === 'response.output_audio_transcript.delta') {
      // Accumulate delta chunks
      if (msg.delta) {
        setCurrentQuestion(prev => (prev || '') + msg.delta);
        soniaSpeakingRef.current = true;
        setInterviewState(prev => ({ ...prev, aiSpeaking: true }));
      }
    } else if (msg.type === 'response.output_audio_transcript.done') {
      // Full transcript is available - PRIMARY CAPTURE POINT
      const fullText = msg.transcript || currentQuestion;
      const responseId = msg.response_id;
      const transcriptKey = `${responseId}_${fullText}`;
      
      if (fullText && fullText.trim() && !capturedTranscriptsRef.current.has(transcriptKey)) {
        console.log('✅ Adding AI transcript (audio):', fullText.substring(0, 50) + (fullText.length > 50 ? '...' : ''));
        capturedTranscriptsRef.current.add(transcriptKey);
        const newEntry = {
          text: fullText,
          timestamp: new Date().toISOString(),
          speaker: 'interviewer'
        };
        aiTranscriptRef.current = [...aiTranscriptRef.current, newEntry];
        setAiTranscript(prev => [...prev, newEntry]);
        setCurrentQuestion('');
        soniaSpeakingRef.current = false;
        setInterviewState(prev => ({ ...prev, aiSpeaking: false, status: prev.status === 'connected' || prev.status === 'listening' ? 'listening' : prev.status }));
      }
    } else if (msg.type === 'response.content_part.done') {
      // Skip - already captured from response.output_audio_transcript.done
      // Only capture here if we missed it above
      const transcript = msg.part?.transcript || msg.content?.transcript || msg.transcript;
      const responseId = msg.response_id;
      const transcriptKey = `${responseId}_${transcript}`;
      
      if (transcript && transcript.trim() && !capturedTranscriptsRef.current.has(transcriptKey)) {
        console.log('✅ Adding AI transcript (content_part fallback):', transcript.substring(0, 50) + (transcript.length > 50 ? '...' : ''));
        capturedTranscriptsRef.current.add(transcriptKey);
        const newEntry = {
          text: transcript,
          timestamp: new Date().toISOString(),
          speaker: 'interviewer'
        };
        aiTranscriptRef.current = [...aiTranscriptRef.current, newEntry];
        setAiTranscript(prev => [...prev, newEntry]);
      }
    } else if (msg.type === 'conversation.item.done' || msg.type === 'response.output_item.done') {
      // Skip - already captured from response.output_audio_transcript.done
      // Only use as fallback if primary capture missed
      const item = msg.item || msg;
      if (item.content && Array.isArray(item.content)) {
        item.content.forEach(content => {
          if (content.type === 'output_audio' && content.transcript) {
            const transcript = content.transcript;
            const itemId = item.id || msg.item_id;
            const transcriptKey = `${itemId}_${transcript}`;
            
            if (transcript && transcript.trim() && !capturedTranscriptsRef.current.has(transcriptKey)) {
              console.log('✅ Adding AI transcript (item.done fallback):', transcript.substring(0, 50) + (transcript.length > 50 ? '...' : ''));
              capturedTranscriptsRef.current.add(transcriptKey);
              const newEntry = {
                text: transcript,
                timestamp: new Date().toISOString(),
                speaker: 'interviewer'
              };
              aiTranscriptRef.current = [...aiTranscriptRef.current, newEntry];
              setAiTranscript(prev => [...prev, newEntry]);
            }
          }
        });
      }
    } else if (msg.type === 'response.done') {
      // Skip - already captured from response.output_audio_transcript.done
      // Only use as fallback
      if (msg.response?.output && Array.isArray(msg.response.output)) {
        msg.response.output.forEach(outputItem => {
          if (outputItem.content && Array.isArray(outputItem.content)) {
            outputItem.content.forEach(content => {
              if (content.type === 'output_audio' && content.transcript) {
                const transcript = content.transcript;
                const responseId = msg.response?.id || msg.response_id;
                const transcriptKey = `${responseId}_${transcript}`;
                
                if (transcript && transcript.trim() && !capturedTranscriptsRef.current.has(transcriptKey)) {
                  console.log('✅ Adding AI transcript (response.done fallback):', transcript.substring(0, 50) + (transcript.length > 50 ? '...' : ''));
                  capturedTranscriptsRef.current.add(transcriptKey);
                  const newEntry = {
                    text: transcript,
                    timestamp: new Date().toISOString(),
                    speaker: 'interviewer'
                  };
                  aiTranscriptRef.current = [...aiTranscriptRef.current, newEntry];
                  setAiTranscript(prev => [...prev, newEntry]);
                }
              }
            });
          }
        });
      }
      soniaSpeakingRef.current = false;
      setInterviewState(prev => ({ 
        ...prev, 
        aiSpeaking: false,
        status: prev.status === 'connected' || prev.status === 'listening' ? 'listening' : prev.status
      }));
      setQuestionCount(prev => prev + 1);
    } else if (msg.type === 'response.completed') {
      // Legacy handler
      if (msg.response?.output_text || msg.text || msg.content) {
        const fullText = msg.response?.output_text || msg.text || msg.content;
        if (fullText) {
          console.log('✅ Adding AI transcript (response.completed):', fullText.substring(0, 50) + (fullText.length > 50 ? '...' : ''));
          const newEntry = {
            text: fullText,
            timestamp: new Date().toISOString(),
            speaker: 'interviewer'
          };
          aiTranscriptRef.current = [...aiTranscriptRef.current, newEntry];
          // Don't update state - internal storage only
          // setAiTranscript(prev => [...prev, newEntry]);
        }
      }
      soniaSpeakingRef.current = false;
      setInterviewState(prev => ({ ...prev, aiSpeaking: false }));
      setQuestionCount(prev => prev + 1);
    }
    
    // Candidate transcription events (CRITICAL)
    else if (msg.type === 'input_audio_transcription.completed' || 
             msg.type === 'conversation.item.input_audio_transcription.completed' ||
             msg.type === 'input_audio_buffer.transcription.completed') {
      const text = msg.text || msg.transcript || msg.content;
      const itemId = msg.item_id || msg.conversation_item_id;
      const transcriptKey = `user_${itemId}_${text}`;
      
      if (text && text.trim() && !capturedTranscriptsRef.current.has(transcriptKey)) {
        console.log('✅ Adding user transcript:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
        capturedTranscriptsRef.current.add(transcriptKey);
        const newEntry = {
          text: text,
          timestamp: new Date().toISOString(),
          speaker: 'candidate'
        };
        userTranscriptRef.current = [...userTranscriptRef.current, newEntry];
        setUserTranscript(prev => [...prev, newEntry]);
        candidateSpeakingRef.current = false;
        setInterviewState(prev => ({ 
          ...prev, 
          micActive: false,
          status: prev.status === 'connected' || prev.status === 'listening' ? 'listening' : prev.status
        }));
      }
    } else if (msg.type === 'input_audio_buffer.speech_started') {
      candidateSpeakingRef.current = true;
      setInterviewState(prev => ({ ...prev, micActive: true }));
    } else if (msg.type === 'input_audio_buffer.speech_stopped') {
      candidateSpeakingRef.current = false;
      setInterviewState(prev => ({ ...prev, micActive: false }));
    } else if (msg.type === 'input_audio_buffer.committed') {
      // Audio committed, waiting for transcription
      console.log('📝 Audio committed, waiting for transcription...');
    }
    
    // Turn management events
    else if (msg.type === 'conversation.item.created' || msg.type === 'conversation.item.added') {
      debugLog('Conversation item created/added', { item_id: msg.item?.id });
      const item = msg.item;
      
      // Check for AI transcript (output_audio) - only if not already captured
      if (item?.content && Array.isArray(item.content)) {
        item.content.forEach(content => {
          if (content.type === 'output_audio' && content.transcript) {
            const transcript = content.transcript;
            const itemId = item.id;
            const transcriptKey = `${itemId}_${transcript}`;
            
            if (transcript && transcript.trim() && !capturedTranscriptsRef.current.has(transcriptKey)) {
              console.log('✅ Adding AI transcript (item.added fallback):', transcript.substring(0, 50) + (transcript.length > 50 ? '...' : ''));
              capturedTranscriptsRef.current.add(transcriptKey);
              const newEntry = {
                text: transcript,
                timestamp: new Date().toISOString(),
                speaker: 'interviewer'
              };
              aiTranscriptRef.current = [...aiTranscriptRef.current, newEntry];
              // Don't update state - internal storage only
              // setAiTranscript(prev => [...prev, newEntry]);
            }
          }
        });
      }
      
      // Check for USER transcript (input_audio_transcription)
      if (item?.input_audio_transcription) {
        const transcript = item.input_audio_transcription.text || item.input_audio_transcription.transcript;
        const itemId = item.id;
        const transcriptKey = `user_${itemId}_${transcript}`;
        
        if (transcript && transcript.trim() && !capturedTranscriptsRef.current.has(transcriptKey)) {
          console.log('✅ Adding user transcript (item.added):', transcript.substring(0, 50) + (transcript.length > 50 ? '...' : ''));
          capturedTranscriptsRef.current.add(transcriptKey);
          const newEntry = {
            text: transcript,
            timestamp: new Date().toISOString(),
            speaker: 'candidate'
          };
          userTranscriptRef.current = [...userTranscriptRef.current, newEntry];
          // Don't update state - internal storage only
          // setUserTranscript(prev => [...prev, newEntry]);
        }
      }
    } else if (msg.type === 'conversation.item.completed') {
      // Check if conversation item has transcript
      const item = msg.item;
      let transcript = null;
      
      // Check multiple possible locations for user transcript
      if (item?.input_audio_transcription) {
        transcript = item.input_audio_transcription.text || item.input_audio_transcription.transcript;
      } else if (item?.transcript) {
        transcript = item.transcript;
      } else if (msg.transcript) {
        transcript = msg.transcript;
      }
      
      const itemId = item?.id;
      const transcriptKey = `user_${itemId}_${transcript}`;
      
      if (transcript && transcript.trim() && !capturedTranscriptsRef.current.has(transcriptKey)) {
        console.log('✅ Adding user transcript from conversation.item.completed:', transcript.substring(0, 50) + (transcript.length > 50 ? '...' : ''));
        capturedTranscriptsRef.current.add(transcriptKey);
        const newEntry = {
          text: transcript,
          timestamp: new Date().toISOString(),
          speaker: 'candidate'
        };
        userTranscriptRef.current = [...userTranscriptRef.current, newEntry];
        // Don't update state - internal storage only
        // setUserTranscript(prev => [...prev, newEntry]);
      }
    }
    
    // Ignore all other events (per Event Contract)
    else {
      if (DEBUG) {
        console.log('[Realtime Debug] Unhandled event:', msg.type, msg);
      }
      // Log all events for debugging transcript collection
      if (msg.type && (msg.type.includes('text') || msg.type.includes('transcription') || msg.type.includes('response') || msg.type.includes('conversation'))) {
        console.log('🔍 Unhandled transcript-related event:', msg.type, JSON.stringify(msg, null, 2));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- aiTranscript/userTranscript used in closure for transcript logging
  }, [currentQuestion, debugLog, aiTranscript, userTranscript]);

  // Start interview - WebRTC connection
  const startInterview = useCallback(async () => {
    if (!isSignedIn) {
      const msg = 'Please sign in to start the interview.';
      setInterviewState(prev => ({ ...prev, status: 'error', error: msg }));
      setLastError({ type: 'auth_error', error: msg });
      return;
    }

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
        
        // Send session.update with correct OpenAI Realtime API format
        try {
          sendEvent({
            type: 'session.update',
            session: {
              turn_detection: {
                type: 'server_vad',
                threshold: 0.7,
                silence_duration_ms: 600
              },
              input_audio_transcription: {
                model: 'whisper-1'
              }
            }
          });
          debugLog('Sent session.update (turn_detection)', {});
        } catch (err) {
          console.error('Error sending session.update:', err);
        }

        // SEND RESPONSE.CREATE SECOND (without modalities - they're configured in backend session)
        try {
          sendEvent({
            type: 'response.create',
            response: {
              instructions: "You MUST speak ONLY in English. Introduce yourself as Sonia in English: 'Hello, I'm Sonia, and I'll be conducting your interview today.' Then ask the first interview question in English only."
            }
          });
          debugLog('Sent response.create', {});
        } catch (err) {
          console.error('Error sending response.create:', err);
        }
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

      // Step 8: Send to backend for SDP negotiation (with Clerk auth)
      const token = getToken ? await getToken() : null;
      const resp = await authFetch(`${API_BASE_URL}/api/realtime/webrtc`, token, {
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
        // Enhanced error logging - show full response
        const text = await resp.text();
        console.error(`❌ Azure HTTP error: ${resp.status} ${resp.statusText}`);
        console.error(`❌ Response URL: ${resp.url}`);
        console.error(`❌ Response headers:`, Object.fromEntries(resp.headers.entries()));
        console.error(`❌ Response body:`, text);
        
        let errorMessage = `HTTP ${resp.status} from backend`;
        
        try {
          const errorData = JSON.parse(text);
          console.error(`❌ Parsed error data:`, JSON.stringify(errorData, null, 2));
          errorMessage = errorData.detail || errorData.message || errorMessage;
          
          // Log nested error details if present
          if (errorData.error) {
            console.error(`❌ Nested error:`, JSON.stringify(errorData.error, null, 2));
          }
        } catch {
          // If not JSON, use the text as-is
          errorMessage = text || errorMessage;
        }
        
        // Distinguish between route not found vs Azure API error
        if (resp.status === 404 && !text.includes('Realtime API')) {
          errorMessage = `Backend route not found (404). Check if server is running and route exists.`;
        } else if (resp.status === 401) {
          errorMessage = `Authentication failed (401). Check your Azure API key and endpoint configuration.`;
        } else if (resp.status === 400) {
          errorMessage = `Bad request (400). ${errorMessage}. Check deployment name and API version.`;
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
      // Enhanced error logging
      console.error('❌ Error starting interview:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      if (error.cause) {
        console.error('❌ Error cause:', error.cause);
      }
      
      isConnectingRef.current = false;
      startedRef.current = false;
      setInterviewState(prev => ({ ...prev, status: 'error', error: error.message }));
      setLastError({ type: 'connection_error', error: error.message, fullError: error });
      
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
  }, [sessionId, interviewType, debugLog, sendEvent, handleDataChannelMessage, getToken, isSignedIn]);

  // Helper function to save transcript to backend
  // Uses refs to ensure we always have the latest transcripts
  const saveTranscriptToBackend = useCallback(async (sessionId) => {
    if (!sessionId) return;
    
    // Use refs to get current transcripts (always up-to-date)
    const aiTranscripts = aiTranscriptRef.current;
    const userTranscripts = userTranscriptRef.current;
    
    const finalTranscript = [
      ...aiTranscripts.map(t => ({ 
        speaker: t.speaker || 'interviewer', 
        text: t.text || '', 
        timestamp: t.timestamp || new Date().toISOString() 
      })),
      ...userTranscripts.map(t => ({ 
        speaker: t.speaker || 'candidate', 
        text: t.text || '', 
        timestamp: t.timestamp || new Date().toISOString() 
      }))
    ].sort((a, b) => {
      // Sort by timestamp to maintain chronological order
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    if (finalTranscript.length === 0) {
      console.log('⚠️ No transcript data to save');
      console.log('   AI Transcript count:', aiTranscripts.length);
      console.log('   User Transcript count:', userTranscripts.length);
      return;
    }

    console.log(`💾 Saving transcript: ${finalTranscript.length} entries (${finalTranscript.filter(t => t.speaker === 'interviewer').length} AI, ${finalTranscript.filter(t => t.speaker === 'candidate').length} user)`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/interview/${sessionId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: finalTranscript })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save transcript: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Transcript saved successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Error saving transcript:', error);
      console.error('❌ Transcript data:', finalTranscript);
      throw error;
    }
  }, []);

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

      // 5. Flush transcript to backend FIRST (before clearing state)
      await saveTranscriptToBackend(sessionId);

      // 6. Clear all refs
      isConnectedRef.current = false;
      isConnectingRef.current = false;
      startedRef.current = false;
      soniaSpeakingRef.current = false;
      candidateSpeakingRef.current = false;

      // 7. Reset UI state (only after saving transcript)
      setInterviewState({ status: 'idle', error: null, micActive: false, aiSpeaking: false });
      setShowAudioPrompt(false);
      
      // 8. Clear transcript tracking (optional - comment out if you want to keep them)
      // aiTranscriptRef.current = [];
      // userTranscriptRef.current = [];
      // capturedTranscriptsRef.current.clear();

    } catch (error) {
      console.error('Error stopping interview:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- aiTranscript/userTranscript used when saving
  }, [sessionId, aiTranscript, userTranscript, saveTranscriptToBackend]);

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

  // Periodic auto-save every 2 minutes (less frequent to avoid interrupting interview)
  // User doesn't need live transcript, so we save less frequently
  useEffect(() => {
    if (!isConnectedRef.current || !sessionId) return;

    const autoSaveInterval = setInterval(() => {
      const aiCount = aiTranscriptRef.current.length;
      const userCount = userTranscriptRef.current.length;
      if (aiCount > 0 || userCount > 0) {
        // Save silently in background - don't log to avoid console spam
        saveTranscriptToBackend(sessionId).catch(err => {
          // Only log errors, not success
          console.warn('⚠️ Auto-save failed:', err);
        });
      }
    }, 120000); // Every 2 minutes (less frequent)

    return () => clearInterval(autoSaveInterval);
  }, [sessionId, saveTranscriptToBackend]);

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
