/**
 * AdminMfaEnrollPage — first-run TOTP enrollment for admin accounts.
 *
 * Reached when the login response sets `mfa_enroll_required:true`. Flow:
 *   1. POST /api/auth/mfa/enroll → { provisioning_uri, secret }
 *   2. User scans QR (or pastes secret) into their authenticator app
 *   3. User enters 6-digit code → POST /api/auth/mfa/confirm
 *   4. On success, recovery codes are displayed (download / copy) and the
 *      user is redirected to /admin/dashboard.
 *
 * No external network calls; QR is rendered client-side from the otpauth:// URI.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import { QRCodeSVG } from "qrcode.react";
import { useAuth, useAuthActions } from "../../context/AuthContext";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

function copyToClipboard(value) {
  try {
    navigator.clipboard.writeText(value);
  } catch (_err) {
    /* clipboard blocked */
  }
}

export default function AdminMfaEnrollPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { completeMfaLogin } = useAuthActions();

  const [phase, setPhase] = useState("loading"); // loading | enroll | confirming | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [provisioningUri, setProvisioningUri] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  const base = useMemo(() => getApiBaseUrl(), []);

  const startEnrollment = useCallback(async () => {
    setPhase("loading");
    setErrorMsg("");
    try {
      // Prefer the mfa_token from the login challenge (admin first-run); fall
      // back to a regular access token if the user is already signed in and
      // adding MFA from settings.
      const mfaToken = sessionStorage.getItem("ey.mfaToken") || "";
      const token = mfaToken || (await getToken().catch(() => null));
      const res = await fetch(`${base}/api/auth/mfa/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Enroll failed (${res.status}): ${txt.slice(0, 160)}`);
      }
      const data = await res.json();
      setProvisioningUri(data.provisioning_uri || "");
      setSecret(data.secret || "");
      setPhase("enroll");
    } catch (err) {
      setErrorMsg(err?.message || "Unable to start MFA enrollment.");
      setPhase("error");
    }
  }, [base, getToken]);

  useEffect(() => {
    startEnrollment();
  }, [startEnrollment]);

  const submitCode = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!/^\d{6}$/.test(code)) {
        setErrorMsg("Enter the 6-digit code from your authenticator app.");
        return;
      }
      setPhase("confirming");
      setErrorMsg("");
      try {
        const mfaToken = sessionStorage.getItem("ey.mfaToken") || "";
        const token = mfaToken || (await getToken().catch(() => null));
        const res = await fetch(`${base}/api/auth/mfa/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.detail?.message || `Code rejected (${res.status})`);
        }
        const data = await res.json();
        setRecoveryCodes(Array.isArray(data.recovery_codes) ? data.recovery_codes : []);

        // Exchange the mfa_token + same code for a real session so the admin
        // is fully logged in by the time they click "Continue".
        if (mfaToken) {
          try {
            await completeMfaLogin(mfaToken, code);
            sessionStorage.removeItem("ey.mfaToken");
          } catch (_err) {
            // Non-fatal: user can still copy recovery codes and re-login.
          }
        }
        setPhase("done");
      } catch (err) {
        setErrorMsg(err?.message || "Verification failed.");
        setPhase("enroll");
      }
    },
    [base, code, completeMfaLogin, getToken]
  );

  const downloadCodes = useCallback(() => {
    const body = [
      "Evaluate Yourself — MFA Recovery Codes",
      "Store these somewhere safe. Each code can be used once.",
      "",
      ...recoveryCodes,
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evaluate-yourself-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recoveryCodes]);

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <VerifiedOutlinedIcon color="primary" />
              <Typography variant="h5" fontWeight={700}>
                Set up two-factor authentication
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Admins are required to enrol an authenticator app before reaching the dashboard. Use 1Password,
              Authy, Google Authenticator, or any TOTP-compatible app.
            </Typography>

            {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}

            {phase === "loading" && <Typography>Preparing enrollment…</Typography>}

            {(phase === "enroll" || phase === "confirming") && provisioningUri ? (
              <>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    p: 3,
                    borderRadius: 2,
                    backgroundColor: "background.default",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <QRCodeSVG value={provisioningUri} size={208} includeMargin={false} />
                </Box>

                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Or enter this secret manually
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        letterSpacing: 1.2,
                        wordBreak: "break-all",
                      }}
                    >
                      {secret}
                    </Typography>
                    <Tooltip title="Copy secret">
                      <IconButton size="small" onClick={() => copyToClipboard(secret)}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Box component="form" onSubmit={submitCode}>
                  <Stack spacing={2}>
                    <TextField
                      autoFocus
                      label="6-digit code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      inputProps={{ inputMode: "numeric", maxLength: 6 }}
                      fullWidth
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={phase === "confirming" || code.length !== 6}
                      size="large"
                    >
                      {phase === "confirming" ? "Verifying…" : "Verify & finish"}
                    </Button>
                  </Stack>
                </Box>
              </>
            ) : null}

            {phase === "done" && (
              <>
                <Alert severity="success">
                  Two-factor authentication enabled. Save your recovery codes — each one can be used once if you
                  lose your authenticator.
                </Alert>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  }}
                >
                  {recoveryCodes.map((c) => (
                    <Typography key={c} variant="body2" sx={{ letterSpacing: 1.2 }}>
                      {c}
                    </Typography>
                  ))}
                </Box>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    startIcon={<DownloadOutlinedIcon />}
                    variant="outlined"
                    onClick={downloadCodes}
                  >
                    Download codes
                  </Button>
                  <Button
                    startIcon={<ContentCopyIcon />}
                    variant="outlined"
                    onClick={() => copyToClipboard(recoveryCodes.join("\n"))}
                  >
                    Copy to clipboard
                  </Button>
                </Stack>
                <Divider />
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate("/admin/dashboard")}
                >
                  Continue to admin dashboard
                </Button>
              </>
            )}

            {phase === "error" && (
              <Stack spacing={2}>
                <Button variant="outlined" onClick={startEnrollment}>
                  Try again
                </Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
