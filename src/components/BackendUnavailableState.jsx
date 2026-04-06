import React from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

export default function BackendUnavailableState({
  title = "Backend Unavailable",
  message = "The backend service is temporarily unavailable. Please retry.",
  onRetry,
  retryLabel = "Retry",
}) {
  return (
    <Box sx={{ minHeight: "40vh", display: "grid", placeItems: "center", p: 3 }}>
      <Stack spacing={2} sx={{ width: "100%", maxWidth: 560 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The frontend is running, but the API could not be reached.
          </Typography>
        </Box>
        <Alert severity="error">{message}</Alert>
        {typeof onRetry === "function" && (
          <Box>
            <Button variant="contained" onClick={onRetry}>
              {retryLabel}
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
