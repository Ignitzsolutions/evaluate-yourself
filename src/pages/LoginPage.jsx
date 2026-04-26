import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { TextField, Button, Alert, CircularProgress, Typography, Box } from "@mui/material";
import AuthShell from "../components/AuthShell";
import { useAuthActions } from "../context/AuthContext";
import "../ui.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/onboarding");
    } catch (err) {
      if (err?.code === "PASSWORD_NOT_SET") {
        navigate("/set-password", { state: { email } });
        return;
      }
      setError(err?.message || err?.detail || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="AI Interview Studio"
      title="Build interview confidence with realtime coaching."
      subtitle="Practice live sessions, get instant feedback, and walk into interviews with a clear plan to improve."
      highlights={[
        { title: "Live Signals", body: "Eye-contact, tone clarity, and filler tracking." },
        { title: "Scorecards", body: "Structured rubric across behavioral and role-specific skills." },
        { title: "Coach Notes", body: "Clear next-steps and focused practice drills after every session." },
      ]}
    >
      <Typography variant="body2" sx={{ color: "#475569", mb: 2, mt: 0 }}>
        Sign in with your email and password.
      </Typography>
      <form onSubmit={handleSubmit}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Email" type="email" fullWidth required value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} size="small" />
        <TextField label="Password" type="password" fullWidth required value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 2 }} size="small" />
        <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ mb: 1.5, py: 1.2 }}>
          {loading ? <CircularProgress size={20} color="inherit" /> : "Sign In"}
        </Button>
        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <Link to="/forgot-password" style={{ color: "#2563eb" }}>Forgot password?</Link>
          <Link to="/register" style={{ color: "#2563eb" }}>Create account</Link>
        </Box>
      </form>
    </AuthShell>
  );
}
