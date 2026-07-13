import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { Assessment, PlayArrow, Speed, TrendingUp } from "@mui/icons-material";
import { useUser, useAuth } from "../context/AuthContext";
import { authFetch, throwForResponse, getApiErrorMessage } from "../utils/apiClient";
import { apiUrl } from "../utils/apiBaseUrl";
import { formatInterviewTypeLabel } from "../utils/interviewTypeLabels";

const formatReportDate = (value) => {
  if (!value) return "Recent session";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recent session" : date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();
  const [backendUser, setBackendUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncError, setSyncError] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyReports, setHistoryReports] = useState([]);

  const syncUser = useCallback(async () => {
    setSyncError(null);
    if (!isLoaded) return;
    const token = await getToken();
    if (!token) {
      setSyncStatus("idle");
      return;
    }
    setSyncStatus("syncing");
    try {
      const resp = await authFetch(apiUrl("/api/me"), token, { method: "GET" });
      await throwForResponse(resp, { defaultMessage: "Failed to sync user with backend." });
      const data = await resp.json();
      setBackendUser(data);
      setSyncStatus("ok");
    } catch (err) {
      setSyncError(getApiErrorMessage(err, { defaultMessage: "Failed to sync user with backend." }));
      setSyncStatus("error");
    }
  }, [getToken, isLoaded]);

  useEffect(() => {
    if (isLoaded) syncUser();
  }, [isLoaded, syncUser]);

  const loadHistory = useCallback(async () => {
    if (!isLoaded) return;
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setHistoryReports([]);
        return;
      }
      const resp = await authFetch(apiUrl("/api/interview/reports"), token, { method: "GET" });
      await throwForResponse(resp, { defaultMessage: "Failed to fetch interview history." });
      const data = await resp.json();
      setHistoryReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistoryError(getApiErrorMessage(err, { defaultMessage: "Failed to load interview history." }));
    } finally {
      setHistoryLoading(false);
    }
  }, [getToken, isLoaded]);

  useEffect(() => {
    if (isLoaded) loadHistory();
  }, [isLoaded, loadHistory]);

  const progressSummary = useMemo(() => {
    const total = historyReports.length;
    const scores = historyReports
      .map((r) => Number(r.score))
      .filter((n) => Number.isFinite(n));
    return {
      totalInterviews: total,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      bestScore: scores.length ? Math.max(...scores) : null,
      latestType: historyReports[0]?.type || null,
    };
  }, [historyReports]);

  const latestReportId = historyReports[0]?.id || null;
  const recentReports = historyReports.slice(0, 5);

  const controlTiles = [
    { label: "Sessions", value: progressSummary.totalInterviews, note: "completed practice runs", icon: <Speed sx={{ fontSize: 20 }} /> },
    { label: "Average score", value: progressSummary.avgScore != null ? `${progressSummary.avgScore}%` : "--", note: "across saved reports", icon: <TrendingUp sx={{ fontSize: 20 }} /> },
    { label: "Best score", value: progressSummary.bestScore != null ? `${progressSummary.bestScore}%` : "--", note: "highest session outcome", icon: <Assessment sx={{ fontSize: 20 }} /> },
  ];

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        background:
          "linear-gradient(180deg, #ffffff 0%, #fbfdff 45%, #ffffff 100%)",
        color: "#0f172a",
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(900px 380px at 4% 0%, rgba(15,118,110,.10), transparent 58%), radial-gradient(700px 320px at 96% 8%, rgba(15,23,42,.06), transparent 56%)",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative", py: { xs: 4, md: 8 }, px: { xs: 2, md: 3 } }}>
        <Stack spacing={2} sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.04em" }}>
              Coach control room
            </Typography>
            {syncStatus === "syncing" && (
              <Chip
                label="Syncing"
                size="small"
                sx={{ borderRadius: 999, bgcolor: alpha("#0f766e", 0.08), color: "#0f766e", fontWeight: 700 }}
              />
            )}
            {syncStatus === "ok" && backendUser && (
              <Chip
                label="Backend connected"
                size="small"
                sx={{ borderRadius: 999, bgcolor: alpha("#0f172a", 0.05), color: "#334155", fontWeight: 700 }}
              />
            )}
          </Box>
          <Typography sx={{ fontSize: { xs: 16, md: 18 }, lineHeight: 1.7, color: "#475569", maxWidth: 760 }}>
            Welcome back, {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "user"}. This surface is tuned to help you launch the next session, inspect recent performance, and stay oriented without the usual dashboard clutter.
          </Typography>
          {syncError && (
            <Alert severity="warning" onClose={() => setSyncError(null)} sx={{ width: "100%", maxWidth: 720 }}>
              {syncError}
            </Alert>
          )}
        </Stack>

        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12} lg={8}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 6,
                border: "1px solid rgba(148,163,184,.18)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(248,251,255,.96) 100%)",
                boxShadow: "0 18px 50px rgba(15,23,42,.06)",
                minHeight: "100%",
              }}
            >
              <Stack spacing={3}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                  <Stack spacing={1.2} sx={{ maxWidth: 620 }}>
                    <Chip
                      label="Current focus"
                      size="small"
                      sx={{ width: "fit-content", borderRadius: 999, bgcolor: alpha("#0f766e", 0.08), color: "#0f766e", fontWeight: 700 }}
                    />
                    <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1.02 }}>
                      Start a session, review the last one, or inspect your trend line.
                    </Typography>
                    <Typography sx={{ fontSize: 16, lineHeight: 1.75, color: "#475569" }}>
                      The dashboard is intentionally sparse: one clear action surface, one progress view, and one recent-history stream.
                    </Typography>
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                    <Button
                      variant="contained"
                      onClick={() => navigate("/interviews")}
                      startIcon={<PlayArrow />}
                      sx={{
                        borderRadius: 999,
                        px: 3,
                        py: 1.25,
                        bgcolor: "#0f172a",
                        "&:hover": { bgcolor: "#111827" },
                      }}
                    >
                      Start interview
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => navigate(latestReportId ? `/report/${latestReportId}` : "/interviews")}
                      sx={{
                        borderRadius: 999,
                        px: 3,
                        py: 1.25,
                        borderColor: "rgba(15,23,42,.16)",
                        color: "#0f172a",
                      }}
                    >
                      Open latest report
                    </Button>
                  </Stack>
                </Box>

                <Grid container spacing={1.5}>
                  {controlTiles.map((tile) => (
                    <Grid item xs={12} sm={4} key={tile.label}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 4,
                          border: "1px solid rgba(148,163,184,.18)",
                          backgroundColor: "rgba(255,255,255,.8)",
                          minHeight: 132,
                        }}
                      >
                        <Stack spacing={1}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#0f766e" }}>
                            {tile.icon}
                            <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>
                              {tile.label}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.05em", color: "#0f172a" }}>
                            {tile.value}
                          </Typography>
                          <Typography sx={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                            {tile.note}
                          </Typography>
                        </Stack>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 4,
                    background: alpha("#0f766e", 0.04),
                    border: "1px solid rgba(15,118,110,.10)",
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#0f766e" }}>
                    Coach note
                  </Typography>
                  <Typography sx={{ mt: 1, fontSize: 16, lineHeight: 1.8, color: "#334155" }}>
                    {progressSummary.latestType
                      ? `Your latest saved interview was ${formatInterviewTypeLabel(progressSummary.latestType)}.`
                      : "You do not have a saved interview yet. Start with a fresh session and the dashboard will begin to populate."}
                  </Typography>
                </Paper>
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 6,
                border: "1px solid rgba(148,163,184,.18)",
                background: "linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(248,250,252,.96) 100%)",
                boxShadow: "0 18px 50px rgba(15,23,42,.06)",
                height: "100%",
              }}
            >
              <Stack spacing={2.3}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#0f766e" }}>
                  Session summary
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
                  Everything you need, stripped down to the essentials.
                </Typography>
                <Stack spacing={1.5}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                    <Typography sx={{ color: "#64748b" }}>Total practice runs</Typography>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>{progressSummary.totalInterviews}</Typography>
                  </Box>
                  <Divider sx={{ borderColor: "rgba(148,163,184,.14)" }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                    <Typography sx={{ color: "#64748b" }}>Average score</Typography>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      {progressSummary.avgScore != null ? `${progressSummary.avgScore}%` : "--"}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: "rgba(148,163,184,.14)" }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                    <Typography sx={{ color: "#64748b" }}>Best score</Typography>
                    <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                      {progressSummary.bestScore != null ? `${progressSummary.bestScore}%` : "--"}
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  variant="contained"
                  onClick={() => navigate("/analytics")}
                  sx={{
                    mt: 1,
                    borderRadius: 999,
                    py: 1.2,
                    bgcolor: "#0f172a",
                    "&:hover": { bgcolor: "#111827" },
                  }}
                >
                  Open analytics
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 6,
              border: "1px solid rgba(148,163,184,.18)",
              background: "rgba(255,255,255,.94)",
              boxShadow: "0 12px 34px rgba(15,23,42,.04)",
            }}
          >
            <Stack spacing={2.5}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#0f766e" }}>
                    Recent sessions
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.8, fontWeight: 800, letterSpacing: "-0.03em" }}>
                    Recent report stream
                  </Typography>
                </Box>
                {historyLoading && (
                  <Chip
                    label="Loading"
                    size="small"
                    sx={{ borderRadius: 999, bgcolor: alpha("#0f766e", 0.08), color: "#0f766e", fontWeight: 700 }}
                  />
                )}
              </Box>

              {historyError && (
                <Alert severity="warning" onClose={() => setHistoryError(null)}>
                  {historyError}
                </Alert>
              )}

              {recentReports.length === 0 && !historyLoading ? (
                <Box
                  sx={{
                    py: 5,
                    textAlign: "center",
                    color: "#64748b",
                    borderRadius: 4,
                    border: "1px dashed rgba(148,163,184,.24)",
                  }}
                >
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                    No saved reports yet.
                  </Typography>
                  <Typography sx={{ mt: 1, fontSize: 15, lineHeight: 1.7 }}>
                    Start a session and the first report will appear here.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.25}>
                  {recentReports.map((report) => (
                    <Box
                      key={report.id}
                      sx={{
                        px: 2.2,
                        py: 1.8,
                        borderRadius: 4,
                        border: "1px solid rgba(148,163,184,.16)",
                        backgroundColor: "rgba(255,255,255,.86)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                          {formatInterviewTypeLabel(report.type)}
                        </Typography>
                        <Typography sx={{ mt: 0.3, fontSize: 13.5, color: "#64748b" }}>
                          {formatReportDate(report.date)}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          label={`${report.score ?? "--"}%`}
                          size="small"
                          sx={{ borderRadius: 999, bgcolor: alpha("#0f766e", 0.08), color: "#0f766e", fontWeight: 700 }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigate(`/report/${report.id}`)}
                          sx={{ borderRadius: 999, borderColor: "rgba(15,23,42,.16)", color: "#0f172a" }}
                        >
                          Open
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
