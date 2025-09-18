import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";
import "../ui.css";

const QUESTIONS = {
  technical: [
    "Explain the difference between let, const, and var in JavaScript.",
    "What is the time complexity of quicksort algorithm?",
    "How would you implement a binary search tree?",
    "Describe the concept of closures in programming.",
    "What are the principles of object-oriented programming?"
  ],
  behavioral: [
    "Tell me about a challenging project you worked on.",
    "How do you handle tight deadlines?",
    "Describe a time when you had to learn a new technology quickly.",
    "How do you handle conflicts in a team?",
    "What motivates you in your work?"
  ],
  mixed: [
    "Describe your experience with version control systems.",
    "How do you approach debugging complex issues?",
    "Tell me about a time you optimized code performance.",
    "How do you stay updated with new technologies?",
    "Describe your testing methodology."
  ]
};

export default function InterviewHUD() {
  const { type } = useParams();
  const videoRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [eyeGazeActive, setEyeGazeActive] = useState(true);
  
  const questions = QUESTIONS[type] || QUESTIONS.mixed;

  // Timer effect
  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Initialize camera
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    }).then(stream => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }).catch(err => {
      console.error("Failed to access camera:", err);
      setVideoEnabled(false);
    });
  }, []);

  // Read question aloud when it changes
  useEffect(() => {
    const readQuestion = () => {
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(questions[currentQuestionIndex]);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        
        window.speechSynthesis.speak(utterance);
      }
    };

    // Read question after a short delay to ensure UI is ready
    const timer = setTimeout(readQuestion, 500);
    return () => clearTimeout(timer);
  }, [currentQuestionIndex, questions]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = () => {
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleEndInterview = () => {
    window.location.href = '/report';
  };

  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      position: "relative",
      background: "linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%)",
      padding: "2rem",
      boxSizing: "border-box",
      overflow: "hidden"
    }}>
      {/* Framed Video like Google Meet */}
      <div style={{
        position: "absolute",
        top: "2rem",
        left: "2rem",
        right: "2rem",
        bottom: "180px",
        background: "#000",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
      }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        />
      </div>

      {/* Top Bar - Controls */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)",
        padding: "1rem 2rem",
        zIndex: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        {/* Left: Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "white"
          }}>
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: eyeGazeActive ? "#4ade80" : "#64748b",
              animation: eyeGazeActive ? "pulse 2s infinite" : "none"
            }}></div>
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              Eye Gaze Monitoring
            </span>
          </div>
          
          <div style={{
            color: "white",
            fontSize: "14px",
            fontWeight: "500"
          }}>
            {formatTime(timeElapsed)}
          </div>
        </div>

        {/* Right: Logout */}
        <LogoutButton />
      </div>

      {/* Question Card - Positioned below video frame */}
      <div style={{
        position: "absolute",
        bottom: "100px",
        left: "2rem",
        right: "2rem",
        zIndex: 10
      }}>
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          borderRadius: "16px",
          padding: "2rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          border: "2px solid #1e88e5"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem"
          }}>
            <div style={{
              background: "#1e88e5",
              color: "white",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "bold"
            }}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
            <div style={{
              color: "#1e88e5",
              fontSize: "14px",
              fontWeight: "500"
            }}>
              {type?.charAt(0).toUpperCase() + type?.slice(1)} Interview
            </div>
          </div>
          
          <h2 style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            color: "#1f2937",
            margin: "0 0 1rem 0",
            lineHeight: "1.4"
          }}>
            {questions[currentQuestionIndex]}
          </h2>
          
          <div style={{
            height: "4px",
            background: "#e5e7eb",
            borderRadius: "2px",
            overflow: "hidden"
          }}>
            <div style={{
              height: "100%",
              background: "linear-gradient(90deg, #1e88e5, #42a5f5)",
              width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
              borderRadius: "2px",
              transition: "width 0.3s ease"
            }}></div>
          </div>
        </div>
      </div>

      {/* Bottom Controls - Single Button */}
      <div style={{
        position: "absolute",
        bottom: "2rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}>
        {/* Single Action Button */}
        {currentQuestionIndex < questions.length - 1 ? (
          <button
            onClick={handleNextQuestion}
            style={{
              background: "#1e88e5",
              color: "white",
              border: "none",
              borderRadius: "50px",
              padding: "1.5rem 3rem",
              fontSize: "18px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 4px 20px rgba(30, 136, 229, 0.4)",
              transition: "all 0.2s ease"
            }}
            onMouseOver={(e) => {
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 6px 25px rgba(30, 136, 229, 0.6)";
            }}
            onMouseOut={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 4px 20px rgba(30, 136, 229, 0.4)";
            }}
          >
            Next Question →
          </button>
        ) : (
          <button
            onClick={handleEndInterview}
            style={{
              background: "#059669",
              color: "white",
              border: "none",
              borderRadius: "50px",
              padding: "1.5rem 3rem",
              fontSize: "18px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 4px 20px rgba(5, 150, 105, 0.4)",
              transition: "all 0.2s ease"
            }}
            onMouseOver={(e) => {
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 6px 25px rgba(5, 150, 105, 0.6)";
            }}
            onMouseOut={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 4px 20px rgba(5, 150, 105, 0.4)";
            }}
          >
            Finish Interview ✓
          </button>
        )}
      </div>

      {/* Pulse Animation for Eye Gaze */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  );
}