/**
 * DemoModeBanner — persistent top bar shown when the backend reports
 * demo_mode=true (no real API key configured). Variants:
 *   - inline (default): dismissible per session, sits above page content
 *   - admin: non-dismissible, slimmer, sits at the very top of the admin shell
 */
import React, { useEffect, useState } from "react";
import { Alert, Box, IconButton, Link, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { useRuntimeMode } from "../contexts/RuntimeModeContext";

const SESSION_KEY = "ey.demoBanner.dismissed";

export default function DemoModeBanner({ variant = "inline" }) {
  const { demo_mode, loading } = useRuntimeMode();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (variant === "inline") {
      setDismissed(sessionStorage.getItem(SESSION_KEY) === "1");
    }
  }, [variant]);

  if (loading || !demo_mode) return null;
  if (variant === "inline" && dismissed) return null;

  const isAdmin = variant === "admin";

  return (
    <Alert
      severity="info"
      icon={<ScienceOutlinedIcon fontSize="small" />}
      sx={{
        borderRadius: 0,
        py: isAdmin ? 0.5 : 1,
        px: 2,
        alignItems: "center",
        "& .MuiAlert-message": { width: "100%", py: 0 },
      }}
      action={
        isAdmin ? null : (
          <IconButton
            size="small"
            aria-label="Dismiss demo banner"
            onClick={() => {
              sessionStorage.setItem(SESSION_KEY, "1");
              setDismissed(true);
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )
      }
    >
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" fontWeight={600}>
          Demo mode
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No API keys configured — LLM scoring is canned and voice/realtime is simulated.
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Link
          href="https://github.com/Ignitzsolutions/evaluate-yourself#running-locally-without-api-keys"
          target="_blank"
          rel="noopener noreferrer"
          variant="body2"
        >
          How to enable real APIs →
        </Link>
      </Stack>
    </Alert>
  );
}
