import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  authFetch,
  buildApiErrorFromResponse,
  getApiErrorMessage,
  isAuthRequiredError,
  isBackendUnavailableError,
} from "../utils/apiClient";
import { formatInterviewTypeLabel } from "../utils/interviewTypeLabels";
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

function getReportErrorPresentation(errorKind) {
  switch (errorKind) {
    case "auth_required":
      return {
        title: "Sign in again to view this report.",
        description: "Your session is no longer valid for report access.",
        canRetry: false,
      };
    case "not_found":
      return {
        title: "This report could not be found.",
        description: "The report link may be stale or the interview may not have finished saving.",
        canRetry: false,
      };
    case "backend_unavailable":
      return {
        title: "The report service is unavailable.",
        description: "The backend did not respond. Retry once the service is back.",
        canRetry: true,
      };
    default:
      return {
        title: "The report could not be loaded.",
        description: "A non-recoverable client or server error interrupted report loading.",
        canRetry: true,
      };
  }
}

export default function ReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();
  const { sessionId } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState("");
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
  const [replayData, setReplayData] = useState(null);
  const [replayTimeMs, setReplayTimeMs] = useState(0);
  const reportKey = sessionId;

  const fetchReport = useCallback(async () => {
    if (!reportKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setErrorKind("");

      const token = await getToken();
      const response = await authFetch(`${API_BASE_URL}/api/interview/reports/${reportKey}`, token, {
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw await buildApiErrorFromResponse(response, {
          defaultMessage: `Failed to fetch report (${response.status}).`,
        });
      }

      const data = await response.json();
      setReport(data);

      const sessionKey = data?.session_id || reportKey;
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

        const replayResponse = await authFetch(
          `${API_BASE_URL}/api/interview/reports/${reportKey}/replay`,
          token,
          { headers: { "Content-Type": "application/json" } },
        );
        if (replayResponse.ok) {
          const replayPayload = await replayResponse.json();
          setReplayData(replayPayload);
        } else {
          setReplayData(null);
        }
      }
    } catch (err) {
      console.error("Error fetching report:", err);
      const status = Number(err?.status || 0);
      setErrorKind(
        isBackendUnavailableError(err)
          ? "backend_unavailable"
          : isAuthRequiredError(err) || status === 401 || status === 403
            ? "auth_required"
            : status === 404
              ? "not_found"
              : "generic",
      );
      setError(getApiErrorMessage(err, {
        backendLabel: "report service",
        defaultMessage: "Unable to load report.",
      }));
      setGazeEvents([]);
      setGazeSummary(null);
      setReplayData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken, reportKey]);

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
  const captureIntegrity = metrics.capture_integrity && typeof metrics.capture_integrity === "object"
    ? metrics.capture_integrity
    : {};
  const scoreProvenance = metrics.score_provenance && typeof metrics.score_provenance === "object"
    ? metrics.score_provenance
    : {};
  const scoreTrustLevel = typeof metrics.score_trust_level === "string"
    ? metrics.score_trust_level
    : "trusted";
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
  const communicationSignals = metrics.communication_signals && typeof metrics.communication_signals === "object"
    ? metrics.communication_signals
    : (metrics.evaluation_channels?.english_communication && typeof metrics.evaluation_channels.english_communication === "object"
      ? metrics.evaluation_channels.english_communication
      : {});
  const confidenceScore = typeof metrics.confidence_score === "number"
    ? metrics.confidence_score
    : null;
  const handoffSummary = metrics.agent_handoff_summary && typeof metrics.agent_handoff_summary === "object"
    ? metrics.agent_handoff_summary
    : (replayData?.agent_handoff_summary && typeof replayData.agent_handoff_summary === "object" ? replayData.agent_handoff_summary : {});
  const memorySummary = metrics.memory_summary && typeof metrics.memory_summary === "object"
    ? metrics.memory_summary
    : (replayData?.memory_summary && typeof replayData.memory_summary === "object" ? replayData.memory_summary : {});
  const replaySegments = useMemo(
    () => (Array.isArray(replayData?.segments) ? replayData.segments : []),
    [replayData],
  );
  const replayDurationMs = useMemo(() => {
    const segmentEnd = replaySegments.reduce((max, segment) => {
      const endMs = Number(segment?.end_ms || 0);
      return Number.isFinite(endMs) ? Math.max(max, endMs) : max;
    }, 0);
    const gazeEnd = Array.isArray(replayData?.gaze_windows)
      ? replayData.gaze_windows.reduce((max, window) => {
        const endMs = Number(window?.end_ms || 0);
        return Number.isFinite(endMs) ? Math.max(max, endMs) : max;
      }, 0)
      : 0;
    return Math.max(segmentEnd, gazeEnd, totalDuration * 60 * 1000);
  }, [replayData, replaySegments, totalDuration]);
  const activeReplaySegment = useMemo(() => {
    if (!replaySegments.length) return null;
    return replaySegments.find((segment) => {
      const startMs = Number(segment?.start_ms || 0);
      const endMs = Number(segment?.end_ms || startMs);
      return replayTimeMs >= startMs && replayTimeMs <= endMs;
    }) || replaySegments[0];
  }, [replaySegments, replayTimeMs]);
  const activeGazeWindow = useMemo(() => {
    const gazeWindows = Array.isArray(replayData?.gaze_windows) ? replayData.gaze_windows : [];
    return gazeWindows.find((window) => {
      const startMs = Number(window?.start_ms || 0);
      const endMs = Number(window?.end_ms || startMs);
      return replayTimeMs >= startMs && replayTimeMs <= endMs;
    }) || null;
  }, [replayData, replayTimeMs]);
  const nearbyFillerMarkers = useMemo(() => {
    const markers = Array.isArray(replayData?.filler_density_markers) ? replayData.filler_density_markers : [];
    return markers.filter((marker) => Math.abs(Number(marker?.time_ms || 0) - replayTimeMs) <= 15000).slice(0, 3);
  }, [replayData, replayTimeMs]);

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
  const formatMilliseconds = (value) => formatSeconds(Math.floor(Number(value || 0) / 1000));
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
    const errorPresentation = getReportErrorPresentation(errorKind);
    return (
      <Box sx={{ p: 4, maxWidth: 900, mx: "auto" }}>
        <Alert severity="error">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {errorPresentation.title}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {errorPresentation.description}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        </Alert>
        <Box sx={{ mt: 2, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {errorPresentation.canRetry && (
            <Button variant="contained" onClick={fetchReport}>
              Retry
            </Button>
          )}
          <Button variant="outlined" onClick={() => navigate("/interviews")}>
            Back to Interviews
          </Button>
          <Button variant="outlined" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </Box>
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
          <Button variant="contained" startIcon={<PlayArrow />} onClick={() => navigate("/dashboard")}>
            Back to Dashboard
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
      {captureStatus === "INCOMPLETE_FALLBACK_ONLY_CAPTURE" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Evaluation incomplete: only browser fallback transcript was captured for the candidate.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The interview transcript remains visible for review, but fallback-only candidate transcript is excluded from trusted scoring.
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
      {!isIncompleteCapture && !isPartialCapture && captureStatus !== "INCOMPLETE_FALLBACK_ONLY_CAPTURE" && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Evaluation complete: candidate responses were captured and analyzed.
          </Typography>
        </Alert>
      )}
      {scoreTrustLevel === "mixed_evidence" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Mixed transcript evidence detected.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Browser fallback transcript kept the interview moving, but scoring used only trusted server-captured candidate turns.
          </Typography>
        </Alert>
      )}
      {scoreTrustLevel === "coaching_only" && !isIncompleteCapture && captureStatus !== "INCOMPLETE_FALLBACK_ONLY_CAPTURE" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            This score should be treated as coaching-quality guidance, not a fully trusted evaluation.
          </Typography>
        </Alert>
      )}

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

      {replayData?.replay_available && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Replay Overlay
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Scrub through the interview timeline to inspect pacing, gaze, filler density, and confidence annotations.
            </Typography>
            <Box sx={{ mb: 2 }}>
              <input
                aria-label="Replay timeline"
                type="range"
                min={0}
                max={Math.max(replayDurationMs, 1)}
                step={500}
                value={Math.min(replayTimeMs, replayDurationMs)}
                onChange={(event) => setReplayTimeMs(Number(event.target.value || 0))}
                style={{ width: "100%" }}
              />
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {formatMilliseconds(replayTimeMs)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatMilliseconds(replayDurationMs)}
                </Typography>
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Active Segment</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, textTransform: "capitalize", mb: 1 }}>
                      {activeReplaySegment?.speaker || "No segment"}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                      {activeReplaySegment?.text || "Move the timeline to inspect transcript segments."}
                    </Typography>
                    {activeReplaySegment && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Evidence: {activeReplaySegment.evidence_kind} · {formatMilliseconds(activeReplaySegment.start_ms)} - {formatMilliseconds(activeReplaySegment.end_ms)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Overlay Signals</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Gaze: {activeGazeWindow ? `${activeGazeWindow.event_type} (${formatDurationMs(activeGazeWindow.duration_ms)})` : "No active gaze flag"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Confidence: {metrics.score_trust_level || replayData.score_trust_level} · {confidenceScore ?? replayData?.confidence_annotations?.[0]?.confidence_score ?? "n/a"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Provider: {replayData?.provider_trace?.provider || "n/a"} {replayData?.provider_trace?.failover_used ? "(failover used)" : ""}
                    </Typography>
                    {nearbyFillerMarkers.length > 0 && nearbyFillerMarkers.map((marker, index) => (
                      <Typography key={`marker-${index}`} variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Filler marker: {marker.filler_word_count} fillers / 100w={marker.filler_words_per_100} at {formatMilliseconds(marker.time_ms)}
                      </Typography>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {(Object.keys(handoffSummary).length > 0 || Object.keys(memorySummary).length > 0) && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              Round Continuity
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Trusted carry-forward memory and agent ownership used to keep later rounds consistent.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Agent Handoff</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Owner: {handoffSummary.agent_owner || "orchestrator"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Round: {handoffSummary.round_index ?? "n/a"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Strategy: {handoffSummary.speaker_strategy || "n/a"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Carry-Forward Memory</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Skills demonstrated: {(memorySummary.skills_demonstrated || []).join(", ") || "n/a"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Weak areas: {(memorySummary.weak_areas || []).join(", ") || "n/a"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Unresolved follow-up: {(memorySummary.unresolved_follow_ups || [])[0] || "n/a"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
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
          {(captureIntegrity.trusted_candidate_turn_count > 0 || captureIntegrity.fallback_candidate_turn_count > 0) && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Trusted candidate turns: <strong>{captureIntegrity.trusted_candidate_turn_count ?? 0}</strong>
              {" · "}
              Fallback candidate turns: <strong>{captureIntegrity.fallback_candidate_turn_count ?? 0}</strong>
              {" · "}
              Score trust: <strong>{scoreTrustLevel}</strong>
            </Typography>
          )}
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
            Communication Signals
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pacing and filler metrics are derived from trusted candidate transcript only.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={3}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Confidence Score</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {confidenceScore != null ? confidenceScore : "—"}
                </Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Pacing Band</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, textTransform: "capitalize" }}>
                  {communicationSignals.pacing_band || "unknown"}
                </Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Filler Words</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {communicationSignals.filler_word_count ?? "—"}
                </Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card variant="outlined"><CardContent>
                <Typography variant="caption" color="text.secondary">Fillers / 100 Words</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {communicationSignals.filler_words_per_100 ?? "—"}
                </Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          {Array.isArray(communicationSignals.quality_flags) && communicationSignals.quality_flags.length > 0 ? (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {communicationSignals.quality_flags.map((flag) => (
                <Chip key={flag} size="small" label={flag} color="warning" variant="outlined" />
              ))}
            </Box>
          ) : (
            <Alert severity="success">No pacing or filler-risk flags were raised from the trusted transcript.</Alert>
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
