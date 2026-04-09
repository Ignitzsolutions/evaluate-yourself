import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Box, CircularProgress, Typography } from "@mui/material";
import BackendUnavailableState from "./BackendUnavailableState";
import { authFetch, buildApiErrorFromResponse, buildAuthRequiredError, getApiErrorMessage, isAuthRequiredError, isBackendUnavailableError } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { isDevAuthBypassEnabled } from "../utils/devAuthBypass";
import { classifyOnboardingGuardError } from "../utils/onboardingGuardState";

const API_BASE_URL = getApiBaseUrl();

export default function OnboardingGuard({ children }) {
  const location = useLocation();
  const { getToken, isLoaded } = useAuth();
  const devBypass = isDevAuthBypassEnabled();
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState({ completed: false, user_category: null });
  const [retryTick, setRetryTick] = useState(0);
  const [errorState, setErrorState] = useState({ kind: "", message: "" });

  useEffect(() => {
    let mounted = true;
    async function checkStatus() {
      if (!isLoaded && !devBypass) return;
      try {
        setChecking(true);
        setErrorState({ kind: "", message: "" });
        const token = await getToken().catch(() => null);
        if (!token && !devBypass) {
          throw buildAuthRequiredError();
        }
        const resp = await authFetch(`${API_BASE_URL}/api/profile/status`, token, { method: "GET" });
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) {
            throw buildAuthRequiredError("Your session has expired. Please sign in again.");
          }
          throw await buildApiErrorFromResponse(resp, {
            defaultMessage: "Failed to verify profile status.",
          });
        }
        const data = await resp.json();
        if (mounted) {
          setStatus({
            completed: Boolean(data.completed),
            user_category: data.user_category || null,
          });
        }
      } catch (err) {
        if (mounted) {
          setErrorState({
            kind: classifyOnboardingGuardError(err, {
              isAuthRequiredError,
              isBackendUnavailableError,
            }),
            message: getApiErrorMessage(err, {
              backendLabel: "profile service",
              defaultMessage: "Unable to verify onboarding status.",
            }),
          });
        }
      } finally {
        if (mounted) setChecking(false);
      }
    }
    checkStatus();
    return () => {
      mounted = false;
    };
  }, [devBypass, getToken, isLoaded, location.pathname, retryTick]);

  if (checking) {
    return (
      <Box sx={{ minHeight: "40vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errorState.kind === "backend_unavailable") {
    return (
      <BackendUnavailableState
        title="Profile Service Unavailable"
        message={errorState.message}
        onRetry={() => setRetryTick((prev) => prev + 1)}
      />
    );
  }

  if (errorState.kind === "auth_required") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (errorState.message) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{errorState.message}</Typography>
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
