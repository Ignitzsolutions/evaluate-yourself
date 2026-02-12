import React, { useMemo, useState } from "react";
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

const trialModeEnabled = !["0", "false", "no", "off"].includes(
  String(process.env.REACT_APP_TRIAL_MODE_ENABLED || "true").toLowerCase()
);
const freeTrialMinutes = Math.max(1, Number(process.env.REACT_APP_FREE_TRIAL_MINUTES || 5));

export default function PreInterviewForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedType = useMemo(() => location.state?.type || "technical", [location.state?.type]);

  const durationOptions = trialModeEnabled ? [freeTrialMinutes] : [10, 15, 20, 30];
  const [duration, setDuration] = useState(durationOptions[0]);
  const [difficulty, setDifficulty] = useState("medium");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [questionMix, setQuestionMix] = useState("balanced");
  const [interviewStyle, setInterviewStyle] = useState("neutral");
  const [transcriptConsent, setTranscriptConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!transcriptConsent) {
      setConsentError(true);
      return;
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const config = {
      type: selectedType,
      duration,
      trialMode: trialModeEnabled,
      difficulty,
      role: role.trim() || undefined,
      company: company.trim() || undefined,
      questionMix,
      interviewStyle,
      transcriptConsent,
    };

    sessionStorage.setItem("interviewConfig", JSON.stringify(config));
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
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 4 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Interview Configuration
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Quick setup for a focused, production-ready session.
              </Typography>
              <Chip label={`Type: ${selectedType}`} size="small" color="primary" sx={{ mt: 1.5 }} />
            </Box>
            <Button variant="outlined" onClick={() => navigate("/interviews")}>
              Back to Selection
            </Button>
          </Stack>

          <Box component="form" onSubmit={handleSubmit}>
            {trialModeEnabled && (
              <Alert severity="info" sx={{ mb: 2.5 }}>
                Free trial mode is active. Interview duration is capped at {freeTrialMinutes} minutes.
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
              <Button type="submit" variant="contained">
                Start Interview
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
