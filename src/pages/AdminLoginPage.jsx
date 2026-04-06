import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Navigate } from "react-router-dom";
import { SignIn, useAuth, useClerk } from "@clerk/clerk-react";
import AuthShell from "../components/AuthShell";
import BackendUnavailableState from "../components/BackendUnavailableState";
import { authFetch, getApiErrorMessage, isBackendUnavailableError } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { isDevAuthBypassEnabled } from "../utils/devAuthBypass";
import { defaultClerkAppearance } from "../utils/clerkAppearance";

const API_BASE = getApiBaseUrl();

export default function AdminLoginPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [state, setState] = useState({
    checking: true,
    isAdmin: false,
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
        if (mounted) setState({ checking: false, isAdmin: false, errorKind: "", errorMessage: "" });
        return;
      }
      try {
        const token = await getToken().catch(() => null);
        if (!token && !devBypass) {
          if (mounted) setState({ checking: false, isAdmin: false, errorKind: "", errorMessage: "" });
          return;
        }
        const resp = await authFetch(`${API_BASE}/api/me`, token, { method: "GET" });
        if (!resp.ok) {
          if (mounted) {
            setState({
              checking: false,
              isAdmin: false,
              errorKind: resp.status >= 500 ? "server_error" : "",
              errorMessage: resp.status >= 500 ? "Admin verification failed. Check the backend and try again." : "",
            });
          }
          return;
        }
        const data = await resp.json();
        if (mounted) {
          setState({ checking: false, isAdmin: Boolean(data?.is_admin), errorKind: "", errorMessage: "" });
        }
      } catch (error) {
        if (mounted) {
          setState({
            checking: false,
            isAdmin: false,
            errorKind: isBackendUnavailableError(error) ? "backend_unavailable" : "generic",
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
  }, [devBypass, isLoaded, isSignedIn, getToken, retryTick]);

  if ((!isLoaded && !devBypass) || state.checking) {
    return (
      <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if ((state.errorKind === "backend_unavailable" || state.errorKind === "server_error") && (isSignedIn || devBypass)) {
    return (
      <BackendUnavailableState
        title="Admin Login Check Unavailable"
        message={state.errorMessage}
        onRetry={() => setRetryTick((prev) => prev + 1)}
      />
    );
  }

  if ((isSignedIn || devBypass) && state.isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (isSignedIn && !state.isAdmin) {
    return (
      <Box sx={{ minHeight: "100%", display: "grid", placeItems: "center", p: 2 }}>
        <Box sx={{ maxWidth: 520, textAlign: "center" }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Admin Access Required
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You are currently signed in with a non-admin account. Sign out and continue with an allowlisted admin account.
          </Typography>
          <Button variant="contained" onClick={() => signOut({ redirectUrl: "/admin/login" })}>
            Sign Out and Switch Account
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <AuthShell
      eyebrow="Admin Access"
      title="Sign in with an allowlisted admin account."
      subtitle="This entry point is for support, reporting, trials, question-bank operations, and release controls. Non-admin accounts stay on the standard user flow."
      highlights={[
        { title: "Operations Console", body: "Candidates, interviews, trials, exports, and question-bank workflows live behind this login." },
        { title: "Protected Access", body: "Only Clerk user IDs on the backend admin allowlist can continue into the dashboard." },
        { title: "Same Identity Layer", body: "Admin verification still happens through the same Clerk identity and backend `/api/me` contract." },
      ]}
    >
      <p className="clerk-form-caption">
        Use the same organization identity you expect to ship in production. The backend will verify admin access before loading the dashboard.
      </p>
      <SignIn
        routing="path"
        path="/admin/login"
        oauthFlow="popup"
        signUpUrl="/register"
        forceRedirectUrl="/admin/dashboard"
        fallbackRedirectUrl="/admin/dashboard"
        appearance={defaultClerkAppearance}
      />
    </AuthShell>
  );
}
