import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";

export default function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        px: 3,
      }}
    >
      <Box sx={{ maxWidth: 560, textAlign: "center" }}>
        <Typography variant="overline" sx={{ letterSpacing: 2, color: "primary.main" }}>
          Evaluate Yourself
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, mb: 1.5 }}>
          We couldn&apos;t find that page.
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          The route may have changed, the page may no longer exist, or the link was incomplete.
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap" }}>
          <Button component={RouterLink} to="/dashboard" variant="contained">
            Go to Dashboard
          </Button>
          <Button component={RouterLink} to="/interviews" variant="outlined">
            Start an Interview
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
