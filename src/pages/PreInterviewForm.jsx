import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@mui/material";
import "../ui.css";

export default function PreInterviewForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const incomingType = location.state?.type; // get interview type from previous page

  const [selectedType] = useState(incomingType || "technical"); // initialize it, no need to change again
  const [duration, setDuration] = useState("15");
  const [difficulty, setDifficulty] = useState("medium");

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalType = selectedType;
    sessionStorage.setItem("interviewConfig", JSON.stringify({ type: finalType, duration, difficulty }));
    navigate(`/interview/${finalType}`);
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
          <h2 style={{ margin: "0 0 1.5rem 0", fontSize: 22 }}>Interview Configuration</h2>

          {/* Duration Selection */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Interview Duration</label>
            <select className="input" value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
            </select>
          </div>

          {/* Difficulty Selection */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>Difficulty Level</label>
            <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="easy">Easy - Entry level questions</option>
              <option value="medium">Medium - Mid level questions</option>
              <option value="hard">Hard - Senior level questions</option>
            </select>
          </div>

          {/* Submit */}
          <button className="btn btn-primary btn-lg" type="submit">
            Start Interview →
          </button>

          <div className="hint">Camera & mic will be checked next.</div>
        </form>
      </section>
    </main>
  );
}
