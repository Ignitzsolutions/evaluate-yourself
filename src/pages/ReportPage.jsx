import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { authFetch } from "../utils/apiClient";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Rating,
  TextField,
  Typography,
} from "@mui/material";
import {
  AccessTime,
  Assessment,
  Chat,
  Download,
  PlayArrow,
  QuestionAnswer,
  Speed,
  Visibility,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getApiBaseUrl } from "../utils/apiBaseUrl";

const API_BASE_URL = getApiBaseUrl();

function safeTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function wordCount(text) {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeSpeaker(speaker = "") {
  const s = String(speaker).toLowerCase();
  if (["ai", "interviewer", "sonia"].includes(s)) return "ai";
  if (["user", "candidate", "you"].includes(s)) return "user";
  return s;
}

export default function ReportPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { sessionId } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadLoading, setDownloadLoading] = useState(false);

  const [experienceRating, setExperienceRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const token = await getToken();
      const response = await authFetch(`${API_BASE_URL}/api/interview/reports/${sessionId}`, token, {
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.status}`);
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      console.error("Error fetching report:", err);
      setError(err.message || "Unable to load report.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, getToken]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const metrics = useMemo(() => {
    if (!report?.metrics) return {};
    return typeof report.metrics === "object" ? report.metrics : {};
  }, [report]);

  const transcript = useMemo(() => {
    if (!Array.isArray(report?.transcript)) return [];
    return report.transcript
      .map((m) => ({
        speaker: normalizeSpeaker(m.speaker),
        text: m.text || "",
        timestamp: m.timestamp,
      }))
      .filter((m) => m.text && m.text.trim().length > 0);
  }, [report]);

  const telemetry = useMemo(() => {
    if (!transcript.length) {
      return {
        timeline: [],
        derivedAvgResponse: null,
        derivedWords: 0,
      };
    }

    const withTime = transcript
      .map((m) => ({ ...m, dt: safeTimestamp(m.timestamp) }))
      .filter((m) => m.dt)
      .sort((a, b) => a.dt - b.dt);

    if (!withTime.length) {
      return {
        timeline: [],
        derivedAvgResponse: null,
        derivedWords: transcript.reduce((sum, m) => sum + wordCount(m.text), 0),
      };
    }

    const start = withTime[0].dt.getTime();
    let userWordsCumulative = 0;
    let lastAiTs = null;
    const responseTimes = [];

    const timeline = withTime.map((m) => {
      if (m.speaker === "user") {
        userWordsCumulative += wordCount(m.text);
        if (lastAiTs) {
          const delta = (m.dt.getTime() - lastAiTs) / 1000;
          if (delta >= 0) {
            responseTimes.push(delta);
          }
          lastAiTs = null;
        }
      } else if (m.speaker === "ai") {
        lastAiTs = m.dt.getTime();
      }

      const avgResponse = responseTimes.length
        ? Number((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2))
        : null;

      return {
        time: Math.max(0, Math.floor((m.dt.getTime() - start) / 1000)),
        words: userWordsCumulative,
        avgResponse,
      };
    });

    return {
      timeline,
      derivedAvgResponse: responseTimes.length
        ? Number((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2))
        : null,
      derivedWords: userWordsCumulative,
    };
  }, [transcript]);

  const totalDuration = useMemo(() => {
    if (typeof metrics.total_duration === "number") return metrics.total_duration;
    if (typeof report?.duration === "string") {
      const n = parseInt(report.duration, 10);
      if (!Number.isNaN(n)) return n;
    }
    return 0;
  }, [metrics, report]);

  const totalWords = useMemo(() => {
    if (typeof metrics.total_words === "number") return metrics.total_words;
    return telemetry.derivedWords;
  }, [metrics, telemetry]);

  const questionsAnswered = useMemo(() => {
    if (typeof metrics.questions_answered === "number") return metrics.questions_answered;
    if (typeof report?.questions === "number") return report.questions;
    return 0;
  }, [metrics, report]);

  const avgResponseSeconds = useMemo(() => {
    if (typeof metrics.avg_response_time_seconds === "number") return metrics.avg_response_time_seconds;
    return telemetry.derivedAvgResponse;
  }, [metrics, telemetry]);

  const wordsPerMinute = useMemo(() => {
    if (typeof metrics.words_per_minute === "number") return metrics.words_per_minute;
    if (totalDuration > 0) return Math.round(totalWords / totalDuration);
    return 0;
  }, [metrics, totalWords, totalDuration]);

  const eyeContactPct = typeof metrics.eye_contact_pct === "number" ? metrics.eye_contact_pct : null;
  const sessionFeedback = metrics.session_feedback && typeof metrics.session_feedback === "object"
    ? metrics.session_feedback
    : null;

  useEffect(() => {
    if (!sessionFeedback) return;
    if (typeof sessionFeedback.rating === "number") {
      setExperienceRating(sessionFeedback.rating);
    }
    if (typeof sessionFeedback.comment === "string") {
      setFeedback(sessionFeedback.comment);
    }
  }, [sessionFeedback]);

  const formatSeconds = (seconds) => {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const handleSubmitRating = () => {
    setShowSuccessPopup(true);
  };

  const handleDownload = async () => {
    if (!sessionId) return;
    setDownloadLoading(true);
    try {
      const token = await getToken();
      const resp = await authFetch(`${API_BASE_URL}/api/interview/reports/${sessionId}/download?format=pdf`, token);
      if (!resp.ok) {
        throw new Error(`Download failed: ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `interview-report-${sessionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setDownloadLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 900, mx: "auto" }}>
        <Alert severity="error">{error}</Alert>
        <Button sx={{ mt: 2 }} variant="contained" onClick={fetchReport}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 1.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Interview Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Session telemetry captured during the live interview.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button variant="outlined" startIcon={<Download />} onClick={handleDownload} disabled={downloadLoading}>
            {downloadLoading ? "Preparing..." : "Download PDF"}
          </Button>
          <Button variant="contained" startIcon={<PlayArrow />} onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </Box>
      </Box>

      {sessionFeedback && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Feedback submitted before ending session: {sessionFeedback.rating}/5
          </Typography>
          {sessionFeedback.comment && (
            <Typography variant="body2" color="text.secondary">
              “{sessionFeedback.comment}”
            </Typography>
          )}
        </Alert>
      )}

      <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Interview Statistics
            </Typography>
            {report?.type && <Chip size="small" label={report.type} color="primary" variant="outlined" />}
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined"><CardContent>
                <AccessTime color="primary" />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalDuration} min</Typography>
                <Typography variant="caption" color="text.secondary">Duration</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined"><CardContent>
                <QuestionAnswer color="error" />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{questionsAnswered}</Typography>
                <Typography variant="caption" color="text.secondary">Questions Answered</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined"><CardContent>
                <Chat color="success" />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalWords}</Typography>
                <Typography variant="caption" color="text.secondary">Total Words</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined"><CardContent>
                <Speed sx={{ color: "warning.main" }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{wordsPerMinute}</Typography>
                <Typography variant="caption" color="text.secondary">Words / Min</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined"><CardContent>
                <Assessment sx={{ color: "info.main" }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {avgResponseSeconds != null ? `${avgResponseSeconds}s` : "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary">Avg Response Time</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined"><CardContent>
                <Visibility sx={{ color: eyeContactPct != null ? "success.main" : "text.secondary" }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {eyeContactPct != null ? `${eyeContactPct}%` : "Not Captured"}
                </Typography>
                <Typography variant="caption" color="text.secondary">Eye Contact</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            Realtime Session Timeline
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Built from captured transcript timestamps and session metrics.
          </Typography>

          {telemetry.timeline.length > 1 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={telemetry.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tickFormatter={(v) => formatSeconds(v)} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  labelFormatter={(value) => `Time ${formatSeconds(value)}`}
                  formatter={(value, name) => {
                    if (name === "words") return [value, "Cumulative Words"];
                    if (name === "avgResponse") return [value == null ? "-" : `${value}s`, "Avg Response (s)"];
                    return [value, name];
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="words" stroke="#0056B3" strokeWidth={2} name="Cumulative Words" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="avgResponse" stroke="#e63946" strokeWidth={2} name="Avg Response (s)" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Alert severity="info">Not enough timestamped transcript data to render timeline charts for this session.</Alert>
          )}
        </CardContent>
      </Card>

      {report?.ai_feedback && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              AI Interview Feedback
            </Typography>
            <Typography sx={{ mb: 2 }}>{report.ai_feedback.overall_summary}</Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Strengths</Typography>
                {report.ai_feedback.strengths?.map((x, idx) => (
                  <Typography key={idx} variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>• {x}</Typography>
                ))}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Areas to Improve</Typography>
                {report.ai_feedback.areas_for_improvement?.map((x, idx) => (
                  <Typography key={idx} variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>• {x}</Typography>
                ))}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {!sessionFeedback && (
        <Card sx={{ border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Rate Your Experience
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" sx={{ mb: 1 }}>How was your interview experience?</Typography>
                <Rating value={experienceRating} onChange={(_, v) => setExperienceRating(v || 0)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Additional Feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2 }}>
              <Button variant="contained" onClick={handleSubmitRating} disabled={experienceRating === 0}>
                Submit Rating
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog open={showSuccessPopup} onClose={() => setShowSuccessPopup(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Thank you</DialogTitle>
        <DialogContent>
          <Typography>Your feedback has been recorded.</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
