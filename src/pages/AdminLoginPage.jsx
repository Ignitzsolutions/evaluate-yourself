import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TextField, Button, Alert, CircularProgress, Typography, Box } from "@mui/material";
import AuthShell from "../components/AuthShell";
import { useAuth, useAuthActions } from "../context/AuthContext";
import { authFetch } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import "../ui.css";

const API_BASE = getApiBaseUrl();

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { login } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setCheckingAdmin(true);
    (async () => {
      try {
        const token = await getToken();
        if (!token) { setCheckingAdmin(false); return; }
        const resp = await authFetch(`${API_BASE}/api/me`, token, { method: "GET" });
        if (resp.ok) {
          const data = await resp.json();
          if (!cancelled) {
            if (data.is_admin) {
              navigate("/admin/dashboard", { replace: true });
            } else {
              setIsAdmin(false);
            }
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setCheckingAdmin(false);
    })();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, getToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.user?.is_admin) {
        navigate("/admin/dashboard");
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      setError(err?.message || err?.detail || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAdmin) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isSignedIn && isAdmin === false) {
    return (
      <AuthShell eyebrow="Admin Portal" title="Admin Access Required" subtitle="Your account does not have admin privileges.">
        <Alert severity="warning" sx={{ mb: 2 }}>
          The account you signed in with does not have admin access. Please sign out and use an admin account.
        </Alert>
        <Button variant="outlined" fullWidth onClick={() => { signOut(); setIsAdmin(null); }}>
          Sign Out & Try Again
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Admin Portal" title="Admin Sign In" subtitle="Sign in with your admin credentials.">
      <form onSubmit={handleSubmit}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Email" type="email" fullWidth required value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} size="small" />
        <TextField label="Password" type="password" fullWidth required value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 2 }} size="small" />
        <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ py: 1.2 }}>
          {loading ? <CircularProgress size={20} color="inherit" /> : "Sign In as Admin"}
        </Button>
      </form>
    </AuthShell>
  );
}
