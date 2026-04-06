import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { authFetch } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";

const API_BASE_URL = getApiBaseUrl();

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export default function WaitlistSignupForm({
  sourcePage = "landing",
  intent = "free_trial",
  title = "Join the launch waitlist",
  helperText = "Leave your email and we will notify you when the next free-trial access opens.",
  compact = false,
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ kind: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const submitDisabled = useMemo(() => !isValidEmail(email) || submitting, [email, submitting]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setStatus({ kind: "error", message: "Enter a valid email address." });
      return;
    }

    try {
      setSubmitting(true);
      setStatus({ kind: "", message: "" });
      const response = await authFetch(`${API_BASE_URL}/api/waitlist`, null, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          source_page: sourcePage,
          intent,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || `Failed to join waitlist (${response.status})`);
      }
      setStatus({ kind: "success", message: data?.message || "You have been added to the waitlist." });
      setEmail("");
    } catch (error) {
      setStatus({ kind: "error", message: error.message || "Failed to join waitlist." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        p: compact ? 0 : 2.5,
        borderRadius: compact ? 0 : 3,
        border: compact ? "none" : "1px solid rgba(15,23,42,.08)",
        background: compact ? "transparent" : "rgba(255,255,255,0.86)",
      }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {helperText}
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
          <TextField
            type="email"
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            fullWidth
            size="small"
            autoComplete="email"
          />
          <Button type="submit" variant="contained" disabled={submitDisabled} sx={{ minWidth: 160, textTransform: "none", fontWeight: 700 }}>
            {submitting ? "Joining..." : "Join waitlist"}
          </Button>
        </Stack>
        {status.message && <Alert severity={status.kind === "success" ? "success" : "error"}>{status.message}</Alert>}
      </Stack>
    </Box>
  );
}
