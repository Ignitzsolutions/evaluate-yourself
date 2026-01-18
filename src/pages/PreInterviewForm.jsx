import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, FormControlLabel, Checkbox, Slider } from "@mui/material";
import "../ui.css";

export default function PreInterviewForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const incomingType = location.state?.type; // get interview type from previous page

  const [selectedType] = useState(incomingType || "technical"); // initialize it, no need to change again
  const [duration, setDuration] = useState("15");
  const [difficulty, setDifficulty] = useState("medium");
  
  // New fields
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [jobLevel, setJobLevel] = useState("mid");
  const [questionMix, setQuestionMix] = useState("balanced");
  const [questionMixRatio, setQuestionMixRatio] = useState(0.5); // For custom mix
  const [interviewStyle, setInterviewStyle] = useState("neutral");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [transcriptConsent, setTranscriptConsent] = useState(false);
  const [interviewMode, setInterviewMode] = useState("timeboxed");

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Require transcript consent
    if (!transcriptConsent) {
      alert("Please consent to transcript storage to continue.");
      return;
    }
    
    const finalType = selectedType;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const config = {
      type: finalType,
      duration,
      difficulty,
      role: role.trim() || undefined,
      company: company.trim() || undefined,
      jobLevel,
      questionMix,
      questionMixRatio: questionMix === "custom" ? questionMixRatio : undefined,
      interviewStyle,
      voiceEnabled,
      captionsEnabled,
      transcriptConsent,
      interviewMode
    };
    
    sessionStorage.setItem("interviewConfig", JSON.stringify(config));
    navigate(`/interview/session/${sessionId}`);
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-hero">
          <div>
            <h1>Setup Your Interview</h1>
            <p>Selected type: <strong style={{ color: "var(--brand)" }}>{selectedType}</strong></p>
          </div>
          <Button variant="contained" size="large" onClick={() => navigate("/interviews")} sx={{ px: 4, py: 1.4, fontSize: 16 }}>
            Back to selection
          </Button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2 style={{ margin: "0 0 2rem 0", fontSize: 22, fontWeight: 600 }}>Interview Configuration</h2>

          {/* Important Settings Section */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#111827", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "2px solid #e5e7eb" }}>
              Essential Settings
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Duration Selection */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "14px" }}>
                  Interview Duration <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select 
                  className="input" 
                  value={duration} 
                  onChange={(e) => setDuration(e.target.value)}
                  style={{ width: "100%" }}
                  required
                >
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                </select>
              </div>

              {/* Difficulty Selection */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "14px" }}>
                  Difficulty Level <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select 
                  className="input" 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value)}
                  style={{ width: "100%" }}
                  required
                >
                  <option value="easy">Easy - Entry level</option>
                  <option value="medium">Medium - Mid level</option>
                  <option value="hard">Hard - Senior level</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Job Level */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "14px" }}>
                  Job Level <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select 
                  className="input" 
                  value={jobLevel} 
                  onChange={(e) => setJobLevel(e.target.value)}
                  style={{ width: "100%" }}
                  required
                >
                  <option value="intern">Intern</option>
                  <option value="junior">Junior</option>
                  <option value="mid">Mid-Level</option>
                  <option value="senior">Senior</option>
                </select>
              </div>

              {/* Interview Style */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "14px" }}>
                  Interview Style <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select 
                  className="input" 
                  value={interviewStyle} 
                  onChange={(e) => setInterviewStyle(e.target.value)}
                  style={{ width: "100%" }}
                  required
                >
                  <option value="friendly">Friendly</option>
                  <option value="neutral">Neutral</option>
                  <option value="strict">Strict</option>
                </select>
              </div>
            </div>

            {/* Question Mix */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "14px" }}>
                Question Mix <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select 
                className="input" 
                value={questionMix} 
                onChange={(e) => setQuestionMix(e.target.value)}
                style={{ width: "100%" }}
                required
              >
                <option value="technical">Mostly Technical</option>
                <option value="balanced">Balanced</option>
                <option value="behavioral">Mostly Behavioral</option>
                <option value="custom">Custom</option>
              </select>
              {questionMix === "custom" && (
                <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                  <label style={{ fontSize: "0.875rem", color: "#374151", display: "block", marginBottom: "0.5rem" }}>
                    Technical vs Behavioral: <strong>{Math.round(questionMixRatio * 100)}% Technical</strong>
                  </label>
                  <Slider
                    value={questionMixRatio}
                    onChange={(e, newValue) => setQuestionMixRatio(newValue)}
                    min={0}
                    max={1}
                    step={0.1}
                    sx={{ width: "100%" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Speech Settings */}
          <div style={{ marginBottom: "2rem", padding: "1.25rem", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <label style={{ display: "block", marginBottom: "1rem", fontWeight: 600, fontSize: "14px" }}>
              Speech Settings
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={voiceEnabled}
                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                  />
                }
                label={<span style={{ fontSize: "14px" }}>Enable Voice (Sonia will speak)</span>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={captionsEnabled}
                    onChange={(e) => setCaptionsEnabled(e.target.checked)}
                  />
                }
                label={<span style={{ fontSize: "14px" }}>Enable Live Captions</span>}
              />
            </div>
          </div>

          {/* Transcript Consent (Required) */}
          <div style={{ marginBottom: "2rem", padding: "1.25rem", backgroundColor: "#fef3c7", borderRadius: "8px", border: "2px solid #fbbf24" }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={transcriptConsent}
                  onChange={(e) => setTranscriptConsent(e.target.checked)}
                  required
                />
              }
              label={
                <span style={{ fontWeight: 600, fontSize: "14px", color: "#92400e" }}>
                  I consent to this session being transcribed for feedback purposes <span style={{ color: "#dc2626" }}>*</span>
                </span>
              }
            />
          </div>

          {/* Optional Settings Section */}
          <div style={{ marginBottom: "2rem", paddingTop: "1.5rem", borderTop: "2px solid #e5e7eb" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280", marginBottom: "1rem" }}>
              Optional Settings
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Role (Optional) */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "14px", color: "#6b7280" }}>
                  Target Role <span style={{ fontSize: "12px", color: "#9ca3af" }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Software Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              {/* Company (Optional) */}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "14px", color: "#6b7280" }}>
                  Target Company <span style={{ fontSize: "12px", color: "#9ca3af" }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Google, Microsoft"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Interview Mode */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "14px", color: "#6b7280" }}>
                Interview Mode <span style={{ fontSize: "12px", color: "#9ca3af" }}>(Optional)</span>
              </label>
              <select 
                className="input" 
                value={interviewMode} 
                onChange={(e) => setInterviewMode(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="timeboxed">Time-based (Duration)</option>
                <option value="questionboxed">Question-based (Number of questions)</option>
              </select>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "2rem" }}>
            <button className="btn btn-primary btn-lg" type="submit" style={{ width: "100%" }}>
              Start Interview →
            </button>
            <div className="hint" style={{ textAlign: "center", fontSize: "13px", color: "#6b7280" }}>
              Camera & mic will be checked next.
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
