import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import AuthShell from "../components/AuthShell";
import { apiUrl } from "../utils/apiBaseUrl";
import "../ui.css";

function errorMessage(payload, fallback) {
  const detail = payload?.detail || payload?.error || payload;
  if (typeof detail === "string") return detail;
  return detail?.message || payload?.message || fallback;
}

export default function SetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const setupToken = params.get("token") || location.state?.setupToken || "";
  const email = location.state?.email || params.get("email") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = Boolean(setupToken) && password.length > 0 && confirmPassword.length > 0 && !loading;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!setupToken) {
      setError("Use the secure password setup link sent by your administrator.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/auth/set-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, setup_token: setupToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw data;
      }
      setSuccess("Password set. You can now sign in.");
      setTimeout(() => navigate("/login", { state: { email } }), 800);
    } catch (err) {
      setError(errorMessage(err, "Unable to set password. The setup link may be invalid or expired."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Secure Account Setup"
      title="Set your password"
      subtitle="Use a secure setup link to finish migrating your account into the self-hosted sign-in flow."
      highlights={[
        { title: "Scoped Link", body: "Setup links are short-lived and only work for first-time password creation." },
        { title: "No Email Takeover", body: "Knowing an email address is not enough to claim an account." },
        { title: "Clear Recovery", body: "Expired or missing links show a direct path back to sign in and support." },
      ]}
    >
      <Typography variant="body2" sx={{ color: "#475569", mb: 2, mt: 0 }}>
        {email ? `Setting password for ${email}.` : "Enter a new password for your migrated account."}
      </Typography>

      {!setupToken && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This page needs a secure setup token. If you were sent here after login, contact an administrator for a fresh setup link.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <form onSubmit={handleSubmit}>
        <TextField
          label="New password"
          type="password"
          fullWidth
          required
          disabled={!setupToken || loading}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          sx={{ mb: 2 }}
          size="small"
          helperText="8+ chars, uppercase, lowercase, digit"
        />
        <TextField
          label="Confirm new password"
          type="password"
          fullWidth
          required
          disabled={!setupToken || loading}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          sx={{ mb: 2 }}
          size="small"
        />
        <Button type="submit" variant="contained" fullWidth disabled={!canSubmit} sx={{ mb: 1.5, py: 1.2 }}>
          {loading ? <CircularProgress size={20} color="inherit" /> : "Set Password"}
        </Button>
        <Box sx={{ textAlign: "center", fontSize: 13 }}>
          <Link to="/login" style={{ color: "#2563eb" }}>Back to Sign In</Link>
        </Box>
      </form>
    </AuthShell>
  );
}
