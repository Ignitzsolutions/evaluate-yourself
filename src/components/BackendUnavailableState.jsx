import React from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

export default function BackendUnavailableState({
  title = "Service Unavailable",
  message = "The backend is currently unavailable. Please try again.",
  onRetry,
}) {
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
              Backend Status
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
              {title}
            </Typography>
          </Box>

          <Alert severity="warning" variant="outlined">
            {message}
          </Alert>

          <Typography variant="body2" color="text.secondary">
            Check whether the API server is running, reachable from this environment, and using the
            expected base URL. Then retry the request.
          </Typography>

          {typeof onRetry === "function" ? (
            <Box>
              <Button variant="contained" onClick={onRetry}>
                Retry
              </Button>
            </Box>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
