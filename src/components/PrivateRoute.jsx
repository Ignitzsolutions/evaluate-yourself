import { RedirectToSignIn, useAuth } from "@clerk/clerk-react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { isDevAuthBypassEnabled } from "../utils/devAuthBypass";

export default function PrivateRoute({ children, signInUrl = "/login" }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (isDevAuthBypassEnabled()) return children;
  if (!isLoaded) {
    return (
      <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center", px: 3 }}>
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress size={28} sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Checking your session…
          </Typography>
        </Box>
      </Box>
    );
  }
  if (isSignedIn) return children;
  return <RedirectToSignIn signInUrl={signInUrl} />;
}
