import React, { useState, useRef, useCallback } from 'react';
import { Button, Box, Typography, Paper, Divider } from '@mui/material';
import { useAuth } from "@clerk/clerk-react";
import { authFetch } from "../utils/apiClient";

// Support both Create React App (process.env) and Vite (import.meta.env)
const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:8000";

export default function RealtimeTestPage() {
  const { getToken } = useAuth();
  // WebRTC refs
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioElementRef = useRef(null);
  
  // State
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | ready | error | disconnected
  const [connectionInfo, setConnectionInfo] = useState({
    backendEndpoint: `${API_BASE_URL}/api/realtime/webrtc`,
    azureEndpoint: null,
    region: null,
    deployment: null,
    iceState: null,
    signalingState: null
  });
  const [micActive, setMicActive] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [error, setError] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);

  // Add transcript entry
  const addTranscript = useCallback((speaker, text) => {
    setTranscript(prev => [...prev, {
      speaker,
      text,
      timestamp: new Date().toISOString()
    }]);
  }, []);

  // Connect to Realtime API
  const handleConnect = useCallback(async () => {
    if (status === 'connecting' || status === 'connected' || status === 'ready') {
      return;
    }

    setStatus('connecting');
    setError(null);
    setTranscript([]);

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
        setConnectionInfo(prev => ({ ...prev, signalingState: state }));
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
        setConnectionInfo(prev => ({ ...prev, iceState }));
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
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.7,
                  silence_duration_ms: 600
                }
              }
            }));
            addTranscript('system', 'Sent session.update');
          } catch (err) {
            console.error('Error sending session.update:', err);
          }

          // Send initial response.create
          try {
            dc.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['text', 'audio'],
                instructions: "Say hello and introduce yourself. Keep responses short and conversational."
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
          setLastEvent({ type: msg.type, timestamp: new Date().toISOString() });
          console.log('Message received:', msg.type, msg);

          // Handle messages inline to avoid dependency issues
          if (msg.type === 'session.created') {
            addTranscript('system', 'Azure session created');
          } else if (msg.type === 'session.updated') {
            addTranscript('system', 'Session updated');
          } else if (msg.type === 'error') {
            setError(msg.error?.message || 'Azure API error');
            addTranscript('system', `Error: ${msg.error?.message || 'Unknown error'}`);
          } else if (msg.type === 'response.output_text.delta') {
            if (msg.delta) {
              setAiSpeaking(true);
              setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last && last.speaker === 'ai' && !last.final) {
                  return [...prev.slice(0, -1), { ...last, text: last.text + msg.delta }];
                }
                return [...prev, { speaker: 'ai', text: msg.delta, final: false, timestamp: new Date().toISOString() }];
              });
            }
          } else if (msg.type === 'response.output_text.done') {
            setAiSpeaking(false);
            setTranscript(prev => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === 'ai') {
                return [...prev.slice(0, -1), { ...last, text: msg.text || last.text, final: true }];
              }
              return prev;
            });
          } else if (msg.type === 'response.completed') {
            setAiSpeaking(false);
          } else if (msg.type === 'input_audio_transcription.completed') {
            const text = msg.text || msg.transcript;
            if (text) {
              addTranscript('user', text);
              setMicActive(false);
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

      // Step 7: Send to backend
      addTranscript('system', `Sending SDP offer to backend...`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0ac307e-28cd-42c1-a0e2-49a4854100b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RealtimeTestPage.jsx:246',message:'Sending SDP offer to backend',data:{api_base_url:API_BASE_URL,sdp_length:offer.sdp.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      const token = await getToken();
      const resp = await authFetch(`${API_BASE_URL}/api/realtime/webrtc`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdpOffer: offer.sdp,
          sessionId: `test_${Date.now()}`,
          interviewType: 'mixed',
          difficulty: 'mid'
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
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0ac307e-28cd-42c1-a0e2-49a4854100b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RealtimeTestPage.jsx:257',message:'Backend request failed',data:{status:resp.status,error_message:errorMessage.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // Distinguish between route not found vs Azure API error
        if (resp.status === 404 && !text.includes('Realtime API')) {
          errorMessage = `Backend route not found (404). Check if server is running and route exists.`;
        }
        
        addTranscript('system', `Backend error: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const data = await resp.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0ac307e-28cd-42c1-a0e2-49a4854100b9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RealtimeTestPage.jsx:279',message:'Backend response received',data:{has_sdp_answer:!!data.sdpAnswer,response_keys:Object.keys(data)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      if (!data.sdpAnswer) {
        throw new Error('No SDP answer in response');
      }

      addTranscript('system', 'SDP answer received from backend');
      
      // Update connection info if available in response
      if (data.azureEndpoint) {
        setConnectionInfo(prev => ({ ...prev, azureEndpoint: data.azureEndpoint }));
      }
      if (data.region) {
        setConnectionInfo(prev => ({ ...prev, region: data.region }));
      }
      if (data.deployment) {
        setConnectionInfo(prev => ({ ...prev, deployment: data.deployment }));
      }

      // Step 8: Set remote description
      if (!data.sdpAnswer) {
        throw new Error('No SDP answer in response from backend');
      }
      
      await pc.setRemoteDescription({ type: 'answer', sdp: data.sdpAnswer });
      addTranscript('system', 'Remote description set, connection establishing...');
      
      // Connection will be established via WebRTC ICE candidates
      // Status will update via onconnectionstatechange handler

    } catch (err) {
      console.error('Connection error:', err);
      setStatus('error');
      
      // Provide more helpful error messages
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
  }, [status, addTranscript]);

  // Disconnect
  const handleDisconnect = useCallback(() => {
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
    addTranscript('system', 'Disconnected');
  }, [addTranscript]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return '#4ade80';
      case 'connected': return '#3b82f6';
      case 'connecting': return '#fbbf24';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', p: 4, backgroundColor: '#f5f5f5' }}>
      <Paper sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Typography variant="h4" gutterBottom>
          GPT Realtime API Test
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Simple test page to debug WebRTC connection to Azure OpenAI Realtime API
        </Typography>

        <Divider sx={{ my: 3 }} />

        {/* Connection Controls */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConnect}
            disabled={status === 'connecting' || status === 'connected' || status === 'ready'}
          >
            {status === 'connecting' ? 'Connecting...' : status === 'connected' || status === 'ready' ? 'Connected' : 'Connect'}
          </Button>
          
          {status === 'error' && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => {
                setError(null);
                setStatus('idle');
                setTranscript([]);
                handleConnect();
              }}
            >
              Retry Connection
            </Button>
          )}
          
          <Button
            variant="outlined"
            color="error"
            onClick={handleDisconnect}
            disabled={status === 'idle' || status === 'disconnected'}
          >
            Disconnect
          </Button>

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(status)
                }}
              />
              <Typography variant="body2">
                Status: <strong>{status}</strong>
              </Typography>
            </Box>
            
            {micActive && (
              <Typography variant="body2" sx={{ color: '#4ade80' }}>
                🎤 Mic Active
              </Typography>
            )}
            
            {aiSpeaking && (
              <Typography variant="body2" sx={{ color: '#3b82f6' }}>
                🔊 AI Speaking
              </Typography>
            )}
          </Box>
        </Box>

        {/* Connection Info */}
        <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f9fafb' }}>
          <Typography variant="subtitle2" gutterBottom>Connection Information</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, fontSize: '0.875rem' }}>
            <div><strong>Backend:</strong> {connectionInfo.backendEndpoint}</div>
            <div><strong>Region:</strong> {connectionInfo.region || 'Not set'}</div>
            <div><strong>Deployment:</strong> {connectionInfo.deployment || 'Not set'}</div>
            <div><strong>ICE State:</strong> {connectionInfo.iceState || 'N/A'}</div>
            <div><strong>Signaling State:</strong> {connectionInfo.signalingState || 'N/A'}</div>
            {lastEvent && (
              <div><strong>Last Event:</strong> {lastEvent.type} ({new Date(lastEvent.timestamp).toLocaleTimeString()})</div>
            )}
          </Box>
        </Paper>

        {/* Error Display */}
        {error && (
          <Paper sx={{ p: 2, mb: 3, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
            <Typography variant="subtitle2" color="error" gutterBottom>Error</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>{error}</Typography>
            {error.includes('permission') || error.includes('Permission') ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  How to fix:
                </Typography>
                <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 1 }}>
                  <li>Click the lock/info icon in your browser's address bar</li>
                  <li>Find "Microphone" in the permissions list</li>
                  <li>Change it to "Allow"</li>
                  <li>Refresh the page and try again</li>
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setError(null);
                    setStatus('idle');
                    setTranscript([]);
                  }}
                >
                  Clear Error & Retry
                </Button>
              </Box>
            ) : null}
          </Paper>
        )}

        {/* Transcript */}
        <Paper sx={{ p: 2, mb: 3, minHeight: 400, maxHeight: 600, overflowY: 'auto', backgroundColor: '#ffffff' }}>
          <Typography variant="subtitle2" gutterBottom>Transcript</Typography>
          {transcript.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No messages yet. Click Connect to start.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {transcript.map((msg, idx) => (
                <Box
                  key={idx}
                  sx={{
                    alignSelf: msg.speaker === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: msg.speaker === 'user' ? '#dbeafe' : msg.speaker === 'system' ? '#f3f4f6' : '#f0fdf4',
                    border: msg.speaker === 'system' ? '1px solid #e5e7eb' : 'none'
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: msg.speaker === 'system' ? 500 : 400 }}>
                    {msg.speaker === 'user' ? 'You' : msg.speaker === 'ai' ? 'AI' : 'System'}: {msg.text}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        {/* Debug Info */}
        <Paper sx={{ p: 2, backgroundColor: '#f9fafb' }}>
          <Typography variant="subtitle2" gutterBottom>Debug Information</Typography>
          <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem', overflow: 'auto' }}>
            {JSON.stringify({ status, micActive, aiSpeaking, transcriptCount: transcript.length }, null, 2)}
          </Typography>
        </Paper>
      </Paper>
    </Box>
  );
}
