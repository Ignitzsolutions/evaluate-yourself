import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
import { useUser } from "@clerk/clerk-react";
import useRealtimeInterview from "../hooks/useRealtimeInterview";
// Gaze tracking disabled - focusing on core Q&A functionality
// import { useGazeSocket } from "../hooks/useGazeSocket";
import {
  Stop,
  ExitToApp,
  Dashboard as DashboardIcon,
} from "@mui/icons-material";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Avatar,
  Box,
} from "@mui/material";
import "../ui.css";

// Gaze tracking disabled - focusing on core Q&A functionality
// const GAZE_WS_URL = process.env.REACT_APP_GAZE_WS_URL || process.env.VITE_GAZE_WS_URL || "ws://localhost:8000/ws";

export default function InterviewSessionRoom() {
  const params = useParams();
  // Generate sessionId if not provided - support both route patterns
  const sessionId = useMemo(() => {
    if (params.sessionId) return params.sessionId;
    if (params.type) {
      // Coming from /interview/:type - generate sessionId
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // Fallback - should not happen but handle gracefully
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, [params.sessionId, params.type]);
  const typeFromUrl = params.type; // If coming from /interview/:type route
  const navigate = useNavigate();
  // const { user } = useAuth();
  const { user, isSignedIn } = useUser();

  
  // Get interview type from sessionStorage, URL params, or defaults
  const [interviewType, setInterviewType] = useState(typeFromUrl || "behavioral");
  const [maxQuestions, setMaxQuestions] = useState(6);
  
  useEffect(() => {
    const config = sessionStorage.getItem("interviewConfig");
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setInterviewType(parsed.type || typeFromUrl || "behavioral");
        setMaxQuestions(parsed.duration ? parseInt(parsed.duration) : 6);
      } catch (e) {
        console.error("Error parsing config:", e);
      }
    } else if (typeFromUrl) {
      // If no config but type in URL, use it
      setInterviewType(typeFromUrl);
    }
  }, [typeFromUrl]);

  // Permission states
  const [hasVideoPermission, setHasVideoPermission] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  // isVideoOn and isAudioOn kept for state management but always true when permission granted
  // eslint-disable-next-line no-unused-vars
  const [isVideoOn, setIsVideoOn] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [isAudioOn, setIsAudioOn] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [uiError, setUiError] = useState(null);
  
  // Stream refs
  const videoStreamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Get configuration from sessionStorage
  const [config, setConfig] = useState(null);
  useEffect(() => {
    const configStr = sessionStorage.getItem("interviewConfig");
    if (configStr) {
      try {
        setConfig(JSON.parse(configStr));
      } catch (e) {
        console.error("Error parsing config:", e);
      }
    }
  }, []);

  // Interview hook
  const {
    interviewState,
    aiTranscript,
    userTranscript,
    currentQuestion,
    questionCount,
    reportId,
    showAudioPrompt,
    // eslint-disable-next-line no-unused-vars
    lastError,
    startInterview,
    stopInterview,
    enableAudio,
  } = useRealtimeInterview(sessionId, interviewType);
  
  // Captions visibility (from config)
  const [captionsVisible, setCaptionsVisible] = useState(true);
  useEffect(() => {
    if (config?.captionsEnabled !== undefined) {
      setCaptionsVisible(config.captionsEnabled);
    }
  }, [config]);
  
  // Gaze tracking disabled - focusing on core Q&A functionality
  // const { connected: gazeConnected, connect: connectGaze, disconnect: disconnectGaze, sendFrame, metrics: gazeMetrics } = useGazeSocket(GAZE_WS_URL);
  // Gaze tracking disabled - focusing on core Q&A functionality
  // const rollingWindow = 30000; // 30 seconds
  // 
  // useEffect(() => {
  //   if (gazeMetrics?.eyeContact !== undefined) {
  //     setGazeHistory(prev => {
  //       const newHistory = [...prev, {
  //         eyeContact: gazeMetrics.eyeContact,
  //         timestamp: Date.now()
  //       }].filter(item => Date.now() - item.timestamp < rollingWindow);
  //       return newHistory;
  //     });
  //   }
  // }, [gazeMetrics]);
  // 
  // const eyeContactPct = useMemo(() => {
  //   if (gazeHistory.length === 0) return 0;
  //   const inContact = gazeHistory.filter(g => g.eyeContact).length;
  //   return Math.round((inContact / gazeHistory.length) * 100);
  // }, [gazeHistory]);
  // 
  // const attentionStatus = useMemo(() => {
  //   if (gazeHistory.length === 0) return "Unknown";
  //   const recent = gazeHistory.slice(-10); // Last 10 samples
  //   const inContact = recent.filter(g => g.eyeContact).length;
  //   return inContact >= 7 ? "On screen" : "Away";
  // }, [gazeHistory]);
  
  // Timer
  const [timeElapsed, setTimeElapsed] = useState(0);
  useEffect(() => {
    let interval;
    if (hasJoined && (interviewState.status === 'connected' || interviewState.status === 'listening' || interviewState.status === 'responding')) {
      interval = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hasJoined, interviewState.status]);
  
  // Request permissions on "Join Interview" click
  const handleJoinInterview = async () => {
    // Guard: prevent multiple calls
    if (hasJoined || interviewState.status === 'connecting' || interviewState.status === 'connected' || interviewState.status === 'listening' || interviewState.status === 'responding') {
      console.warn('⚠️ Interview already started or in progress, ignoring duplicate call');
      return;
    }
    
    try {
      setHasJoined(true);
      // The hook will handle permissions internally
      await startInterview();
      
      // Gaze tracking disabled - focusing on core Q&A functionality
      // connectGaze();
      
    } catch (err) {
      setPermissionError(err);
      
      // Check what was denied
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        // Try to get audio only as fallback
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          setHasAudioPermission(true);
          setIsAudioOn(true);
          setHasVideoPermission(false);
          setIsVideoOn(false);
          setHasJoined(true);
          await startInterview();
          setShowPermissionModal(false);
        } catch (audioErr) {
          // Both denied - show modal
          setShowPermissionModal(true);
        }
      } else {
        // Other error (e.g., NotFoundError) - show modal
        setShowPermissionModal(true);
      }
    }
  };
  
  // Handle permission modal actions
  const handleTryAgain = () => {
    setShowPermissionModal(false);
    setPermissionError(null);
    handleJoinInterview();
  };
  
  const handleContinueWithoutVideo = async () => {
    // Guard: prevent multiple calls
    if (hasJoined || interviewState.status === 'connecting' || interviewState.status === 'connected' || interviewState.status === 'listening' || interviewState.status === 'responding') {
      console.warn('⚠️ Interview already started or in progress, ignoring duplicate call');
      return;
    }
    
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasAudioPermission(true);
      setIsAudioOn(true);
      setHasVideoPermission(false);
      setIsVideoOn(false);
      setHasJoined(true);
      await startInterview();
      setShowPermissionModal(false);
    } catch (err) {
      setShowPermissionModal(true);
    }
  };
  
  const handleUseTextInstead = () => {
    // Guard: prevent multiple calls
    if (hasJoined || interviewState.status === 'connecting' || interviewState.status === 'connected' || interviewState.status === 'listening' || interviewState.status === 'responding') {
      console.warn('⚠️ Interview already started or in progress, ignoring duplicate call');
      return;
    }
    
    setHasJoined(true);
    startInterview();
    setShowPermissionModal(false);
    // TODO: Implement text mode
  };
  
  // Mic and camera toggles removed - always enabled
  // Toggle mic - disabled (always on)
  // const handleToggleMic = () => {
  //   // No-op - mic always enabled
  // };
  
  // Toggle camera - disabled (always on)
  // const handleToggleCamera = () => {
  //   // No-op - camera always enabled when permission granted
  // };
  
  // Gaze tracking disabled - focusing on core Q&A functionality
  // Send frames for gaze tracking
  // useEffect(() => {
  //   if (!isVideoOn || !gazeConnected || !videoRef.current) return;
  //   
  //   let raf = 0;
  //   let last = 0;
  //   const fps = 8;
  //   const interval = 1000 / fps;
  //   
  //   const loop = (t) => {
  //     raf = requestAnimationFrame(loop);
  //     if (t - last < interval) return;
  //     last = t;
  //     
  //     const video = videoRef.current;
  //     const canvas = canvasRef.current;
  //     if (!video || !canvas) return;
  //     
  //     const ctx = canvas.getContext("2d");
  //     const W = 320;
  //     const H = 240;
  //     canvas.width = W;
  //     canvas.height = H;
  //     ctx.drawImage(video, 0, 0, W, H);
  //     const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
  //     sendFrame(dataUrl);
  //   };
  //   
  //   raf = requestAnimationFrame(loop);
  //   return () => cancelAnimationFrame(raf);
  // }, [isVideoOn, gazeConnected, sendFrame]);
  
  // Auto-start removed - interview starts explicitly via startInterview() call
  
  // Gaze tracking disabled - focusing on core Q&A functionality
  // Send gaze metrics when user transcript updates (answer completed)
  // const lastTranscriptLengthRef = useRef(0);
  // useEffect(() => {
  //   if (userTranscript.length > lastTranscriptLengthRef.current && gazeHistory.length > 0 && sendGazeMetrics) {
  //     // New answer completed - calculate metrics for the period since last answer
  //     const recentGaze = gazeHistory.slice(-30); // Last 30 samples (roughly last answer period)
  //     const awayEvents = recentGaze.filter((g, idx) => 
  //       idx > 0 && !g.eyeContact && recentGaze[idx - 1].eyeContact
  //     ).length;
  //     
  //     const awayDurations = [];
  //     let currentAwayStart = null;
  //     recentGaze.forEach((g) => {
  //       if (!g.eyeContact && currentAwayStart === null) {
  //         currentAwayStart = g.timestamp;
  //       } else if (g.eyeContact && currentAwayStart !== null) {
  //         awayDurations.push(g.timestamp - currentAwayStart);
  //         currentAwayStart = null;
  //       }
  //     });
  //     // Handle case where away period extends to end
  //     if (currentAwayStart !== null && recentGaze.length > 0) {
  //       awayDurations.push(Date.now() - currentAwayStart);
  //     }
  //     const longestAwayDuration = awayDurations.length > 0 ? Math.max(...awayDurations) : 0;
  //     
  //     const avgEyeContact = recentGaze.length > 0
  //       ? Math.round((recentGaze.filter(g => g.eyeContact).length / recentGaze.length) * 100)
  //       : 0;
  //     
  //     // Send to backend
  //     sendGazeMetrics({
  //       eyeContactPct: avgEyeContact,
  //       awayEvents: awayEvents,
  //       longestAwayDuration: longestAwayDuration
  //     });
  //     
  //     lastTranscriptLengthRef.current = userTranscript.length;
  //   }
  // }, [userTranscript.length, gazeHistory, sendGazeMetrics]);
  
  // Navigate to report when complete
  useEffect(() => {
    if (reportId) {
      setTimeout(() => {
        navigate(`/report/${reportId}`);
      }, 2000);
    }
  }, [reportId, navigate]);
  
  // Cleanup on unmount
  useEffect(() => {
    const videoStream = videoStreamRef.current;
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      // Gaze tracking disabled - focusing on core Q&A functionality
      // disconnectGaze();
      stopInterview();
    };
  }, [stopInterview]);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  const getUserInitials = () => {
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return "U";
  };
  
  const handleEndInterview = () => {
    stopInterview();
    navigate("/dashboard");
  };
  
  // Mic and camera toggles (now functional)
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  
  const handleToggleMic = () => {
    // TODO: Implement mic mute/unmute via WebRTC
    setMicEnabled(!micEnabled);
  };
  
  const handleToggleCamera = () => {
    setCameraEnabled(!cameraEnabled);
  };
  
  // Combine transcripts for display
  const conversationThread = useMemo(() => {
    const thread = [];
    const maxLen = Math.max(aiTranscript.length, userTranscript.length);
    
    for (let i = 0; i < maxLen; i++) {
      // Ensure text is always string
      if (aiTranscript[i] && typeof aiTranscript[i].text === 'string') {
        thread.push({
          speaker: "ai",
          text: aiTranscript[i].text,
          timestamp: aiTranscript[i].timestamp,
        });
      }
      if (userTranscript[i] && typeof userTranscript[i].text === 'string') {
        thread.push({
          speaker: "user",
          text: userTranscript[i].text,
          timestamp: userTranscript[i].timestamp,
        });
      }
    }
    
    // Add current question if being spoken (ensure it's a string)
    if (currentQuestion && typeof currentQuestion === 'string') {
      thread.push({
        speaker: "ai",
        text: currentQuestion,
        timestamp: new Date(),
      });
    }
    
    return thread;
  }, [aiTranscript, userTranscript, currentQuestion]);

  // Log conversation thread updates
  useEffect(() => {
    console.log('💬 Conversation thread updated:', {
      length: conversationThread.length,
      items: conversationThread.map(m => ({
        speaker: m.speaker,
        text: m.text?.substring(0, 50) + (m.text?.length > 50 ? '...' : ''),
        timestamp: m.timestamp
      }))
    });
  }, [conversationThread]);
  
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        fontFamily: 'Avenir, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        overflow: "hidden",
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          height: "60px",
          borderBottom: "1px solid #e0e0e0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Typography style={{ fontSize: "16px", fontWeight: 600, color: "#111827" }}>
            {config?.role ? `${config.role} Interview` : 'Evaluate Yourself'}
          </Typography>
          {config?.company && (
            <span style={{ fontSize: "14px", color: "#6b7280" }}>
              @ {config.company}
            </span>
          )}
          <span style={{ fontSize: "14px", color: "#6b7280", textTransform: "capitalize" }}>
            {interviewType}
          </span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "14px", color: "#374151" }}>
            {formatTime(timeElapsed)}
          </span>
          <span style={{ fontSize: "14px", color: "#6b7280" }}>
            Q{questionCount} / {maxQuestions}
          </span>
          <span style={{ 
            fontSize: "12px", 
            color: interviewState.status === 'connected' || interviewState.status === 'listening' ? "#4ade80" : "#9ca3af",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}>
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: interviewState.status === 'connected' || interviewState.status === 'listening' ? "#4ade80" : "#9ca3af"
            }} />
            {interviewState.status === 'connected' || interviewState.status === 'listening' ? 'Connected' : interviewState.status}
          </span>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              background: "transparent",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "14px",
              color: "#374151",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <DashboardIcon style={{ fontSize: "16px" }} />
            Dashboard
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              background: "transparent",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "14px",
              color: "#374151",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ExitToApp style={{ fontSize: "16px" }} />
            Exit
          </button>
        </div>
      </div>
      
      {/* Audio Prompt Banner */}
      {showAudioPrompt && (
        <div
          style={{
            background: "#fff3cd",
            borderBottom: "1px solid #ffc107",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "14px", color: "#856404" }}>
            Click to enable audio playback
          </span>
          <button
            onClick={enableAudio}
            style={{
              background: "#ffc107",
              color: "#000",
              border: "none",
              borderRadius: "4px",
              padding: "6px 12px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Enable Audio
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" }}>
        {/* Video Tiles Grid */}
        <div
          style={{
            flex: captionsVisible ? "0 0 70%" : 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              padding: "24px",
              minHeight: 0,
            }}
          >
          {/* User Video Tile (Left) */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              background: "#fafafa",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid #e0e0e0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                You
              </Typography>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    color: interviewState.micActive ? "#4ade80" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  {interviewState.micActive ? "Speaking..." : micEnabled ? "Mic On" : "Muted"}
                </span>
                {interviewState.aiSpeaking && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "#3b82f6",
                        animation: "pulse 2s infinite",
                      }}
                    />
                    Sonia speaking
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {hasVideoPermission && videoStreamRef.current ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                  <Avatar
                    style={{
                      width: "80px",
                      height: "80px",
                      background: "#e0e0e0",
                      color: "#6b7280",
                      fontSize: "32px",
                      fontWeight: 600,
                    }}
                  >
                    {getUserInitials()}
                  </Avatar>
                  <Typography style={{ fontSize: "14px", color: "#6b7280" }}>
                    Camera off
                  </Typography>
                </div>
              )}
              
              {/* Gaze tracking disabled - focusing on core Q&A functionality */}
              {/* Gaze Metrics Widget */}
              {/* {hasVideoPermission && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "16px",
                    left: "16px",
                    background: "#ffffff",
                    border: "1px solid #e0e0e0",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "#374151",
                  }}
                >
                  <div>Eye Contact: {eyeContactPct}%</div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                    Status: {attentionStatus}
                  </div>
                </div>
              )} */}
            </div>
            
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
          
          {/* AI Interviewer Tile (Right) */}
          <div
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              background: "#fafafa",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid #e0e0e0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Typography style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                Sonia (Interviewer)
              </Typography>
                <span
                  style={{
                    fontSize: "11px",
                    background: "#4ade80",
                    color: "#ffffff",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  Live
                </span>
              </div>
              {currentQuestion && (
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#4ade80",
                    animation: "pulse 2s infinite",
                  }}
                />
              )}
            </div>
            
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "16px",
                padding: "40px",
              }}
            >
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  background: "#f3f4f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography style={{ fontSize: "48px" }}>👤</Typography>
              </div>
              <Typography
                style={{
                  fontSize: "13px",
                  color: "#6b7280",
                  textAlign: "center",
                  maxWidth: "300px",
                }}
              >
                Ask to repeat or rephrase anytime.
              </Typography>
            </div>
          </div>
          </div>
        </div>
        
        {/* Captions Panel (Right Side, Collapsible) */}
        {captionsVisible && (
          <div
            style={{
              flex: "0 0 30%",
              borderLeft: "1px solid #e0e0e0",
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #e0e0e0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#fafafa",
              }}
            >
              <Typography style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                Live Transcript
              </Typography>
              <button
                onClick={() => setCaptionsVisible(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "12px",
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                Hide
              </button>
            </div>
            <div
              style={{
                flex: 1,
                padding: "16px",
                overflowY: "auto",
                background: "#ffffff",
              }}
            >
          {conversationThread.length === 0 ? (
            <Typography style={{ fontSize: "14px", color: "#9ca3af", textAlign: "center" }}>
              Conversation will appear here...
            </Typography>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {conversationThread.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: msg.speaker === "ai" ? "flex-start" : "flex-end",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: msg.speaker === "ai" ? "#f5f5f5" : "#ffffff",
                      border: msg.speaker === "user" ? "1px solid #e0e0e0" : "none",
                      fontSize: "14px",
                      color: "#111827",
                    }}
                  >
                    <div>{typeof msg.text === 'string' ? msg.text : String(msg.text || '')}</div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        marginTop: "4px",
                      }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
          </div>
        )}
        
        {/* Show Captions Button (when hidden) */}
        {!captionsVisible && (
          <button
            onClick={() => setCaptionsVisible(true)}
            style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "#ffffff",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "12px",
              color: "#374151",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            Show Captions
          </button>
        )}
      </div>
      
      {/* Bottom Controls */}
      <div
        style={{
          height: "80px",
          borderTop: "1px solid #e0e0e0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          background: "#fafafa",
          padding: "0 24px",
        }}
      >
        {!hasJoined ? (
          <button
            onClick={handleJoinInterview}
            disabled={interviewState.status === 'connecting' || interviewState.status === 'connected' || interviewState.status === 'listening' || interviewState.status === 'responding'}
            style={{
              background: interviewState.status === 'connecting' ? "#9ca3af" : "rgb(251,101,30)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: interviewState.status === 'connecting' ? "not-allowed" : "pointer",
              opacity: interviewState.status === 'connecting' ? 0.6 : 1,
            }}
          >
            {interviewState.status === 'connecting' ? 'Connecting...' : 'Join Interview'}
          </button>
        ) : (
          <>
            {/* Control Buttons */}
            <button
              onClick={handleToggleMic}
              style={{
                background: micEnabled ? "#ffffff" : "#fef2f2",
                border: `1px solid ${micEnabled ? "#e0e0e0" : "#fecaca"}`,
                borderRadius: "50%",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: micEnabled ? "#374151" : "#dc2626",
              }}
              title={micEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              🎤
            </button>
            
            <button
              onClick={handleToggleCamera}
              style={{
                background: cameraEnabled ? "#ffffff" : "#f3f4f6",
                border: "1px solid #e0e0e0",
                borderRadius: "50%",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: cameraEnabled ? "#374151" : "#9ca3af",
              }}
              title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
            >
              📹
            </button>
            
            <button
              onClick={() => setCaptionsVisible(!captionsVisible)}
              style={{
                background: captionsVisible ? "#ffffff" : "#f3f4f6",
                border: "1px solid #e0e0e0",
                borderRadius: "50%",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: captionsVisible ? "#374151" : "#9ca3af",
              }}
              title={captionsVisible ? "Hide captions" : "Show captions"}
            >
              📝
            </button>
            
            <div style={{ width: "1px", height: "32px", background: "#e0e0e0", margin: "0 8px" }} />
            
            <button
              onClick={handleEndInterview}
              style={{
                background: "#dc2626",
                border: "none",
                borderRadius: "6px",
                padding: "10px 20px",
                fontSize: "14px",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 600,
              }}
            >
              <Stop style={{ fontSize: "16px" }} />
              End Call
            </button>
            
            <div
              style={{
                marginLeft: "auto",
                fontSize: "12px",
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {interviewState.status === 'connecting' && 'Connecting...'}
              {interviewState.status === 'connected' && 'Connected'}
              {interviewState.status === 'listening' && (
                <>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: interviewState.micActive ? "#4ade80" : "#9ca3af",
                    }}
                  />
                  {interviewState.micActive ? "Listening..." : "Ready"}
                  {interviewState.micActive && <span style={{ marginLeft: "8px", fontSize: "11px", color: "#6b7280" }}>Mic: Live</span>}
                </>
              )}
              {interviewState.status === 'responding' && (
                <>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#3b82f6",
                    }}
                  />
                  AI Speaking...
                </>
              )}
              {interviewState.status === 'error' && `Error: ${interviewState.error || 'Connection error'}`}
              {interviewState.status === 'idle' && !hasJoined && 'Not connected'}
              {interviewState.status === 'closed' && 'Interview ended'}
            </div>
          </>
        )}
      </div>
      
      {/* Permission Denial Modal */}
      <Dialog 
        open={showPermissionModal} 
        onClose={() => setShowPermissionModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: "18px", fontWeight: 600, color: "#111827" }}>
          Camera and microphone access
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#374151", lineHeight: 1.6 }}>
            To run a real interview simulation, we need access to your camera and microphone.
            {permissionError && (
              <Box sx={{ mt: 2, p: 2, background: "#fef2f2", borderRadius: 1 }}>
                <Typography variant="caption" sx={{ color: "#991b1b" }}>
                  Error: {permissionError.message || permissionError.name}
                </Typography>
              </Box>
            )}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ padding: "16px 24px", gap: 1 }}>
          <Button 
            onClick={handleTryAgain}
            variant="contained"
            sx={{
              background: "rgb(251,101,30)",
              "&:hover": { background: "rgb(251,101,30)", opacity: 0.9 },
            }}
          >
            Try again
          </Button>
          <Button onClick={handleContinueWithoutVideo} variant="outlined">
            Continue without video
          </Button>
          <Button onClick={handleUseTextInstead} variant="outlined">
            Use text instead
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Error Display */}
      {(interviewState.error || uiError) && (
        <div
          style={{
            position: "fixed",
            top: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            padding: "12px 24px",
            color: "#991b1b",
            fontSize: "14px",
            zIndex: 1000,
            maxWidth: "90%",
            textAlign: "center",
          }}
        >
          {interviewState.error || uiError}
          <button
            onClick={() => {
              setUiError(null);
              if (interviewState.status === 'idle' || interviewState.status === 'closed') {
                startInterview();
              }
            }}
            style={{
              marginLeft: "12px",
              background: "transparent",
              border: "1px solid #991b1b",
              borderRadius: "4px",
              padding: "4px 8px",
              color: "#991b1b",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Retry
          </button>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
