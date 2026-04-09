import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { useAuth } from "@clerk/clerk-react";
import BackendUnavailableState from "./BackendUnavailableState";
import { authFetch, buildApiErrorFromResponse, getApiErrorMessage, isBackendUnavailableError } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { isDevAuthBypassEnabled } from "../utils/devAuthBypass";

const API_BASE = getApiBaseUrl();

export default function AdminRoute({ children }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [state, setState] = useState({
    loading: true,
    allowed: false,
    requireLogin: false,
    errorKind: "",
    errorMessage: "",
  });
  const devBypass = isDevAuthBypassEnabled();
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isLoaded && !devBypass) return;
      if (!devBypass && !isSignedIn) {
        if (mounted) {
          setState({ loading: false, allowed: false, requireLogin: true, errorKind: "", errorMessage: "" });
        }
        return;
      }
      try {
        const token = await getToken().catch(() => null);
        if (!token && !devBypass) {
          if (mounted) {
            setState({ loading: false, allowed: false, requireLogin: true, errorKind: "", errorMessage: "" });
          }
          return;
        }
        const resp = await authFetch(`${API_BASE}/api/me`, token, { method: "GET" });
        if (!resp.ok) {
          if (!devBypass && resp.status === 401) {
            if (mounted) {
              setState({ loading: false, allowed: false, requireLogin: true, errorKind: "", errorMessage: "" });
            }
            return;
          }
          throw await buildApiErrorFromResponse(resp, {
            defaultMessage: "Admin verification failed. Check the backend and try again.",
          });
        }
        const data = await resp.json();
        if (mounted) {
          setState({
            loading: false,
            allowed: Boolean(data?.is_admin),
            requireLogin: false,
            errorKind: "",
            errorMessage: "",
          });
        }
      } catch (error) {
        if (mounted) {
          setState({
            loading: false,
            allowed: false,
            requireLogin: false,
            errorKind: isBackendUnavailableError(error) ? "backend_unavailable" : error?.status >= 500 ? "server_error" : "generic",
            errorMessage: getApiErrorMessage(error, {
              backendLabel: "admin access service",
              defaultMessage: "Unable to verify admin access.",
            }),
          });
        }
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [devBypass, getToken, isLoaded, isSignedIn, retryTick]);

  if (state.loading) {
    return (
      <Box sx={{ minHeight: "40vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state.requireLogin) {
    return <Navigate to="/admin/login" replace />;
  }

  if (state.errorKind === "backend_unavailable" || state.errorKind === "server_error") {
    return (
      <BackendUnavailableState
        title="Admin Panel Unavailable"
        message={state.errorMessage}
        onRetry={() => setRetryTick((prev) => prev + 1)}
      />
    );
  }

  if (!state.allowed) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
