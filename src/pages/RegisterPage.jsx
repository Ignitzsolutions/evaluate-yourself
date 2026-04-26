import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { TextField, Button, Alert, CircularProgress, Typography, Box } from "@mui/material";
import AuthShell from "../components/AuthShell";
import { useAuthActions } from "../context/AuthContext";
import "../ui.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuthActions();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, fullName);
      navigate("/onboarding");
    } catch (err) {
      setError(err?.message || err?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create Your Workspace"
      title="Start practicing interviews with a setup that actually feels serious."
      subtitle="Create your account, complete onboarding once, and use the same workspace for live interviews, reports, and admin access."
      highlights={[
        { title: "One Workspace", body: "Your interview history, reports, and account settings stay in one place." },
        { title: "Structured Practice", body: "Choose technical, behavioral, or 360 interviews with a consistent setup flow." },
        { title: "Clear Output", body: "Finish each session with a report, evidence, and coaching priorities." },
      ]}
    >
      <Typography variant="body2" sx={{ color: "#475569", mb: 2, mt: 0 }}>
        Create your account with email and password.
      </Typography>
      <form onSubmit={handleSubmit}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Full Name" fullWidth required value={fullName} onChange={(e) => setFullName(e.target.value)} sx={{ mb: 2 }} size="small" />
        <TextField label="Email" type="email" fullWidth required value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} size="small" />
        <TextField label="Password" type="password" fullWidth required value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 2 }} size="small" helperText="8+ chars, uppercase, lowercase, digit" />
        <TextField label="Confirm Password" type="password" fullWidth required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} sx={{ mb: 2 }} size="small" />
        <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ mb: 1.5, py: 1.2 }}>
          {loading ? <CircularProgress size={20} color="inherit" /> : "Create Account"}
        </Button>
        <Box sx={{ textAlign: "center", fontSize: 13 }}>
          Already have an account? <Link to="/login" style={{ color: "#2563eb" }}>Sign in</Link>
        </Box>
      </form>
    </AuthShell>
  );
}
