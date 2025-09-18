import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";
import "../ui.css";

export default function PreInterviewForm() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState("");
  const [duration, setDuration] = useState("15");
  const [difficulty, setDifficulty] = useState("medium");

  const INTERVIEW_TYPES = [
    {
      value: "technical",
      label: "Technical Interview",
      description: "Focus on programming concepts, algorithms, and problem-solving",
    },
    {
      value: "behavioral", 
      label: "Behavioral Interview",
      description: "Focus on past experiences, teamwork, and soft skills",
    },
    {
      value: "mixed",
      label: "Mixed Interview", 
      description: "Combination of technical and behavioral questions",
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedType) {
      alert("Please select an interview type");
      return;
    }
    // Store configuration in sessionStorage
    sessionStorage.setItem('interviewConfig', JSON.stringify({
      type: selectedType,
      duration,
      difficulty
    }));
    navigate(`/interview/${selectedType}`);
  };

  return (
    <div>
      {/* Glossy header */}
      <header className="glossy-header">
        <div className="glossy-inner">
          {/* Left: Logo */}
          <div className="brand-section">
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}>
              <img 
                src="/assets/logo.png" 
                alt="Evaluate Yourself Logo"
                style={{width:36, height:36, borderRadius:12}}
              />
              <strong>Evaluate Yourself</strong>
            </Link>
          </div>

          {/* Center: Navigation */}
          <div></div>

          {/* Right: Logout */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Centered auth card */}
      <main className="auth-shell">
        <section className="auth-card">
          {/* left hero side */}
          <div className="auth-hero">
            <div>
              <h1>Setup Your Interview</h1>
              <p>Choose your interview type and preferences. We'll provide real-time coaching and detailed feedback.</p>
            </div>
          </div>

          {/* right form side */}
          <form className="auth-form" onSubmit={handleSubmit}>
            <h2 style={{margin: "0 0 1.5rem 0", fontSize: 22}}>Interview Configuration</h2>
            
            {/* Interview Type Selection */}
            <div style={{marginBottom: "1.5rem"}}>
              <label style={{display: "block", marginBottom: "0.5rem", fontWeight: "500"}}>Interview Type</label>
              {INTERVIEW_TYPES.map((type) => (
                <div 
                  key={type.value}
                  style={{
                    border: selectedType === type.value ? "2px solid #1e88e5" : "1px solid #e0e0e0",
                    borderRadius: "8px",
                    padding: "1rem",
                    marginBottom: "0.5rem",
                    cursor: "pointer",
                    backgroundColor: selectedType === type.value ? "#f3f9ff" : "white",
                    transition: "all 0.2s ease"
                  }}
                  onClick={() => setSelectedType(type.value)}
                >
                  <div style={{display: "flex", alignItems: "center", gap: "0.5rem"}}>
                    <input
                      type="radio"
                      name="interviewType"
                      value={type.value}
                      checked={selectedType === type.value}
                      onChange={(e) => setSelectedType(e.target.value)}
                      style={{accentColor: "#1e88e5"}}
                    />
                    <div>
                      <div style={{fontWeight: "500", color: "#333"}}>{type.label}</div>
                      <div style={{fontSize: "0.875rem", color: "#666", marginTop: "0.25rem"}}>{type.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Duration Selection */}
            <div style={{marginBottom: "1.5rem"}}>
              <label style={{display: "block", marginBottom: "0.5rem", fontWeight: "500"}}>Interview Duration</label>
              <select 
                className="input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </div>

            {/* Difficulty Selection */}
            <div style={{marginBottom: "1.5rem"}}>
              <label style={{display: "block", marginBottom: "0.5rem", fontWeight: "500"}}>Difficulty Level</label>
              <select 
                className="input"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy - Entry level questions</option>
                <option value="medium">Medium - Mid-level questions</option>
                <option value="hard">Hard - Senior level questions</option>
              </select>
            </div>

            <button 
              className="btn btn-primary btn-lg" 
              type="submit"
              disabled={!selectedType}
              style={{
                opacity: selectedType ? 1 : 0.6,
                cursor: selectedType ? "pointer" : "not-allowed"
              }}
            >
              Start Interview →
            </button>
            
            <div className="hint">Make sure you have a good internet connection and your camera/microphone are working.</div>
          </form>
        </section>
      </main>
    </div>
  );
}