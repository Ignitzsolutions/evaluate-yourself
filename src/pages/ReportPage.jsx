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

function formatGazeFlagLabel(flag = "") {
  const normalized = String(flag || "").trim().toUpperCase();
  const mapping = {
    OFF_SCREEN: "Looking Away",
    LOOKING_DOWN: "Looking Down",
    LOOKING_UP: "Looking Up",
    FACE_NOT_VISIBLE: "Face Not Visible",
  };
  return mapping[normalized] || String(flag || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const reportSurfaceSx = {
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 4,
  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,247,240,0.98) 100%)",
  boxShadow: "0 22px 60px rgba(15, 23, 42, 0.08)",
};

const reportPanelSx = {
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 3,
  backgroundColor: "rgba(255,255,255,0.92)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
};

const reportMetricCardSx = {
  ...reportPanelSx,
  height: "100%",
  background: "linear-gradient(180deg, #ffffff 0%, #f8f5ef 100%)",
};

export default function ReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();
  const { sessionId } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [enrichmentPending, setEnrichmentPending] = useState(false);

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
      setError("No report session was provided.");
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
      setEnrichmentPending(data?.enrichment_status === "pending");

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

  // Poll for v2 enrichment completion when status is pending
  useEffect(() => {
    if (!enrichmentPending || !sessionId) return;
    const poll = async () => {
      try {
        const token = await getToken();
        const res = await authFetch(`${API_BASE_URL}/api/interview/reports/${sessionId}`, token, {});
        if (res.ok) {
          const data = await res.json();
          if (data?.enrichment_status !== "pending") {
            setReport(data);
            setEnrichmentPending(false);
          }
        }
      } catch (_) { /* silent */ }
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [enrichmentPending, sessionId, getToken]);

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
  const effectiveGazeSummary = metrics.gaze_summary && typeof metrics.gaze_summary === "object"
    ? metrics.gaze_summary
    : (gazeSummary && typeof gazeSummary === "object" ? gazeSummary : null);
  const gazeFlagsByType = useMemo(() => (
    metrics.gaze_flags_by_type && typeof metrics.gaze_flags_by_type === "object"
      ? metrics.gaze_flags_by_type
      : (gazeSummary?.events_by_type || {})
  ), [gazeSummary?.events_by_type, metrics.gaze_flags_by_type]);
  const gazeFlagsCount = typeof metrics.gaze_flags_count === "number"
    ? metrics.gaze_flags_count
    : (typeof gazeSummary?.total_events === "number" ? gazeSummary.total_events : gazeEvents.length);
  const gazeLongestAwayMs = typeof metrics.gaze_longest_away_ms === "number"
    ? metrics.gaze_longest_away_ms
    : (typeof gazeSummary?.longest_event_ms === "number" ? gazeSummary.longest_event_ms : 0);
  const captureStatus = typeof metrics.capture_status === "string" ? metrics.capture_status : "COMPLETE";
  const isIncompleteCapture = captureStatus === "INCOMPLETE_NO_CANDIDATE_AUDIO";
  const isPartialCapture = captureStatus === "INCOMPLETE_PARTIAL_CAPTURE";
  const avgWordsPerTurn = report?.turn_analyses?.length > 0
    ? Math.round((metrics.candidate_word_count || 0) / report.turn_analyses.length)
    : 0;
  const isLowCaptureQuality = (metrics.candidate_word_count || 0) < 80 || avgWordsPerTurn < 12;

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
  const evaluationExplainability = metrics.evaluation_explainability && typeof metrics.evaluation_explainability === "object"
    ? metrics.evaluation_explainability
    : null;
  const contractPassed = typeof metrics.contract_passed === "boolean"
    ? metrics.contract_passed
    : true;
  const validationFlags = Array.isArray(metrics.validation_flags) ? metrics.validation_flags : [];
  const scoreProvenance = metrics.score_provenance && typeof metrics.score_provenance === "object"
    ? metrics.score_provenance
    : {};
  const scoreLedger = Array.isArray(metrics.score_ledger) ? metrics.score_ledger : [];
  const scoreReconciliation = metrics.score_reconciliation && typeof metrics.score_reconciliation === "object"
    ? metrics.score_reconciliation
    : null;
  const validationSummary = report?.validation_summary && typeof report.validation_summary === "object"
    ? report.validation_summary
    : (metrics.validation_summary && typeof metrics.validation_summary === "object" ? metrics.validation_summary : null);
  const reportState = typeof report?.report_state === "string"
    ? report.report_state
    : (isIncompleteCapture ? "invalid_no_candidate_audio_report" : isPartialCapture ? "partial_low_confidence_report" : "valid_scored_report");
  const planTier = typeof metrics.plan_tier === "string" && metrics.plan_tier.trim()
    ? metrics.plan_tier.trim().toLowerCase()
    : "trial";
  const isTrialPlan = Boolean(metrics.trial_mode) || planTier === "trial";
  const isInvalidReport = reportState === "invalid_no_candidate_audio_report";
  const isPartialLowConfidenceReport = reportState === "partial_low_confidence_report";
  const showDetailedEvaluationSections = !isInvalidReport && !isTrialPlan;
  const contractWarningFromState = location.state?.contractWarning;
  const forcedZeroReason = scoreProvenance.forced_zero_reason || evaluationExplainability?.forced_zero_reason || null;
  const shouldShowForcedZero = Number(report?.overall_score || 0) === 0 && (
    Boolean(forcedZeroReason) || !contractPassed || isInvalidReport
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

  const benchmarkLabel = useMemo(() => {
    if (isInvalidReport) return "Unavailable";
    if (isPartialLowConfidenceReport) return "Provisional";
    if (isTrialPlan) return "Trial";
    const overall = Number(report?.overall_score || 0);
    if (overall >= 85) return "Elite";
    if (overall >= 75) return "Strong";
    if (overall >= 60) return "Competitive";
    if (overall >= 45) return "Developing";
    return "At Risk";
  }, [isInvalidReport, isPartialLowConfidenceReport, isTrialPlan, report?.overall_score]);

  const benchmarkNarrative = useMemo(() => {
    if (isInvalidReport) {
      return "This session is invalid for a scored evaluation because candidate evidence was not captured. The report is limited to operational diagnostics and remediation steps.";
    }
    if (isPartialLowConfidenceReport) {
      return "This assessment is provisional. The session captured only partial or low-confidence evidence, so any score should be treated as directional rather than decision-grade.";
    }
    if (isTrialPlan) {
      return "This was a short trial interview. Use it to understand baseline strengths, the biggest risks, and the next few fixes. Upgrade for full-length interviews and deeper evidence-led evaluation.";
    }
    const overall = Number(report?.overall_score || 0);
    if (shouldShowForcedZero) {
      return "The score is intentionally suppressed because the captured evidence did not meet the standard required for a reliable interview assessment.";
    }
    if (overall >= 85) return "This performance sits in the top band: clear, credible, and backed by evidence that would stand up in a serious hiring conversation.";
    if (overall >= 75) return "This was a strong interview with a hire-ready profile, though a few answers still leave room for sharper execution.";
    if (overall >= 60) return "The interview was competitive, but the evidence was uneven. A stronger close on impact and ownership would materially improve the signal.";
    if (overall >= 45) return "There were some credible moments, but the interview did not sustain enough high-quality evidence to feel consistently convincing.";
    return "The current performance is below a dependable hire-ready threshold and needs targeted rebuilding before a high-stakes interview.";
  }, [isInvalidReport, isPartialLowConfidenceReport, isTrialPlan, report?.overall_score, shouldShowForcedZero]);

  const executiveStrengths = useMemo(() => {
    const items = [];
    const pushUnique = (value) => {
      const text = String(value || "").trim();
      if (!text || items.includes(text)) return;
      items.push(text);
    };

    (report?.hiring_recommendation?.green_flags || []).forEach(pushUnique);
    (report?.ai_feedback?.strengths || []).forEach(pushUnique);

    if (report?.competency_scores && typeof report.competency_scores === "object") {
      Object.entries(report.competency_scores)
        .filter(([, score]) => typeof score === "number")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .forEach(([key, score]) => {
          pushUnique(`${String(key).replace(/_/g, " ")} scored ${score}/100 and stands out as a repeatable strength.`);
        });
    }

    return items.slice(0, 3);
  }, [report]);

  const executiveRisks = useMemo(() => {
    const items = [];
    const pushUnique = (value) => {
      const text = String(value || "").trim();
      if (!text || items.includes(text)) return;
      items.push(text);
    };

    (validationSummary?.top_risks || []).forEach(pushUnique);
    (report?.hiring_recommendation?.red_flags || []).forEach(pushUnique);
    (report?.improvement_roadmap || []).slice(0, 3).forEach((item) => pushUnique(item.finding));

    return items.slice(0, 3);
  }, [report, validationSummary]);
  const gazeBehaviorSummary = useMemo(() => {
    const flags = gazeFlagsByType && typeof gazeFlagsByType === "object" ? gazeFlagsByType : {};
    const lines = [];
    if (Number(flags.LOOKING_DOWN || 0) > 0) {
      lines.push(`Looking down was detected ${flags.LOOKING_DOWN} time(s).`);
    }
    if (Number(flags.OFF_SCREEN || 0) > 0) {
      lines.push(`Looking away from screen was detected ${flags.OFF_SCREEN} time(s).`);
    }
    if (Number(flags.FACE_NOT_VISIBLE || 0) > 0) {
      lines.push(`Face loss was detected ${flags.FACE_NOT_VISIBLE} time(s).`);
    }
    if (eyeContactPct != null) {
      lines.push(`Observed on-screen eye contact measured ${Number(eyeContactPct).toFixed(1)}%.`);
    }
    return lines;
  }, [gazeFlagsByType, eyeContactPct]);

  const premiumActionPlan = useMemo(() => {
    const roadmap = Array.isArray(report?.improvement_roadmap) ? report.improvement_roadmap : [];
    return roadmap.slice(0, 3).map((item, idx) => ({
      ...item,
      priorityLabel: idx === 0 ? "Immediate" : idx === 1 ? "Next" : "Then",
      impactLabel: idx === 0 ? "High impact" : idx === 1 ? "Medium impact" : "Targeted improvement",
    }));
  }, [report?.improvement_roadmap]);
  const remediationSteps = useMemo(() => {
    if (Array.isArray(report?.ai_feedback?.areas_for_improvement) && report.ai_feedback.areas_for_improvement.length > 0) {
      return report.ai_feedback.areas_for_improvement.slice(0, 4);
    }
    if (Array.isArray(report?.recommendations) && report.recommendations.length > 0) {
      return report.recommendations.slice(0, 4);
    }
    return [
      "Verify microphone permissions and the active input device.",
      "Confirm candidate speech appears in the live transcript before continuing.",
      "Re-run the interview only after audio capture and transcript visibility are stable.",
    ];
  }, [report]);
  const gazeReliable = Boolean(effectiveGazeSummary?.calibration_valid) && String(effectiveGazeSummary?.calibration_state || "").toLowerCase() === "complete";
  const gazeReliabilityNote = gazeReliable
    ? null
    : "Gaze observations were captured, but calibration quality was not strong enough to turn them into prescriptive coaching for this session.";
  const showPremiumEvaluationSections = !isInvalidReport;
  const showRecommendationBadge = showDetailedEvaluationSections && !isPartialLowConfidenceReport && report?.hiring_recommendation;
  const scoreWeightChips = useMemo(() => {
    if (!evaluationExplainability?.weights || typeof evaluationExplainability.weights !== "object") {
      return [];
    }
    return Object.entries(evaluationExplainability.weights)
      .filter(([, value]) => typeof value === "number")
      .map(([key, value]) => ({
        key,
        label: `${String(key).replace(/_/g, " ")} ${Math.round(value * 100)}%`,
      }));
  }, [evaluationExplainability?.weights]);

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
    setDownloadError("");
    try {
      const token = await getToken();
      const resp = await authFetch(`${API_BASE_URL}/api/interview/reports/${sessionId}/artifact?format=html`, token);
      if (!resp.ok) {
        throw new Error(`Unable to open printable report (${resp.status})`);
      }
      const html = await resp.text();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        window.URL.revokeObjectURL(url);
        throw new Error("Popup blocked while opening the printable report.");
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setDownloadError(e.message || "Unable to open the printable report.");
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
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        pb: { xs: 4, md: 6 },
        maxWidth: 1240,
        mx: "auto",
        background:
          "radial-gradient(circle at top left, rgba(214, 176, 108, 0.10), transparent 32%), linear-gradient(180deg, #f7f3eb 0%, #fdfcf9 28%, #ffffff 100%)",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, mb: 3, flexWrap: "wrap", gap: 1.5 }}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 2.4, color: "text.secondary", fontWeight: 700 }}>
            {isTrialPlan ? "Trial Interview Report" : "Ignitz Interview Dossier"}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: "1.95rem", md: "2.4rem" } }}>
            Interview Assessment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isTrialPlan
              ? "Short-form interview feedback with clear next steps. Upgrade for deeper evidence-led analysis and full-length interviews."
              : "Decision-grade evaluation with evidence quality, scoring proof, and targeted coaching priorities."}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<Download />} onClick={handleDownload} disabled={downloadLoading}>
            {downloadLoading ? "Preparing..." : "Open Printable Report"}
          </Button>
          <Button variant="contained" startIcon={<PlayArrow />} onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </Box>
      </Box>

      {downloadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {downloadError}
        </Alert>
      )}

      {isInvalidReport && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Session invalid for scored evaluation.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Candidate speech was not captured with enough evidence to score this session. Use the remediation steps below, then re-run the interview.
          </Typography>
        </Alert>
      )}
      {isPartialLowConfidenceReport && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Evaluation provisional: low-confidence session.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This report reflects partial or low-confidence evidence only. Treat it as directional, not decision-grade.
          </Typography>
        </Alert>
      )}
      {showPremiumEvaluationSections && !isPartialLowConfidenceReport && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Evaluation complete: candidate responses were captured and analyzed.
          </Typography>
        </Alert>
      )}

      {isTrialPlan && !isInvalidReport && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Trial interview report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This report covers the baseline score, summary, main strengths, main risks, and a short action plan. Upgrade for full-length interviews, richer evidence-led feedback, and the complete report ledger.
          </Typography>
        </Alert>
      )}

      {/* ── Enrichment pending banner ────────────────────────────────────── */}
      {enrichmentPending && (
        <Alert severity="info" icon={<CircularProgress size={16} />} sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Generating detailed analysis… this takes a few seconds.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hiring recommendation, per-question breakdown, and improvement roadmap will appear shortly.
          </Typography>
        </Alert>
      )}

      {/* ── Hiring Recommendation Badge ─────────────────────────────────── */}
      {showRecommendationBadge && (() => {
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

      <Card sx={{ ...reportSurfaceSx, mb: 3, overflow: "hidden" }}>
        <CardContent>
          <Grid container spacing={2.5} alignItems="stretch">
            <Grid item xs={12} md={7}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Executive Assessment
              </Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                <Chip
                  label={`Benchmark: ${benchmarkLabel}`}
                  color={isInvalidReport ? "default" : Number(report?.overall_score || 0) >= 75 ? "success" : Number(report?.overall_score || 0) >= 60 ? "warning" : "error"}
                />
                {showRecommendationBadge && report?.hiring_recommendation?.label && (
                  <Chip label={report.hiring_recommendation.label} variant="outlined" color="primary" />
                )}
                {validationSummary?.validity_label && (
                  <Chip
                    label={`Validity: ${String(validationSummary.validity_label).replace(/^./, (c) => c.toUpperCase())}`}
                    variant="outlined"
                    color={validationSummary.validity_label === "high" ? "success" : validationSummary.validity_label === "moderate" ? "warning" : "error"}
                  />
                )}
              </Box>
              <Typography variant="body1" sx={{ mb: 1.5 }}>
                {benchmarkNarrative}
              </Typography>
              {report?.score_context && showDetailedEvaluationSections && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {report.score_context}
                </Typography>
              )}
              {report?.ai_feedback?.overall_summary && (
                <Alert severity="info" icon={false} sx={{ py: 0.75 }}>
                  <Typography variant="body2">{report.ai_feedback.overall_summary}</Typography>
                </Alert>
              )}
              {isInvalidReport && (
                <Alert severity="error" icon={false} sx={{ py: 0.75 }}>
                  <Typography variant="body2">
                    Insufficient candidate evidence was captured. No benchmark comparison or hiring recommendation should be inferred from this artifact.
                  </Typography>
                </Alert>
              )}
            </Grid>
            <Grid item xs={12} md={5}>
              <Card variant="outlined" sx={{ ...reportPanelSx, height: "100%", background: "linear-gradient(180deg, #101828 0%, #172131 100%)", color: "#f8fafc" }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.25 }}>
                    Score Validity
                  </Typography>
                  <Box sx={{ display: "grid", gap: 1 }}>
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "rgba(248,250,252,0.88)" }}>Validity Score</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "#ffffff" }}>
                          {validationSummary?.validity_score ?? "--"}/100
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={validationSummary?.validity_score ?? 0}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "action.hover",
                          "& .MuiLinearProgress-bar": {
                            borderRadius: 4,
                            backgroundColor:
                              validationSummary?.validity_label === "high"
                                ? "#2e7d32"
                                : validationSummary?.validity_label === "moderate"
                                  ? "#ed6c02"
                                  : "#d32f2f",
                          },
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: "rgba(248,250,252,0.72)" }}>
                      Source: {String(scoreProvenance.source || evaluationExplainability?.source || "unknown").replace(/_/g, " ")}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(248,250,252,0.72)" }}>
                      Confidence: {String(scoreProvenance.confidence || evaluationExplainability?.confidence || "unknown").replace(/^./, (c) => c.toUpperCase())}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(248,250,252,0.72)" }}>
                      Capture status: {captureStatus.replace(/_/g, " ")}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(248,250,252,0.72)" }}>
                      Evaluated turns: {validationSummary?.evidence_stats?.turns_evaluated ?? metrics?.turn_eval_summary?.turn_count ?? 0}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {showPremiumEvaluationSections && (executiveStrengths.length > 0 || executiveRisks.length > 0) && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ ...reportPanelSx, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                  Top Strengths
                </Typography>
                {executiveStrengths.length > 0 ? executiveStrengths.map((item, idx) => (
                  <Typography key={`${item}-${idx}`} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    • {item}
                  </Typography>
                )) : (
                  <Typography variant="body2" color="text.secondary">
                    No clear strengths were extracted from this session.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ ...reportPanelSx, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                  Top Risks
                </Typography>
                {executiveRisks.length > 0 ? executiveRisks.map((item, idx) => (
                  <Typography key={`${item}-${idx}`} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    • {item}
                  </Typography>
                )) : (
                  <Typography variant="body2" color="text.secondary">
                    No major risks were detected in the captured evidence.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {showDetailedEvaluationSections && validationSummary?.trust_signals?.length > 0 && (
        <Card sx={{ ...reportPanelSx, mb: 3, background: "linear-gradient(180deg, #fffaf0 0%, #ffffff 100%)" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
              Why This Score Is Trustworthy
            </Typography>
            {validationSummary.trust_signals.map((signal, idx) => (
              <Typography key={`${signal}-${idx}`} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • {signal}
              </Typography>
            ))}
          </CardContent>
        </Card>
      )}

      {showDetailedEvaluationSections && (evaluationExplainability?.formula || scoreLedger.length > 0) && (
        <Card sx={{ ...reportSurfaceSx, mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
              Scoring Evidence Ledger
            </Typography>
            {evaluationExplainability?.formula && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {evaluationExplainability.formula}
              </Typography>
            )}
            {scoreWeightChips.length > 0 && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                {scoreWeightChips.map((item) => (
                  <Chip key={item.key} size="small" label={item.label} variant="outlined" />
                ))}
              </Box>
            )}
            {scoreLedger.length > 0 ? (
              <Box sx={{ display: "grid", gap: 1.5 }}>
                {scoreReconciliation && (
                  <Alert severity={scoreReconciliation.score_delta === 0 ? "info" : "warning"} sx={{ mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Base score {scoreReconciliation.base_overall_score}/100
                      {" → "}
                      final score {scoreReconciliation.final_overall_score}/100
                    </Typography>
                    {(scoreReconciliation.score_cap_reason || scoreReconciliation.forced_zero_reason) && (
                      <Typography variant="body2" color="text.secondary">
                        Adjustment reason: {String(scoreReconciliation.forced_zero_reason || scoreReconciliation.score_cap_reason).replace(/_/g, " ")}
                      </Typography>
                    )}
                  </Alert>
                )}
                {scoreLedger.map((row) => (
                  <Card
                    key={row.transcript_ref || row.turn_id}
                    variant="outlined"
                    sx={{
                      ...reportPanelSx,
                      background: row.included_in_score
                        ? "linear-gradient(180deg, #ffffff 0%, #f8fbf8 100%)"
                        : "linear-gradient(180deg, #ffffff 0%, #fbf7f2 100%)",
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap", mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {row.transcript_ref_label || `Turn ${row.turn_id}`}
                        </Typography>
                        <Chip
                          size="small"
                          color={row.included_in_score ? "success" : "default"}
                          variant={row.included_in_score ? "filled" : "outlined"}
                          label={row.included_in_score ? `Included • ${row.weighted_points}/100` : `Excluded • ${String(row.exclusion_reason || "not evaluated").replace(/_/g, " ")}`}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                        {row.question_text || "Question unavailable"}
                      </Typography>
                      {row.answer_excerpt && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                          Candidate excerpt: {row.answer_excerpt}
                        </Typography>
                      )}
                      {row.evidence_quote && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          “{row.evidence_quote}”
                        </Typography>
                      )}
                      {row.exclusion_detail && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {row.exclusion_detail}
                        </Typography>
                      )}
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        {row.dimension_scores && Object.entries(row.dimension_scores).map(([key, value]) => (
                          <Chip
                            key={`${row.turn_id}-${key}`}
                            size="small"
                            variant="outlined"
                            label={`${String(key).replace(/_/g, " ")}: ${typeof value === "number" ? value.toFixed(1) : "n/a"}`}
                          />
                        ))}
                        <Chip size="small" variant="outlined" label={`Words: ${row.answer_word_count || 0}`} />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No scored-turn ledger was available for this session.
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {isInvalidReport && (
        <Card sx={{ ...reportPanelSx, mb: 3, borderColor: "error.light", backgroundColor: "#fff8f7" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
              Remediation Steps
            </Typography>
            {remediationSteps.map((step, idx) => (
              <Typography key={`${step}-${idx}`} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {idx + 1}. {step}
              </Typography>
            ))}
          </CardContent>
        </Card>
      )}

      <Card sx={{ ...reportPanelSx, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            Gaze and Presence
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Observational only. Gaze telemetry is excluded from the final score for launch.
          </Typography>
          {gazeReliabilityNote ? (
            <Alert severity="info" icon={false} sx={{ mb: 2, py: 0.75 }}>
              <Typography variant="body2">{gazeReliabilityNote}</Typography>
            </Alert>
          ) : null}
          {gazeReliable && gazeBehaviorSummary.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {gazeBehaviorSummary.map((line, idx) => (
                <Typography key={`${line}-${idx}`} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • {line}
                </Typography>
              ))}
            </Box>
          )}

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={reportMetricCardSx}><CardContent>
                <Typography variant="caption" color="text.secondary">Flags Captured</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{gazeFlagsCount}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={reportMetricCardSx}><CardContent>
                <Typography variant="caption" color="text.secondary">Longest Event</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatDurationMs(gazeLongestAwayMs)}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={reportMetricCardSx}><CardContent>
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
                <Chip key={key} size="small" label={`${formatGazeFlagLabel(key)}: ${value}`} variant="outlined" />
              ))
            ) : (
              <Chip size="small" label="No gaze flags captured" color="success" variant="outlined" />
            )}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ ...reportPanelSx, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Interview Statistics
            </Typography>
            {report?.type && <Chip size="small" label={formatInterviewTypeLabel(report.type)} color="primary" variant="outlined" />}
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={reportMetricCardSx}><CardContent>
                <AccessTime color="primary" />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalDuration} min</Typography>
                <Typography variant="caption" color="text.secondary">Duration</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={reportMetricCardSx}><CardContent>
                <QuestionAnswer color="error" />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{questionsAnswered}</Typography>
                <Typography variant="caption" color="text.secondary">Questions Answered</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={reportMetricCardSx}><CardContent>
                <Chat color="success" />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalWords}</Typography>
                <Typography variant="caption" color="text.secondary">Total Words</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={reportMetricCardSx}><CardContent>
                <Speed sx={{ color: "warning.main" }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{wordsPerMinute}</Typography>
                <Typography variant="caption" color="text.secondary">Words / Min</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={reportMetricCardSx}><CardContent>
                <Assessment sx={{ color: "info.main" }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {avgResponseSeconds != null ? `${avgResponseSeconds}s` : "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary">Avg Response Time</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={reportMetricCardSx}><CardContent>
                <Visibility sx={{ color: eyeContactPct != null ? "success.main" : "text.secondary" }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {eyeContactPct != null ? `${eyeContactPct}%` : "Not Captured"}
                </Typography>
                <Typography variant="caption" color="text.secondary">Gaze Observation</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {showDetailedEvaluationSections && scores && (
        <Card sx={{ ...reportPanelSx, mb: 3 }}>
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
      {report?.competency_scores && showDetailedEvaluationSections && (() => {
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

      {/* ── Per-Question Analysis ───────────────────────────────────────── */}
      {report?.turn_analyses?.length > 0 && showDetailedEvaluationSections && isLowCaptureQuality && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Analysis Quality Limited
          </Typography>
          <Typography variant="body2">
            Not enough candidate speech was captured to generate a reliable per-question analysis 
            (only {metrics.candidate_word_count || 0} words recorded). This can happen when audio 
            echo or background noise is captured instead of your voice. Try completing a new session 
            with headphones for more accurate results.
          </Typography>
        </Alert>
      )}
      {report?.turn_analyses?.length > 0 && showDetailedEvaluationSections && !isLowCaptureQuality && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Per-Question Analysis</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Each answer evaluated for competency, STAR structure, and evidence of impact.
            </Typography>
            {report.turn_analyses.map((turn, idx) => {
              const star = turn.star_breakdown || {};
              const starKeys = ["situation", "task", "action", "result"];
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
      {premiumActionPlan.length > 0 && showPremiumEvaluationSections && (
        <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {isTrialPlan ? "Action Plan" : "Coaching Priorities"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {isTrialPlan
                ? "The shortest path to a stronger next interview."
                : "Prioritized actions designed to move the score materially in the next interview."}
            </Typography>
            <Box sx={{ display: "grid", gap: 2 }}>
              {premiumActionPlan.map((item, idx) => (
                <Card key={idx} variant="outlined" sx={{ borderLeft: "4px solid", borderLeftColor: "warning.main" }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                      <Chip size="small" label={item.competency?.replace(/_/g, " ")} color="warning" variant="outlined" />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.priorityLabel}</Typography>
                      <Chip size="small" label={item.impactLabel} variant="outlined" />
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

      {showDetailedEvaluationSections && report?.ai_feedback && (
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
