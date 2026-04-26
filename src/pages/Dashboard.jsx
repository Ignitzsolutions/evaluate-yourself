import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Container, Typography, Grid, Card, Box, CardContent, Button, Stack, Divider, Paper, Alert, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { PlayArrow, Speed, Psychology, Assessment, TrendingUp } from "@mui/icons-material";
import { useUser, useAuth } from "@clerk/clerk-react";
import { authFetch, throwForResponse, getApiErrorMessage } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { formatInterviewTypeLabel } from "../utils/interviewTypeLabels";

const API_BASE = getApiBaseUrl();

export default function Dashboard() {
  const nav = useNavigate();
  const go = useNavigate();
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();
  const [backendUser, setBackendUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | ok | error
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
      const resp = await authFetch(`${API_BASE}/api/me`, token, { method: "GET" });
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
      const resp = await authFetch(`${API_BASE}/api/interview/reports`, token, { method: "GET" });
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
    if (!total) {
      return {
        totalInterviews: 0,
        avgScore: null,
        bestScore: null,
        latestType: null,
      };
    }
    const scores = historyReports
      .map((r) => Number(r.score))
      .filter((n) => Number.isFinite(n));
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const bestScore = scores.length ? Math.max(...scores) : null;
    return {
      totalInterviews: total,
      avgScore,
      bestScore,
      latestType: historyReports[0]?.type || null,
    };
  }, [historyReports]);


  const cards = [
    {
      icon: <PlayArrow sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Start an Interview",
      subtitle: "Practice in a real interview setup",
      body: "Launch a live AI interview that feels like a real conversation. Choose one question or a full interview and respond naturally.",
      cta: "Start Now",
      action: () => go("/interviews")
    },
    {
      icon: <TrendingUp sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Experience How You Perform",
      subtitle: "See how you actually answer under pressure",
      body: "While you speak, the system observes your pace, clarity, confidence, and technical understanding — just like a real interviewer would.",
      cta: "View Insights",
      action: () => go("/analytics")
    },
    {
      icon: <Assessment sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Review Your Report",
      subtitle: "Clear mistakes and improvement areas",
      body: "After the interview, get a detailed report highlighting where you struggled, what worked, and why it matters in real interviews.",
      cta: "Open Report",
      action: () => {
        const latestReportId = historyReports[0]?.id;
        if (latestReportId) {
          go(`/report/${latestReportId}`);
          return;
        }
        go("/interviews");
      }
    },
    {
      icon: <Psychology sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Adaptive Follow-ups",
      subtitle: "Questions change based on your response",
      body: "If your answer is unclear or shallow, the interviewer probes deeper. If it’s strong, the difficulty increases."
    },
    {
      icon: <TrendingUp sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Improve Over Time",
      subtitle: "Track progress across sessions",
      body: "Your dashboard shows how your communication, depth, and confidence improve with practice — so every session has a purpose."
    }
  ];

  return (
    <>
      {/* PAGE WRAPPER FIXED TO WHITE SURFACE ONLY IN THIS COMPONENT */}
      <div style={{ minHeight: "100vh", display: "grid", gridTemplateRows: "1fr auto", background: "#fff", margin: 0, padding: 0 }}>

        {/* MAIN CONTENT */}
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 }, px: { xs: 2, md: 3 } }}>
          <Stack spacing={1.8} textAlign="left" alignItems="flex-start" sx={{ mb: 6 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="h5" sx={{ fontWeight: 700, opacity: 0.85 }}>
                Hello, {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "User"} 👋
              </Typography>
              {syncStatus === "syncing" && <CircularProgress size={18} sx={{ ml: 0.5 }} />}
              {syncStatus === "ok" && backendUser && (
                <Typography component="span" sx={{ fontSize: 13, opacity: 0.6 }}>
                  • Synced with backend
                </Typography>
              )}
            </Box>
            {syncError && (
              <Alert severity="warning" onClose={() => setSyncError(null)} sx={{ width: "100%", maxWidth: 560 }}>
                {syncError}
              </Alert>
            )}
            <Typography sx={{ fontSize: 15, opacity: 0.55 }}>
              Welcome back! Ready to sharpen your interview skills.
            </Typography>

            <Typography variant="h3" sx={{ fontWeight: 800, opacity: 0.9, fontSize: { xs: "2rem", md: "3rem" } }}>
              How to Use{" "}
              <Box component="span" sx={{ color: (theme) => theme.palette.primary.main }}>
                Evaluate Yourself
              </Box>
            </Typography>

            <Typography sx={{ fontSize: { xs: 15, md: 17 }, opacity: 0.6, maxWidth: 700 }}>
              A realistic interview experience designed to help you practice, improve, and get ready.
            </Typography>
          </Stack>

          <Divider sx={{ my: { xs: 4, md: 6 } }} />

          {/* ROW 1 → 3 CARDS WITH BUTTONS */}
          <Grid container spacing={3} justifyContent="flex-start">
            {cards.slice(0, 3).map((card, i) => (
              <Grid item key={i} xs={12} sm={6} lg={4}>
                <Card sx={{ borderRadius: 4, boxShadow: 1.4 }}>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={2.5} alignItems="flex-start" textAlign="left" sx={{ width: "100%" }}>
                      {card.icon}
                      <Typography variant="h6" sx={{ fontWeight: 700, opacity: 0.9 }}>
                        {card.title}
                      </Typography>

                      <Paper elevation={0} sx={{ px: 2, py: 0.6, borderRadius: 2, opacity: 0.5, alignSelf: "flex-start" }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{card.subtitle}</Typography>
                      </Paper>

                      <Typography sx={{ fontSize: 15, opacity: 0.75, lineHeight: 1.5 }}>
                        {card.body}
                      </Typography>

                      <Button variant="contained" size="large" onClick={card.action} sx={{ px: 3.5, fontSize: 15, borderRadius: 2, alignSelf: "flex-start" }}>
                        {card.cta}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* ROW 2 → REMAINING CARDS WITHOUT BUTTON */}
          <Grid container spacing={4} justifyContent="flex-start">
            {cards.slice(3).map((card, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card sx={{ borderRadius: 4, boxShadow: 1, height: "100%" }}>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={2.2} alignItems="flex-start" textAlign="left">
                      {card.icon}
                      <Typography variant="h6" sx={{ fontWeight: 600, opacity: 0.85 }}>
                        {card.title}
                      </Typography>
                      <Typography sx={{ fontSize: 14, opacity: 0.55 }}>{card.subtitle}</Typography>
                      <Typography sx={{ fontSize: 15, opacity: 0.7, lineHeight: 1.5 }}>
                        {card.body}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 8 }} />

          {/* Real Progress + Recent History */}
          <Box sx={{ mb: 8 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, opacity: 0.9, mb: 4 }}>
              Your Interview History
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ borderRadius: 2, boxShadow: 1, border: "1px solid #e0e0e0", height: "100%" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Speed sx={{ fontSize: 24, color: "#6b7280" }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "16px" }}>
                          Total Interviews
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#111827" }}>
                        {progressSummary.totalInterviews}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "13px" }}>
                        Completed by this account
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ borderRadius: 2, boxShadow: 1, border: "1px solid #e0e0e0", height: "100%" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <TrendingUp sx={{ fontSize: 24, color: "#6b7280" }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "16px" }}>
                          Average Score
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#111827" }}>
                        {progressSummary.avgScore != null ? `${progressSummary.avgScore}%` : "--"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "13px" }}>
                        Based on your saved reports
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ borderRadius: 2, boxShadow: 1, border: "1px solid #e0e0e0", height: "100%" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Assessment sx={{ fontSize: 24, color: "#6b7280" }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "16px" }}>
                          Best Score
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#111827" }}>
                        {progressSummary.bestScore != null ? `${progressSummary.bestScore}%` : "--"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "13px" }}>
                        Highest score so far
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ borderRadius: 2, boxShadow: 1, border: "1px solid #e0e0e0", height: "100%" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <PlayArrow sx={{ fontSize: 24, color: "#6b7280" }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "16px" }}>
                          Latest Type
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#111827" }}>
                        {progressSummary.latestType ? formatInterviewTypeLabel(progressSummary.latestType) : "--"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "13px" }}>
                        Most recent interview mode
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Recent Sessions
              </Typography>
              {historyLoading && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>Loading your history…</Typography>
                </Box>
              )}
              {historyError && (
                <Alert severity="warning" onClose={() => setHistoryError(null)} sx={{ mb: 2 }}>
                  {historyError}
                </Alert>
              )}
              {!historyLoading && !historyError && historyReports.length === 0 && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    No interview history yet. Complete one interview to see your reports here.
                  </Typography>
                </Paper>
              )}
              {!historyLoading && historyReports.length > 0 && (
                <Stack spacing={1.5}>
                  {historyReports.slice(0, 8).map((report) => (
                    <Paper key={report.id} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>{report.title || "Interview Session"}</Typography>
                          <Typography variant="body2" sx={{ opacity: 0.65 }}>
                            {formatInterviewTypeLabel(report.type)} • {new Date(report.date).toLocaleString()}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Score: {report.score}%
                          </Typography>
                          <Button size="small" variant="outlined" onClick={() => go(`/report/${report.id}`)}>
                            View Report
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 8 }} />

          {/* FINAL LEFT ALIGNED CTA */}
          <Stack spacing={3} alignItems="flex-start" textAlign="left" sx={{ width: "100%" }}>
            <Typography variant="h4" sx={{ fontWeight: 700, opacity: 0.8 }}>
              Interviews are a skill.<br />Skills improve when you practice the real thing.
            </Typography>

            <Button variant="contained" size="large" onClick={() => nav("/interviews")} sx={{ px: 4, py: 1.4, fontSize: 16, borderRadius: 2 }}>
              Start practicing now
            </Button>

            <Typography sx={{ fontSize: 15, opacity: 0.5 }}>
              So when the real interview happens, it won’t feel new anymore.
            </Typography>
          </Stack>

        </Container>


      </div>
    </>
  );
}
