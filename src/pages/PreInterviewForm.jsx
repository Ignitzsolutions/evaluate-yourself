import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { authFetch, buildApiErrorFromResponse, getApiErrorMessage } from "../utils/apiClient";
import { getApiBaseUrl } from "../utils/apiBaseUrl";
import { formatInterviewTypeLabel } from "../utils/interviewTypeLabels";
import {
  buildInterviewConfig,
  isInterviewFreeAccessMode,
  readSavedInterviewConfig,
  saveInterviewConfig,
} from "../utils/accessMode";

const FREE_ACCESS_MODE = isInterviewFreeAccessMode();
const API_BASE = getApiBaseUrl();
const INTERVIEW_TYPES_REQUIRING_SKILLS = new Set(["technical", "mixed"]);

export default function PreInterviewForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();

  const [selectedType, setSelectedType] = useState(location.state?.type || "technical");

  const durationOptions = useMemo(() => [10, 15, 20, 30, 45, 60], []);
  const [duration, setDuration] = useState(durationOptions[0]);
  const [difficulty, setDifficulty] = useState("easy");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [questionMix, setQuestionMix] = useState("balanced");
  const [interviewStyle, setInterviewStyle] = useState("neutral");
  const [transcriptConsent, setTranscriptConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [skillCatalog, setSkillCatalog] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [skillError, setSkillError] = useState("");
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillRetryTick, setSkillRetryTick] = useState(0);
  const requiresSkillCatalog = INTERVIEW_TYPES_REQUIRING_SKILLS.has(selectedType);

  useEffect(() => {
    const locationType = location.state?.type;
    const locationRecoveryMessage = location.state?.recoveryMessage;
    if (locationType) {
      setSelectedType(locationType);
    }
    if (locationRecoveryMessage) {
      setRecoveryMessage(locationRecoveryMessage);
    }

    const savedConfig = readSavedInterviewConfig(sessionStorage);
    if (!savedConfig.valid) {
      return;
    }
    const parsed = savedConfig.config;
    setSelectedType(locationType || parsed.type || "technical");
    setDuration(Number(parsed.duration) || durationOptions[0]);
    setDifficulty(parsed.difficulty || "easy");
    setRole(parsed.role || "");
    setCompany(parsed.company || "");
    setQuestionMix(parsed.questionMix || "balanced");
    setInterviewStyle(parsed.interviewStyle || "neutral");
    setTranscriptConsent(Boolean(parsed.transcriptConsent));
    setSelectedSkills(Array.isArray(parsed.selectedSkills) ? parsed.selectedSkills : []);
  }, [durationOptions, location.state?.recoveryMessage, location.state?.type]);

  useEffect(() => {
    let mounted = true;
    if (!requiresSkillCatalog) {
      setSkillCatalog(null);
      setSelectedSkills([]);
      setSkillError("");
      setSkillLoading(false);
      return () => {
        mounted = false;
      };
    }
    const loadSkillCatalog = async () => {
      setSkillLoading(true);
      setSkillError("");
      try {
        const token = await getToken();
        const resp = await authFetch(
          `${API_BASE}/api/interview/skill-catalog?interview_type=${encodeURIComponent(selectedType)}`,
          token,
          { method: "GET" }
        );
        if (!resp.ok) {
          throw await buildApiErrorFromResponse(resp, {
            defaultMessage: "Failed to load stream catalog",
          });
        }
        const data = await resp.json();
        if (!mounted) return;
        setSkillCatalog(data);
        setSelectedSkills((prev) => (
          prev.length > 0
            ? prev
            : Array.isArray(data?.suggested_defaults) ? data.suggested_defaults : []
        ));
      } catch (err) {
        if (!mounted) return;
        setSkillCatalog(null);
        setSelectedSkills([]);
        setSkillError(getApiErrorMessage(err, {
          backendLabel: "stream catalog service",
          defaultMessage: "Could not load stream catalog.",
        }));
      } finally {
        if (mounted) setSkillLoading(false);
      }
    };
    loadSkillCatalog();
    return () => {
      mounted = false;
    };
  }, [getToken, requiresSkillCatalog, selectedType, skillRetryTick]);

  const toggleSkill = (skillId) => {
    setSkillError("");
    setSelectedSkills((prev) => {
      const exists = prev.includes(skillId);
      if (exists) return prev.filter((id) => id !== skillId);
      const maxAllowed = Number(skillCatalog?.selection_rules?.max || 0);
      if (maxAllowed > 0 && prev.length >= maxAllowed) {
        return [...prev.slice(1), skillId];
      }
      return [...prev, skillId];
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!transcriptConsent) {
      setConsentError(true);
      return;
    }
    if (!skillCatalog && requiresSkillCatalog) {
      setSkillError("Stream catalog is required before starting. Retry loading the catalog and try again.");
      return;
    }
    if (skillCatalog?.selection_rules) {
      const min = Number(skillCatalog.selection_rules.min || 0);
      const max = Number(skillCatalog.selection_rules.max || 0);
      if (selectedSkills.length < min || selectedSkills.length > max) {
      setSkillError(`Select ${min === max ? `${min}` : `${min}-${max}`} stream(s) before starting.`);
        return;
      }
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const config = buildInterviewConfig({
      type: selectedType,
      duration,
      difficulty,
      role: role.trim() || undefined,
      company: company.trim() || undefined,
      questionMix,
      interviewStyle,
      transcriptConsent,
      selectedSkills,
    });

    saveInterviewConfig(config, sessionStorage);
    navigate(`/interview/session/${sessionId}`);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 3, md: 6 },
        px: { xs: 2, md: 4 },
        background:
          "radial-gradient(900px 380px at 0% 0%, rgba(0,86,179,0.10), transparent 60%), radial-gradient(700px 320px at 100% 20%, rgba(230,57,70,0.08), transparent 60%), #f8f9fa",
      }}
    >
      <Card
        sx={{
          maxWidth: 980,
          mx: "auto",
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 18px 60px rgba(0, 59, 122, 0.12)",
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 5 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 4 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {FREE_ACCESS_MODE ? "Sonia Demo Setup" : "Interview Configuration"}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {FREE_ACCESS_MODE
                  ? "Quick setup for a live Sonia beta demo. Confirm the basics, then join the interview immediately."
                  : "Quick setup for a focused, production-ready session."}
              </Typography>
              <Chip label={`Type: ${formatInterviewTypeLabel(selectedType)}`} size="small" color="primary" sx={{ mt: 1.5 }} />
            </Box>
            <Button variant="outlined" onClick={() => navigate("/interviews")}>
              Back to Selection
            </Button>
          </Stack>

          <Box component="form" onSubmit={handleSubmit}>
            {FREE_ACCESS_MODE && (
              <Alert severity="info" sx={{ mb: 2.5 }}>
                Free access is active for the hosted beta demo. Start Sonia directly from this screen without redeeming a trial code.
              </Alert>
            )}
            {recoveryMessage && (
              <Alert severity="warning" sx={{ mb: 2.5 }}>
                {recoveryMessage}
              </Alert>
            )}
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="duration-label">Duration</InputLabel>
                  <Select labelId="duration-label" label="Duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    {durationOptions.map((mins) => (
                      <MenuItem key={mins} value={mins}>{mins} minutes</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="difficulty-label">Difficulty</InputLabel>
                  <Select labelId="difficulty-label" label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    <MenuItem value="easy">Easy</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="hard">Hard</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Target Role"
                  placeholder="e.g., Backend Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Target Company"
                  placeholder="e.g., Microsoft"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="focus-label">Question Focus</InputLabel>
                  <Select labelId="focus-label" label="Question Focus" value={questionMix} onChange={(e) => setQuestionMix(e.target.value)}>
                    <MenuItem value="technical">Technical</MenuItem>
                    <MenuItem value="balanced">Balanced</MenuItem>
                    <MenuItem value="behavioral">Behavioral</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="style-label">Interview Style</InputLabel>
                  <Select labelId="style-label" label="Interview Style" value={interviewStyle} onChange={(e) => setInterviewStyle(e.target.value)}>
                    <MenuItem value="friendly">Friendly</MenuItem>
                    <MenuItem value="neutral">Neutral</MenuItem>
                    <MenuItem value="strict">Strict</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {requiresSkillCatalog && (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "background.paper",
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.8 }}>
                      Stream Selection
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.4 }}>
                      {skillCatalog?.mixed_rule ||
                        `Select ${skillCatalog?.selection_rules?.min ?? 0}${skillCatalog?.selection_rules?.min === skillCatalog?.selection_rules?.max ? "" : `-${skillCatalog?.selection_rules?.max ?? 0}`} stream(s).`}
                    </Typography>
                    {skillLoading && (
                      <Typography variant="body2" color="text.secondary">
                        Loading interview streams...
                      </Typography>
                    )}
                    {!skillLoading && Array.isArray(skillCatalog?.tracks) && (
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {skillCatalog.tracks.map((track) => {
                          const selected = selectedSkills.includes(track.id);
                          return (
                            <Chip
                              key={track.id}
                              label={track.label}
                              clickable
                              color={selected ? "primary" : "default"}
                              variant={selected ? "filled" : "outlined"}
                              onClick={() => toggleSkill(track.id)}
                              sx={{ borderRadius: "10px", mb: 0.5 }}
                            />
                          );
                        })}
                      </Stack>
                    )}
                    {skillError && (
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                        <Typography variant="caption" color="error">
                          {skillError}
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setSkillRetryTick((prev) => prev + 1)}
                          disabled={skillLoading}
                        >
                          Retry catalog
                        </Button>
                      </Stack>
                    )}
                  </Box>
                </Grid>
              )}

              <Grid item xs={12}>
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: consentError ? "error.main" : "divider",
                    bgcolor: consentError ? "rgba(211,47,47,0.04)" : "background.paper",
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={transcriptConsent}
                        onChange={(e) => {
                          setTranscriptConsent(e.target.checked);
                          if (e.target.checked) {
                            setConsentError(false);
                          }
                        }}
                      />
                    }
                    label="I consent to session transcript storage for analysis and feedback."
                  />
                  {consentError && (
                    <Typography variant="caption" color="error">
                      Consent is required to start the interview.
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="flex-end" sx={{ mt: 4 }}>
              <Button variant="outlined" onClick={() => navigate("/interviews")}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={requiresSkillCatalog && skillLoading}>
                {FREE_ACCESS_MODE ? "Start Sonia Demo" : "Start Interview"}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
