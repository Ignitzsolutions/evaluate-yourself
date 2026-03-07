import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Navigate } from "react-router-dom";
import { SignIn, useAuth, useClerk } from "@clerk/clerk-react";
import { authFetch } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { isDevAuthBypassEnabled } from "../utils/devAuthBypass";

const API_BASE = getApiBaseUrl();

export default function AdminLoginPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [state, setState] = useState({ checking: true, isAdmin: false });
  const devBypass = isDevAuthBypassEnabled();

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isLoaded && !devBypass) return;
      if (!devBypass && !isSignedIn) {
        if (mounted) setState({ checking: false, isAdmin: false });
        return;
      }
      try {
        const token = await getToken().catch(() => null);
        if (!token && !devBypass) {
          if (mounted) setState({ checking: false, isAdmin: false });
          return;
        }
        const resp = await authFetch(`${API_BASE}/api/me`, token, { method: "GET" });
        if (!resp.ok) {
          if (mounted) setState({ checking: false, isAdmin: false });
          return;
        }
        const data = await resp.json();
        if (mounted) setState({ checking: false, isAdmin: Boolean(data?.is_admin) });
      } catch {
        if (mounted) setState({ checking: false, isAdmin: false });
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [devBypass, isLoaded, isSignedIn, getToken]);

  if ((!isLoaded && !devBypass) || state.checking) {
    return (
      <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
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
    <Box sx={{ minHeight: "100%", display: "grid", placeItems: "center", p: 2 }}>
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Admin Login
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sign in with an allowlisted admin account.
        </Typography>
      </Box>
      <SignIn
        routing="path"
        path="/admin/login"
        oauthFlow="popup"
        signUpUrl="/register"
        forceRedirectUrl="/admin/dashboard"
        fallbackRedirectUrl="/admin/dashboard"
      />
    </Box>
  );
}
