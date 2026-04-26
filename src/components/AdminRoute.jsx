import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import BackendUnavailableState from "./BackendUnavailableState";
import { authFetch, buildApiErrorFromResponse, getApiErrorMessage, isBackendUnavailableError } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { isDevAuthBypassEnabled } from "../utils/devAuthBypass";

const API_BASE = getApiBaseUrl();

export default function AdminRoute({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
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

  const loginState = { from: location };

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
    return <Navigate to="/admin/login" replace state={loginState} />;
  }

  if (state.errorKind === "backend_unavailable" || state.errorKind === "server_error" || state.errorKind === "generic") {
    if (state.errorKind === "generic") {
      return (
        <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center", p: 3 }}>
          <Box
            sx={{
              width: "100%",
              maxWidth: 560,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              borderRadius: 2,
              boxShadow: 1,
              p: { xs: 3, sm: 4 },
            }}
          >
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: 1.6 }}>
                  Admin Verification
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                  We couldn&apos;t confirm admin access
                </Typography>
              </Box>
              <Alert severity="warning" variant="outlined">
                {state.errorMessage}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                This looks like a verification failure, not a confirmed “not an admin” result. Retry the check or return
                to the main dashboard before attempting sign-in again.
              </Typography>
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                <Button variant="contained" onClick={() => setRetryTick((prev) => prev + 1)}>
                  Retry
                </Button>
                <Button variant="outlined" onClick={() => navigate("/dashboard")}>
                  Back to Dashboard
                </Button>
              </Box>
            </Stack>
          </Box>
        </Box>
      );
    }

    return (
      <BackendUnavailableState
        title="Admin Panel Unavailable"
        message={state.errorMessage}
        onRetry={() => setRetryTick((prev) => prev + 1)}
      />
    );
  }

  if (!state.allowed) {
    return <Navigate to="/admin/login" replace state={{ ...loginState, reason: "not_admin" }} />;
  }

  return children;
}
