import React, { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useAdminApi } from "./useAdminApi";
import { formatDateTime } from "./adminUtils";

const EVENT_TYPES = [
  "",
  "login_success",
  "login_failure",
  "login_blocked",
  "mfa_pass",
  "mfa_fail",
  "mfa_challenge",
  "mfa_enroll_begin",
  "mfa_enroll_confirm",
  "refresh_success",
  "refresh_failure",
  "logout",
  "session_revoke",
  "admin_unlock",
  "admin_session_revoke",
];

export default function AdminSecurityPage() {
  const { requestJson } = useAdminApi();
  const { refreshTick, setLastRefreshedAt } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [eventType, setEventType] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [auditItems, setAuditItems] = useState([]);
  const [unlockEmail, setUnlockEmail] = useState("");
  const [sessionsUserId, setSessionsUserId] = useState("");
  const [sessions, setSessions] = useState([]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (eventType) params.set("event_type", eventType);
      if (emailFilter) params.set("email", emailFilter);
      const data = await requestJson(`/api/admin/security/audit?${params}`);
      setAuditItems(Array.isArray(data?.items) ? data.items : []);
      setLastRefreshedAt(new Date().toISOString());
    } catch (e) {
      setError(e?.message || "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  }, [requestJson, eventType, emailFilter, setLastRefreshedAt]);

  useEffect(() => { loadAudit(); }, [loadAudit, refreshTick]);

  const handleUnlock = async () => {
    setInfo("");
    if (!unlockEmail.includes("@")) {
      setError("Enter a valid email to unlock.");
      return;
    }
    try {
      const res = await requestJson("/api/admin/security/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unlockEmail }),
      });
      setInfo(`Cleared ${res?.keys_cleared || 0} lock keys for ${unlockEmail}`);
      setUnlockEmail("");
      loadAudit();
    } catch (e) {
      setError(e?.message || "Unlock failed.");
    }
  };

  const loadSessions = async () => {
    setInfo("");
    if (!sessionsUserId.trim()) {
      setError("Enter a user id to look up sessions.");
      return;
    }
    try {
      const data = await requestJson(`/api/admin/security/sessions/${encodeURIComponent(sessionsUserId.trim())}`);
      setSessions(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || "Failed to load sessions.");
    }
  };

  const revokeSession = async (jti) => {
    if (!window.confirm("Revoke this session?")) return;
    try {
      await requestJson(`/api/admin/security/sessions/${encodeURIComponent(jti)}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.jti !== jti));
      setInfo(`Revoked ${jti.slice(0, 8)}…`);
    } catch (e) {
      setError(e?.message || "Revoke failed.");
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Security</Typography>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {info && <Alert severity="success" onClose={() => setInfo("")}>{info}</Alert>}

      <Card><CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Unlock account</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small" label="Email" value={unlockEmail}
            onChange={(e) => setUnlockEmail(e.target.value)} sx={{ minWidth: 280 }}
          />
          <Button variant="contained" onClick={handleUnlock} disabled={!unlockEmail}>Unlock</Button>
        </Stack>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Active sessions per user</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small" label="User ID" value={sessionsUserId}
            onChange={(e) => setSessionsUserId(e.target.value)} sx={{ minWidth: 320 }}
          />
          <Button variant="outlined" onClick={loadSessions} disabled={!sessionsUserId}>Load</Button>
        </Stack>
        {sessions.length > 0 && (
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>JTI</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>Issued</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.jti}>
                  <TableCell>{s.jti.slice(0, 8)}…</TableCell>
                  <TableCell>{s.device_label || "—"}</TableCell>
                  <TableCell>{s.ip_address || "—"}</TableCell>
                  <TableCell>{s.issued_at ? formatDateTime(s.issued_at) : "—"}</TableCell>
                  <TableCell>{s.last_used_at ? formatDateTime(s.last_used_at) : "—"}</TableCell>
                  <TableCell>{s.expires_at ? formatDateTime(s.expires_at) : "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" color="error" onClick={() => revokeSession(s.jti)}>Revoke</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Card><CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>Audit log</Typography>
          <Select
            size="small" value={eventType}
            onChange={(e) => setEventType(e.target.value)} displayEmpty sx={{ minWidth: 200 }}
          >
            {EVENT_TYPES.map((t) => (
              <MenuItem key={t || "all"} value={t}>{t || "All event types"}</MenuItem>
            ))}
          </Select>
          <TextField
            size="small" placeholder="Filter by email" value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
          />
          <Button size="small" onClick={loadAudit}>Apply</Button>
        </Stack>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={24} /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Outcome</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>Detail</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditItems.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center">No events</TableCell></TableRow>
              )}
              {auditItems.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.created_at ? formatDateTime(row.created_at) : "—"}</TableCell>
                  <TableCell>{row.event_type}</TableCell>
                  <TableCell>
                    <Chip size="small"
                      label={row.outcome}
                      color={row.outcome === "success" ? "success" : "error"}
                    />
                  </TableCell>
                  <TableCell>{row.email || row.user_id || "—"}</TableCell>
                  <TableCell>{row.ip_address || "—"}</TableCell>
                  <TableCell sx={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.detail || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </Stack>
  );
}
