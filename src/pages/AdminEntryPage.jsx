import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "@clerk/clerk-react";
import BackendUnavailableState from "../components/BackendUnavailableState";
import { authFetch, buildApiErrorFromResponse, getApiErrorMessage, isBackendUnavailableError } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { isDevAuthBypassEnabled } from "../utils/devAuthBypass";

const API_BASE = getApiBaseUrl();

export default function AdminEntryPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const devBypass = isDevAuthBypassEnabled();
  const [state, setState] = useState({
    checking: true,
    target: "/admin/login",
    errorKind: "",
    errorMessage: "",
  });
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!isLoaded && !devBypass) return;
      if (!devBypass && !isSignedIn) {
        if (mounted) {
          setState({ checking: false, target: "/admin/login", errorKind: "", errorMessage: "" });
        }
        return;
      }

      try {
        const token = await getToken().catch(() => null);
        if (!token && !devBypass) {
          if (mounted) {
            setState({ checking: false, target: "/admin/login", errorKind: "", errorMessage: "" });
          }
          return;
        }

        const resp = await authFetch(`${API_BASE}/api/me`, token, { method: "GET" });
        if (!resp.ok) {
          if (!devBypass && resp.status === 401) {
            if (mounted) {
              setState({ checking: false, target: "/admin/login", errorKind: "", errorMessage: "" });
            }
            return;
          }
          throw await buildApiErrorFromResponse(resp, {
            defaultMessage: "Admin verification failed. Check the backend and try again.",
          });
        }

        const data = await resp.json();
        if (!mounted) return;
        setState({
          checking: false,
          target: data?.is_admin ? "/admin/dashboard" : "/admin/login",
          errorKind: "",
          errorMessage: "",
        });
      } catch (error) {
        if (!mounted) return;
        setState({
          checking: false,
          target: "/admin/login",
          errorKind: isBackendUnavailableError(error) ? "backend_unavailable" : error?.status >= 500 ? "server_error" : "generic",
          errorMessage: getApiErrorMessage(error, {
            backendLabel: "admin access service",
            defaultMessage: "Unable to verify admin access.",
          }),
        });
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [devBypass, getToken, isLoaded, isSignedIn, retryTick]);

  if ((!isLoaded && !devBypass) || state.checking) {
    return (
      <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state.errorKind === "backend_unavailable" || state.errorKind === "server_error") {
    return (
      <BackendUnavailableState
        title="Admin Access Check Unavailable"
        message={state.errorMessage}
        onRetry={() => setRetryTick((prev) => prev + 1)}
      />
    );
  }

  return <Navigate to={state.target} replace />;
}
