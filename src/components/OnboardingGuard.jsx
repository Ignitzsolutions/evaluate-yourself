import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { authFetch } from "../utils/apiClient";

const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || "";

export default function OnboardingGuard({ children }) {
  const location = useLocation();
  const { getToken, isLoaded } = useAuth();
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState({ completed: false, user_category: null });
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function checkStatus() {
      if (!isLoaded) return;
      try {
        setChecking(true);
        setError("");
        const token = await getToken();
        const resp = await authFetch(`${API_BASE_URL}/api/profile/status`, token, { method: "GET" });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || "Failed to verify profile status.");
        }
        const data = await resp.json();
        if (mounted) {
          setStatus({
            completed: Boolean(data.completed),
            user_category: data.user_category || null,
          });
        }
      } catch (err) {
        if (mounted) setError(err.message || "Unable to verify onboarding status.");
      } finally {
        if (mounted) setChecking(false);
      }
    }
    checkStatus();
    return () => {
      mounted = false;
    };
  }, [getToken, isLoaded, location.pathname]);

  if (checking) {
    return (
      <Box sx={{ minHeight: "40vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!status.completed && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (status.completed && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
