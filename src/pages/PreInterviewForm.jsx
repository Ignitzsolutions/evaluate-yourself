import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { authFetch, buildApiErrorFromResponse, getApiErrorMessage } from "../utils/apiClient";
import { apiUrl } from "../utils/apiBaseUrl";
import { formatInterviewTypeLabel } from "../utils/interviewTypeLabels";
import {
  buildInterviewConfig,
  INTERVIEW_TYPES_REQUIRING_SKILLS,
  isInterviewFreeAccessMode,
  readSavedInterviewConfig,
  saveInterviewConfig,
} from "../utils/accessMode";

const FREE_ACCESS_MODE = isInterviewFreeAccessMode();
const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60];

export default function PreInterviewForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();

  const [selectedType, setSelectedType] = useState(location.state?.type || "technical");

  const [duration, setDuration] = useState(DURATION_OPTIONS[0]);
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
  const skillSelectionBlocked = requiresSkillCatalog && (skillLoading || !skillCatalog);

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
    setDuration(Number(parsed.duration) || DURATION_OPTIONS[0]);
    setDifficulty(parsed.difficulty || "easy");
    setRole(parsed.role || "");
    setCompany(parsed.company || "");
    setQuestionMix(parsed.questionMix || "balanced");
    setInterviewStyle(parsed.interviewStyle || "neutral");
    setTranscriptConsent(Boolean(parsed.transcriptConsent));
    setSelectedSkills(Array.isArray(parsed.selectedSkills) ? parsed.selectedSkills : []);
  }, [location.state?.recoveryMessage, location.state?.type]);

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
          apiUrl("/api/interview/skill-catalog", { interview_type: selectedType }),
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
        minHeight: "100dvh",
        bgcolor: "background.default",
        py: { xs: 3, md: 6 },
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Stack component="header" direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "flex-end" }}>
            <Box>
              <Typography variant="h3" component="h1" sx={{ textWrap: "balance" }}>
                Configure Interview
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680 }}>
                {FREE_ACCESS_MODE
                  ? "Confirm the basics, choose evidence settings, then start Sonia. No trial code is required."
                  : "Set the role, difficulty, evidence settings, and transcript consent before starting."}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => navigate("/interviews")}>
              Back to Selection
            </Button>
          </Stack>

          <Grid container spacing={2.5} alignItems="flex-start">
            <Grid item xs={12} md={4}>
              <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, boxShadow: "none" }}>
                <Stack spacing={2}>
                  <Chip label={formatInterviewTypeLabel(selectedType)} color="primary" sx={{ alignSelf: "flex-start" }} />
                  <Box>
                    <Typography variant="h5" component="h2">
                      Session Readiness
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      Sonia uses these settings to choose the opening prompt, pacing, and follow-up depth.
                    </Typography>
                  </Box>
                  <Divider />
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" gap={2}>
                      <Typography color="text.secondary">Role</Typography>
                      <Typography fontWeight={800} sx={{ textAlign: "right", overflowWrap: "anywhere" }}>
                        {role.trim() || "Not Set"}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" gap={2}>
                      <Typography color="text.secondary">Difficulty</Typography>
                      <Typography fontWeight={800} sx={{ textTransform: "capitalize" }}>{difficulty}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" gap={2}>
                      <Typography color="text.secondary">Duration</Typography>
                      <Typography fontWeight={800}>{duration} min</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" gap={2}>
                      <Typography color="text.secondary">Evidence</Typography>
                      <Typography fontWeight={800}>{transcriptConsent ? "Enabled" : "Required"}</Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={8}>
              <Paper elevation={0} component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2.5, md: 3 }, boxShadow: "none" }}>
                <Stack spacing={2.5}>
                  {FREE_ACCESS_MODE && (
                    <Alert severity="info">
                      Free access is active. Start Sonia directly from this screen without redeeming a trial code.
                    </Alert>
                  )}
                  {recoveryMessage && (
                    <Alert severity="warning">
                      {recoveryMessage}
                    </Alert>
                  )}

                  <Box>
                    <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                      Basics
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Target Role"
                          name="target_role"
                          autoComplete="organization-title"
                          placeholder="e.g., Backend Engineer…"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Target Company"
                          name="target_company"
                          autoComplete="organization"
                          placeholder="e.g., Microsoft…"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                      Interview Controls
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="duration-label">Duration</InputLabel>
                          <Select labelId="duration-label" label="Duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))} inputProps={{ name: "duration" }}>
                            {DURATION_OPTIONS.map((mins) => (
                              <MenuItem key={mins} value={mins}>{mins} minutes</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="difficulty-label">Difficulty</InputLabel>
                          <Select labelId="difficulty-label" label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} inputProps={{ name: "difficulty" }}>
                            <MenuItem value="easy">Easy</MenuItem>
                            <MenuItem value="medium">Medium</MenuItem>
                            <MenuItem value="hard">Hard</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="focus-label">Question Focus</InputLabel>
                          <Select labelId="focus-label" label="Question Focus" value={questionMix} onChange={(e) => setQuestionMix(e.target.value)} inputProps={{ name: "question_focus" }}>
                            <MenuItem value="technical">Technical</MenuItem>
                            <MenuItem value="balanced">Balanced</MenuItem>
                            <MenuItem value="behavioral">Behavioral</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="style-label">Interview Style</InputLabel>
                          <Select labelId="style-label" label="Interview Style" value={interviewStyle} onChange={(e) => setInterviewStyle(e.target.value)} inputProps={{ name: "interview_style" }}>
                            <MenuItem value="friendly">Friendly</MenuItem>
                            <MenuItem value="neutral">Neutral</MenuItem>
                            <MenuItem value="strict">Strict</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>

                  {requiresSkillCatalog && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="h6" component="h2" sx={{ mb: 0.75 }}>
                          Stream Selection
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          {skillCatalog?.mixed_rule ||
                            `Select ${skillCatalog?.selection_rules?.min ?? 0}${skillCatalog?.selection_rules?.min === skillCatalog?.selection_rules?.max ? "" : `-${skillCatalog?.selection_rules?.max ?? 0}`} stream(s).`}
                        </Typography>
                        {skillLoading && (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={18} />
                            <Typography variant="body2" color="text.secondary">
                              Loading interview streams…
                            </Typography>
                          </Stack>
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
                                />
                              );
                            })}
                          </Stack>
                        )}
                        {skillError && (
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} sx={{ mt: 1.5 }}>
                            <Alert severity="error" sx={{ flex: 1 }}>
                              {skillError}
                            </Alert>
                            <Button
                              variant="outlined"
                              onClick={() => setSkillRetryTick((prev) => prev + 1)}
                              disabled={skillLoading}
                            >
                              Retry Catalog
                            </Button>
                          </Stack>
                        )}
                      </Box>
                    </>
                  )}

                  <Divider />

                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: consentError ? "error.main" : "divider",
                      bgcolor: "background.default",
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
                          name="transcript_consent"
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

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="flex-end">
                    <Button variant="outlined" onClick={() => navigate("/interviews")}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="contained" size="large" disabled={skillSelectionBlocked}>
                      {FREE_ACCESS_MODE ? "Start Sonia Demo" : "Start Interview"}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
