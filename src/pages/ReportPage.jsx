import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { authFetch } from "../utils/apiClient";
import { formatInterviewTypeLabel } from "../utils/interviewTypeLabels";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  LinearProgress,
  Rating,
  TextField,
  Typography,
} from "@mui/material";
import {
  AccessTime,
  Assessment,
  Chat,
  Download,
  ExpandMore,
  PlayArrow,
  QuestionAnswer,
  Speed,
  Visibility,
} from "@mui/icons-material";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
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
  const location = useLocation();
  const { getToken } = useAuth();
  const { sessionId } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadLoading, setDownloadLoading] = useState(false);

  const [experienceRating, setExperienceRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [showPostEndFeedbackDialog, setShowPostEndFeedbackDialog] = useState(false);
  const [postEndPromptHandled, setPostEndPromptHandled] = useState(false);
  const [gazeEvents, setGazeEvents] = useState([]);
  const [gazeSummary, setGazeSummary] = useState(null);

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

      const sessionKey = data?.session_id || sessionId;
      if (sessionKey) {
        const gazeResponse = await authFetch(
          `${API_BASE_URL}/api/interview/sessions/${sessionKey}/gaze-events?limit=500`,
          token,
          { headers: { "Content-Type": "application/json" } },
        );
        if (gazeResponse.ok) {
          const gazeData = await gazeResponse.json();
          setGazeEvents(Array.isArray(gazeData?.events) ? gazeData.events : []);
          setGazeSummary(gazeData?.summary || null);
        } else {
          setGazeEvents([]);
          setGazeSummary(null);
        }
      }
    } catch (err) {
      console.error("Error fetching report:", err);
      setError(err.message || "Unable to load report.");
      setGazeEvents([]);
      setGazeSummary(null);
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

  const eyeContactPct = typeof metrics.eye_contact_pct === "number"
    ? metrics.eye_contact_pct
    : (typeof gazeSummary?.eye_contact_pct === "number" ? gazeSummary.eye_contact_pct : null);
  const gazeFlagsByType = metrics.gaze_flags_by_type && typeof metrics.gaze_flags_by_type === "object"
    ? metrics.gaze_flags_by_type
    : (gazeSummary?.events_by_type || {});
  const gazeFlagsCount = typeof metrics.gaze_flags_count === "number"
    ? metrics.gaze_flags_count
    : (typeof gazeSummary?.total_events === "number" ? gazeSummary.total_events : gazeEvents.length);
  const gazeLongestAwayMs = typeof metrics.gaze_longest_away_ms === "number"
    ? metrics.gaze_longest_away_ms
    : (typeof gazeSummary?.longest_event_ms === "number" ? gazeSummary.longest_event_ms : 0);
  const captureStatus = typeof metrics.capture_status === "string" ? metrics.capture_status : "COMPLETE";
  const isIncompleteCapture = captureStatus === "INCOMPLETE_NO_CANDIDATE_AUDIO";
  const isPartialCapture = captureStatus === "INCOMPLETE_PARTIAL_CAPTURE";

  // Parse score breakdown from report
  const scores = useMemo(() => {
    if (!report?.scores) return null;
    const s = typeof report.scores === "string" ? JSON.parse(report.scores) : report.scores;
    return {
      communication: typeof s.communication === "number" ? s.communication : null,
      clarity: typeof s.clarity === "number" ? s.clarity : null,
      structure: typeof s.structure === "number" ? s.structure : null,
      relevance: typeof s.relevance === "number" ? s.relevance : null,
      technical_depth: typeof s.technical_depth === "number" ? s.technical_depth : null,
      eye_contact: typeof s.eye_contact === "number" ? s.eye_contact : null,
    };
  }, [report?.scores]);
  const turnEvaluations = Array.isArray(metrics.turn_evaluations) ? metrics.turn_evaluations : [];
  const turnEvalSummary = metrics.turn_eval_summary && typeof metrics.turn_eval_summary === "object"
    ? metrics.turn_eval_summary
    : null;
  const evaluationExplainability = metrics.evaluation_explainability && typeof metrics.evaluation_explainability === "object"
    ? metrics.evaluation_explainability
    : null;
  const contractVersion = typeof metrics.evaluation_contract_version === "string"
    ? metrics.evaluation_contract_version
    : "v1";
  const contractPassed = typeof metrics.contract_passed === "boolean"
    ? metrics.contract_passed
    : true;
  const validationFlags = Array.isArray(metrics.validation_flags) ? metrics.validation_flags : [];
  const captureEvidence = metrics.capture_evidence && typeof metrics.capture_evidence === "object"
    ? metrics.capture_evidence
    : {};
  const scoreProvenance = metrics.score_provenance && typeof metrics.score_provenance === "object"
    ? metrics.score_provenance
    : {};
  const rubricVersion = metrics.rubric_version || scoreProvenance.rubric_version || evaluationExplainability?.rubric_version || "unknown";
  const scorerVersion = metrics.scorer_version || scoreProvenance.scorer_version || evaluationExplainability?.scorer_version || "unknown";
  const turnEvidence = Array.isArray(metrics.turn_evidence) ? metrics.turn_evidence : [];
  const contractWarningFromState = location.state?.contractWarning;
  const forcedZeroReason = scoreProvenance.forced_zero_reason || evaluationExplainability?.forced_zero_reason || null;
  const shouldShowForcedZero = Number(report?.overall_score || 0) === 0 && (
    Boolean(forcedZeroReason) || !contractPassed || isIncompleteCapture
  );
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

  useEffect(() => {
    if (loading || postEndPromptHandled) return;
    if (sessionFeedback) return;
    if (location.state?.openFeedbackDialog) {
      setShowPostEndFeedbackDialog(true);
      setPostEndPromptHandled(true);
    }
  }, [loading, postEndPromptHandled, sessionFeedback, location.state]);

  const formatSeconds = (seconds) => {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };
  const formatDurationMs = (ms) => {
    if (!ms || Number.isNaN(ms)) return "0.0s";
    return `${(Number(ms) / 1000).toFixed(1)}s`;
  };

  const persistSessionFeedback = useCallback(async () => {
    if (!report?.id) return;
    if (!experienceRating || experienceRating < 1) {
      setFeedbackError("Please select a rating before submitting.");
      return;
    }

    setFeedbackError("");
    setSavingFeedback(true);
    try {
      const token = await getToken();
      const payload = {
        rating: experienceRating,
        comment: feedback.trim() || null,
        submitted_at: new Date().toISOString(),
      };

      const response = await authFetch(
        `${API_BASE_URL}/api/interview/reports/${report.id}/feedback`,
        token,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Failed to save feedback (${response.status})`);
      }

      const data = await response.json();
      setReport((prev) => {
        if (!prev) return prev;
        const nextMetrics = { ...(prev.metrics || {}) };
        nextMetrics.session_feedback = data.session_feedback || payload;
        return {
          ...prev,
          metrics: nextMetrics,
        };
      });
      setShowSuccessPopup(true);
      setShowPostEndFeedbackDialog(false);
    } catch (err) {
      setFeedbackError(err.message || "Failed to save feedback");
    } finally {
      setSavingFeedback(false);
    }
  }, [report, experienceRating, feedback, getToken]);

  const handleSubmitRating = () => {
    persistSessionFeedback();
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
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, mb: 3, flexWrap: "wrap", gap: 1.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: "1.75rem", md: "2.125rem" } }}>
            Interview Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Session telemetry captured during the live interview.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<Download />} onClick={handleDownload} disabled={downloadLoading}>
            {downloadLoading ? "Preparing..." : "Download PDF"}
          </Button>
          <Button variant="contained" startIcon={<PlayArrow />} onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </Box>
      </Box>

      {isIncompleteCapture && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Evaluation incomplete: candidate speech was not captured.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Retry interview after checking microphone permission and live transcription capture.
          </Typography>
        </Alert>
      )}
      {isPartialCapture && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Evaluation partial: this session ended early.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Score reflects partial interview evidence only; confidence is reduced.
          </Typography>
        </Alert>
      )}
      {!isIncompleteCapture && !isPartialCapture && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Evaluation complete: candidate responses were captured and analyzed.
          </Typography>
        </Alert>
      )}

      {/* ── Hiring Recommendation Badge ─────────────────────────────────── */}
      {report?.hiring_recommendation && !isIncompleteCapture && (() => {
        const hr = report.hiring_recommendation;
        const colorMap = { strong_hire: "success", hire: "success", borderline: "warning", no_hire: "error" };
        const bgMap = { strong_hire: "#e8f5e9", hire: "#f1f8e9", borderline: "#fff8e1", no_hire: "#ffebee" };
        const color = colorMap[hr.signal] || "default";
        const bg = bgMap[hr.signal] || "#f5f5f5";
        return (
          <Card sx={{ mb: 3, border: "2px solid", borderColor: `${color}.main`, backgroundColor: bg }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1.5, flexWrap: "wrap" }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Hiring Recommendation</Typography>
                <Chip
                  label={hr.label}
                  color={color}
                  size="medium"
                  sx={{ fontWeight: 700, fontSize: "1rem", px: 1 }}
                />
              </Box>
              <Box sx={{ display: "grid", gap: 0.75 }}>
                {(hr.rationale_bullets || []).map((b, i) => (
                  <Typography key={i} variant="body2" color="text.secondary">• {b}</Typography>
                ))}
              </Box>
              {(hr.green_flags || []).length > 0 && (
                <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {hr.green_flags.map((f, i) => (
                    <Chip key={i} size="small" label={`✓ ${f.slice(0, 60)}`} color="success" variant="outlined" />
                  ))}
                </Box>
              )}
              {(hr.red_flags || []).length > 0 && (
                <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {hr.red_flags.map((f, i) => (
                    <Chip key={i} size="small" label={`⚠ ${f.slice(0, 60)}`} color="error" variant="outlined" />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })()}

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

      {contractWarningFromState?.message && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {contractWarningFromState.message}
          </Typography>
        </Alert>
      )}

      <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            Validation & Provenance
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Contract checks verify whether captured evidence is sufficient for a valid score.
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={3}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Contract Status</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {contractPassed ? "Passed" : "Failed"}
                </Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Source</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {scoreProvenance.source || evaluationExplainability?.source || "unknown"}
                </Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Confidence</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {scoreProvenance.confidence || evaluationExplainability?.confidence || "unknown"}
                </Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Turns Evaluated</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {captureEvidence.turns_evaluated ?? evaluationExplainability?.turns_evaluated ?? turnEvaluations.length}
                </Typography>
              </CardContent></Card>
            </Grid>
          </Grid>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Contract Version: <strong>{contractVersion}</strong> · Candidate Words: <strong>{captureEvidence.candidate_word_count ?? metrics.candidate_word_count ?? 0}</strong> · Candidate Turns: <strong>{captureEvidence.candidate_turn_count ?? metrics.candidate_turn_count ?? 0}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Rubric: <strong>{rubricVersion}</strong> · Scorer: <strong>{scorerVersion}</strong>
          </Typography>
          {shouldShowForcedZero && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Score forced to 0 due to missing or invalid evidence.
              </Typography>
            </Alert>
          )}
          {!contractPassed && validationFlags.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Validation flags
              </Typography>
              {validationFlags.map((flag, idx) => (
                <Typography key={`${flag}-${idx}`} variant="body2" color="text.secondary">
                  • {flag}
                </Typography>
              ))}
            </Alert>
          )}
          {turnEvidence.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              Evidence-backed turns persisted: <strong>{turnEvidence.length}</strong>
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            Gaze Flags Timeline
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Timestamped monitoring flags captured during the interview session.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Flags Captured</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{gazeFlagsCount}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Longest Event</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatDurationMs(gazeLongestAwayMs)}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Eye Contact</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {eyeContactPct != null ? `${Number(eyeContactPct).toFixed(1)}%` : "Not Captured"}
                </Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
            {Object.entries(gazeFlagsByType).length > 0 ? (
              Object.entries(gazeFlagsByType).map(([key, value]) => (
                <Chip key={key} size="small" label={`${key}: ${value}`} variant="outlined" />
              ))
            ) : (
              <Chip size="small" label="No gaze flags captured" color="success" variant="outlined" />
            )}
          </Box>

          {gazeEvents.length > 0 ? (
            <Box sx={{ display: "grid", gap: 1 }}>
              {gazeEvents.slice(0, 25).map((event) => (
                <Card key={event.id} variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {event.event_type} · {formatDurationMs(event.duration_ms)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {event.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {event.started_at ? new Date(event.started_at).toLocaleTimeString() : "-"}
                      {" → "}
                      {event.ended_at ? new Date(event.ended_at).toLocaleTimeString() : "-"}
                      {event.confidence != null ? ` · confidence ${event.confidence}%` : ""}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <Alert severity="info">No gaze flag events were persisted for this session.</Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Interview Statistics
            </Typography>
            {report?.type && <Chip size="small" label={formatInterviewTypeLabel(report.type)} color="primary" variant="outlined" />}
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

      {!isIncompleteCapture && scores && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Score Breakdown</Typography>
                <Typography variant="body2" color="text.secondary">Per-dimension scores derived from turn evaluations</Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h3" sx={{ fontWeight: 800, color: Number(report?.overall_score || 0) >= 70 ? "success.main" : Number(report?.overall_score || 0) >= 50 ? "warning.main" : "error.main" }}>
                  {report?.overall_score ?? "—"}
                </Typography>
                <Typography variant="caption" color="text.secondary">Overall Score</Typography>
              </Box>
            </Box>
            <Box sx={{ display: "grid", gap: 1.5 }}>
              {[
                { label: "Communication", value: scores.communication, color: "#1976d2", help: "Confidence, filler usage, hedging phrases" },
                { label: "Clarity", value: scores.clarity, color: "#0288d1", help: "Sentence structure, word count, pacing" },
                { label: "Structure (STAR)", value: scores.structure, color: "#388e3c", help: "Use of Situation / Task / Action / Result" },
                { label: "Relevance", value: scores.relevance, color: "#7b1fa2", help: "On-topic answers aligned to questions" },
                ...(scores.technical_depth != null ? [{ label: "Technical Depth", value: scores.technical_depth, color: "#e65100", help: "Domain knowledge, specificity, tradeoffs" }] : []),
                ...(scores.eye_contact != null ? [{ label: "Eye Contact", value: scores.eye_contact, color: "#00796b", help: "Face-on-camera presence during interview" }] : []),
              ].map(({ label, value, color, help }) => (
                <Box key={label}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                      <Typography variant="caption" color="text.secondary">{help}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color }}>{value ?? "—"}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={value ?? 0}
                    sx={{ height: 8, borderRadius: 4, backgroundColor: "action.hover", "& .MuiLinearProgress-bar": { backgroundColor: color, borderRadius: 4 } }}
                  />
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Competency Radar Chart ──────────────────────────────────────── */}
      {report?.competency_scores && !isIncompleteCapture && (() => {
        const COMP_LABELS = {
          communication: "Communication",
          problem_solving: "Problem Solving",
          technical_depth: "Technical Depth",
          ownership: "Ownership",
          collaboration: "Collaboration",
          adaptability: "Adaptability",
        };
        const radarData = Object.entries(report.competency_scores)
          .filter(([, v]) => v > 0)
          .map(([key, value]) => ({ subject: COMP_LABELS[key] || key, score: value, fullMark: 100 }));
        if (radarData.length < 3) return null;
        return (
          <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Competency Analysis</Typography>
              {report.score_context && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{report.score_context}</Typography>
              )}
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={6}>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                      <Radar name="Score" dataKey="score" stroke="#1976d2" fill="#1976d2" fillOpacity={0.25} />
                      <Tooltip formatter={(v) => [`${v}/100`, "Score"]} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: "grid", gap: 1.5 }}>
                    {radarData.map(({ subject, score }) => (
                      <Box key={subject}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{subject}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: score >= 80 ? "success.main" : score >= 60 ? "warning.main" : "error.main" }}>
                            {score}/100
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={score}
                          sx={{ height: 6, borderRadius: 3, backgroundColor: "action.hover", "& .MuiLinearProgress-bar": { backgroundColor: score >= 80 ? "#388e3c" : score >= 60 ? "#f57c00" : "#d32f2f", borderRadius: 3 } }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );
      })()}

      <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            Realtime Session Timeline
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Built from captured transcript timestamps and session metrics.
          </Typography>

          {telemetry.timeline.length > 1 ? (
            <ResponsiveContainer width="100%" height={300}>
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

      {!isIncompleteCapture && (turnEvalSummary || turnEvaluations.length > 0) && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Evaluation Transparency
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Scores are computed from candidate turns using clarity, depth, and relevance.
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={3}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="caption" color="text.secondary">Avg Clarity</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {turnEvalSummary?.avg_clarity ?? 0}
                  </Typography>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="caption" color="text.secondary">Avg Communication</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {turnEvalSummary?.avg_communication ?? "—"}
                  </Typography>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="caption" color="text.secondary">Avg Depth</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {turnEvalSummary?.avg_depth ?? 0}
                  </Typography>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="caption" color="text.secondary">Avg Relevance</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {turnEvalSummary?.avg_relevance ?? 0}
                  </Typography>
                </CardContent></Card>
              </Grid>
            </Grid>

            {evaluationExplainability && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Source: <strong>{evaluationExplainability.source}</strong> · Confidence: <strong>{evaluationExplainability.confidence || "unknown"}</strong> · Formula: <strong>{evaluationExplainability.formula}</strong> · Turns Evaluated: <strong>{evaluationExplainability.turns_evaluated}</strong>
                </Typography>
              </Alert>
            )}

            {turnEvaluations.length > 0 && (
              <Box sx={{ display: "grid", gap: 1 }}>
                {turnEvaluations.slice(0, 8).map((turn, index) => {
                  const star = turn.star_completeness || {};
                  const starKeys = ["situation", "task", "action", "result"];
                  return (
                    <Card key={index} variant="outlined">
                      <CardContent sx={{ py: 1.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Turn {index + 1}
                            {turn.confidence && <Chip size="small" label={turn.confidence} sx={{ ml: 1 }} />}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Clarity {turn.clarity ?? "—"} · Comm {turn.communication ?? "—"} · Depth {turn.depth ?? "—"} · Rel {turn.relevance ?? "—"}
                          </Typography>
                        </Box>
                        {Object.values(star).some(Boolean) && (
                          <Box sx={{ display: "flex", gap: 0.5, mb: 0.5, flexWrap: "wrap" }}>
                            {starKeys.map((k) => (
                              <Chip
                                key={k}
                                size="small"
                                label={k.charAt(0).toUpperCase() + k.slice(1)}
                                color={star[k] ? "success" : "default"}
                                variant={star[k] ? "filled" : "outlined"}
                                sx={{ fontSize: "0.65rem" }}
                              />
                            ))}
                          </Box>
                        )}
                        {turn.rationale && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
                            {turn.rationale}
                          </Typography>
                        )}
                        {turn.evidence_excerpt && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.75rem", fontStyle: "italic", mt: 0.5 }}>
                            "{turn.evidence_excerpt}"
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Per-Question Analysis ───────────────────────────────────────── */}
      {report?.turn_analyses?.length > 0 && !isIncompleteCapture && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Per-Question Analysis</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Each answer evaluated for competency, STAR structure, and evidence of impact.
            </Typography>
            {report.turn_analyses.map((turn, idx) => {
              const star = turn.star_breakdown || {};
              const starKeys = ["situation", "task", "action", "result"];
              const starDetected = starKeys.filter(k => star[k]);
              const scoreColor = turn.score_0_100 >= 80 ? "success.main" : turn.score_0_100 >= 60 ? "warning.main" : "error.main";
              return (
                <Accordion key={idx} disableGutters sx={{ mb: 1, border: "1px solid", borderColor: "divider", borderRadius: "8px !important", "&:before": { display: "none" } }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", width: "100%" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Q{turn.turn_id}</Typography>
                      <Chip size="small" label={turn.competency?.replace(/_/g, " ")} variant="outlined" color="primary" />
                      <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, display: { xs: "none", sm: "block" } }}>
                        {(turn.question_text || "").slice(0, 60)}{turn.question_text?.length > 60 ? "…" : ""}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: scoreColor, ml: "auto" }}>
                        {turn.score_0_100}/100
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>{turn.question_text}</Typography>

                    {/* STAR breakdown */}
                    <Box sx={{ display: "flex", gap: 0.75, mb: 1.5, flexWrap: "wrap" }}>
                      {starKeys.map((k) => {
                        const detected = star[k];
                        const snippet = star[`${k}_snippet`];
                        return (
                          <Chip
                            key={k}
                            size="small"
                            label={k.charAt(0).toUpperCase() + k.slice(1)}
                            color={detected ? "success" : "default"}
                            variant={detected ? "filled" : "outlined"}
                            title={snippet || ""}
                            sx={{ fontSize: "0.7rem" }}
                          />
                        );
                      })}
                      {star.source === "llm" && <Chip size="small" label="AI-extracted" variant="outlined" sx={{ fontSize: "0.65rem", color: "text.secondary" }} />}
                    </Box>

                    {/* Evidence quote */}
                    {turn.evidence_quote && (
                      <Alert severity="info" icon={false} sx={{ mb: 1.5, py: 0.75 }}>
                        <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                          "{turn.evidence_quote}"
                        </Typography>
                      </Alert>
                    )}

                    {/* One-line feedback */}
                    {turn.one_line_feedback && (
                      <Typography variant="body2" color="text.secondary">
                        💡 {turn.one_line_feedback}
                      </Typography>
                    )}

                    {/* Depth signals */}
                    {turn.depth_signals && (
                      <Box sx={{ mt: 1, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {turn.depth_signals.metrics_mentioned?.length > 0 && (
                          <Chip size="small" label={`📊 ${turn.depth_signals.metrics_mentioned.length} metric(s)`} variant="outlined" color="success" />
                        )}
                        {turn.depth_signals.ownership_signals > 0 && (
                          <Chip size="small" label={`✋ ${turn.depth_signals.ownership_signals} ownership signal(s)`} variant="outlined" color="primary" />
                        )}
                        {turn.depth_signals.tech_named?.length > 0 && (
                          <Chip size="small" label={`⚙ ${turn.depth_signals.tech_named.slice(0, 3).join(", ")}`} variant="outlined" />
                        )}
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Improvement Roadmap ─────────────────────────────────────────── */}
      {report?.improvement_roadmap?.length > 0 && !isIncompleteCapture && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Improvement Roadmap</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Evidence-based, prioritized actions for your next interview.
            </Typography>
            <Box sx={{ display: "grid", gap: 2 }}>
              {report.improvement_roadmap.map((item, idx) => (
                <Card key={idx} variant="outlined" sx={{ borderLeft: "4px solid", borderLeftColor: "warning.main" }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                      <Chip size="small" label={item.competency?.replace(/_/g, " ")} color="warning" variant="outlined" />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>#{idx + 1} Priority</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                      <strong>Finding:</strong> {item.finding}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                      <strong>Action:</strong> {item.suggested_action}
                    </Typography>
                    {item.example_reframe && (
                      <Alert severity="success" icon={false} sx={{ py: 0.5 }}>
                        <Typography variant="body2" sx={{ fontStyle: "italic", fontSize: "0.8rem" }}>
                          {item.example_reframe}
                        </Typography>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {!isIncompleteCapture && report?.ai_feedback && (
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

      {isIncompleteCapture && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Next Steps
            </Typography>
            <Typography variant="body2" color="text.secondary">1. Confirm browser microphone permission is granted.</Typography>
            <Typography variant="body2" color="text.secondary">2. Speak for 5–10 seconds and verify live transcript appears before ending.</Typography>
            <Typography variant="body2" color="text.secondary">3. Re-run the interview to generate full candidate-centric scoring.</Typography>
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
              <Button variant="contained" onClick={handleSubmitRating} disabled={experienceRating === 0 || savingFeedback}>
                {savingFeedback ? "Saving..." : "Submit Rating"}
              </Button>
            </Box>
            {feedbackError && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {feedbackError}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showPostEndFeedbackDialog} onClose={() => setShowPostEndFeedbackDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Interview Ended</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your interview has ended. Share quick feedback before you continue.
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Session Rating
            </Typography>
            <Rating
              value={experienceRating}
              onChange={(_, v) => setExperienceRating(v || 0)}
            />
          </Box>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Comments (Optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="How was your interview flow and voice pacing?"
          />
          {feedbackError && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {feedbackError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPostEndFeedbackDialog(false)}>
            Skip
          </Button>
          <Button variant="contained" onClick={persistSessionFeedback} disabled={savingFeedback}>
            {savingFeedback ? "Saving..." : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

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
