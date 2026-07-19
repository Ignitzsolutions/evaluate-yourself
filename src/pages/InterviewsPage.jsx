import React, { useState } from "react";
import {
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
import {
  Work as InterviewsIcon,
  Code,
  Psychology,
  Shuffle,
  RecordVoiceOver,
  ArrowForward,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { isInterviewFreeAccessMode } from "../utils/accessMode";
import "../ui.css";

const interviewTypes = [
  {
    id: "technical",
    title: "Technical Interview",
    description: "Coding, system design, and technical depth checks.",
    icon: Code,
    duration: "25-45 min",
    difficulty: "Medium-Hard",
  },
  {
    id: "behavioral",
    title: "Behavioral Interview",
    description: "STAR stories, judgment, collaboration, and role-fit answers.",
    icon: Psychology,
    duration: "15-30 min",
    difficulty: "Medium",
  },
  {
    id: "mixed",
    title: "360 Interview",
    description: "A balanced technical and behavioral session.",
    icon: Shuffle,
    duration: "30-60 min",
    difficulty: "Varies",
  },
  {
    id: "communication-practice",
    title: "Communication Practice",
    description: "Voice-first drills for grammar, pacing, and fluency.",
    icon: RecordVoiceOver,
    duration: "5-20 min",
    difficulty: "Adaptive",
  },
];

export default function InterviewsPage() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState("technical");
  const freeAccessMode = isInterviewFreeAccessMode();
  const selectedInterview = interviewTypes.find((type) => type.id === selectedType) || interviewTypes[0];
  const handleContinue = () => {
    if (selectedType === "communication-practice") {
      navigate("/communication-practice");
      return;
    }
    navigate("/interview-config", { state: { type: selectedType } });
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 6 } }}>
        <Container maxWidth="lg">
          <Stack spacing={3}>
            <Box component="header">
              <Button variant="text" onClick={() => navigate("/dashboard")} sx={{ px: 0, mb: 1 }}>
                Back to Dashboard
              </Button>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
                <InterviewsIcon color="primary" aria-hidden="true" />
                <Typography variant="h3" component="h1" sx={{ textWrap: "balance" }}>
                  Choose Your Interview Track
                </Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ maxWidth: 680 }}>
                {freeAccessMode
                  ? "Pick the session Sonia should run. Free access is enabled, so you can start without a trial code."
                  : "Pick the session Sonia should run, then tune the role, difficulty, and evidence settings."}
              </Typography>
            </Box>

            <Grid container spacing={2.5} alignItems="stretch">
              <Grid item xs={12} md={4}>
                <Paper elevation={0} sx={{ height: "100%", p: { xs: 2.5, md: 3 }, boxShadow: "none" }}>
                  <Stack spacing={2.25} sx={{ height: "100%" }}>
                    <Chip label="Selected Track" color="primary" sx={{ alignSelf: "flex-start" }} />
                    <Box>
                      <Typography variant="h4" component="h2">
                        {selectedInterview.title}
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        {selectedInterview.description}
                      </Typography>
                    </Box>
                    <Divider />
                    <Stack spacing={1.25}>
                      <Stack direction="row" justifyContent="space-between" gap={2}>
                        <Typography color="text.secondary">Duration</Typography>
                        <Typography fontWeight={800}>{selectedInterview.duration}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" gap={2}>
                        <Typography color="text.secondary">Difficulty</Typography>
                        <Typography fontWeight={800}>{selectedInterview.difficulty}</Typography>
                      </Stack>
                    </Stack>
                    <Box sx={{ flex: 1 }} />
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<ArrowForward />}
                      onClick={handleContinue}
                      fullWidth
                    >
                      Configure {selectedInterview.title}
                    </Button>
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} md={8}>
                <Paper elevation={0} sx={{ p: { xs: 1, sm: 1.25 }, boxShadow: "none" }}>
                  <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: "none" }}>
                    {interviewTypes.map((type) => {
                      const selected = selectedType === type.id;
                      const TypeIcon = type.icon;
                      return (
                        <Box component="li" key={type.id}>
                          <Paper
                            elevation={0}
                            component="button"
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setSelectedType(type.id)}
                            sx={{
                              width: "100%",
                              p: { xs: 2, sm: 2.25 },
                              display: "grid",
                              gridTemplateColumns: { xs: "auto 1fr", sm: "auto 1fr auto" },
                              gap: 2,
                              alignItems: "center",
                              textAlign: "left",
                              cursor: "pointer",
                              font: "inherit",
                              color: "inherit",
                              borderColor: selected ? "primary.main" : "divider",
                              borderWidth: selected ? 2 : 1,
                              boxShadow: "none",
                              bgcolor: selected ? "action.selected" : "background.paper",
                              touchAction: "manipulation",
                              "&:hover": {
                                borderColor: selected ? "primary.main" : "text.secondary",
                              },
                              "&:focus-visible": {
                                outline: "3px solid",
                                outlineColor: "primary.light",
                                outlineOffset: 2,
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 2,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: selected ? "primary.main" : "background.default",
                                color: selected ? "primary.contrastText" : "text.secondary",
                              }}
                            >
                              <TypeIcon aria-hidden="true" />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="h6" component="h2">
                                {type.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                {type.description}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, justifySelf: { sm: "end" }, flexWrap: "wrap" }}>
                              <Chip label={type.duration} size="small" variant="outlined" />
                              <Chip label={selected ? "Selected" : type.difficulty} size="small" color={selected ? "primary" : "default"} variant={selected ? "filled" : "outlined"} />
                            </Stack>
                          </Paper>
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
