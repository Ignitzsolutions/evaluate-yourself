import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
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
    icon: <Code sx={{ fontSize: 48 }} />,
    duration: "25-45 min",
    difficulty: "Medium-Hard",
  },
  {
    id: "behavioral",
    title: "Behavioral Interview",
    description: "STAR stories, judgment, collaboration, and role-fit answers.",
    icon: <Psychology sx={{ fontSize: 48 }} />,
    duration: "15-30 min",
    difficulty: "Medium",
  },
  {
    id: "mixed",
    title: "360 Interview",
    description: "A balanced technical and behavioral session.",
    icon: <Shuffle sx={{ fontSize: 48 }} />,
    duration: "30-60 min",
    difficulty: "Varies",
  },
  {
    id: "communication-practice",
    title: "Communication Practice",
    description: "Voice-first drills for grammar, pacing, and fluency.",
    icon: <RecordVoiceOver sx={{ fontSize: 48 }} />,
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
      <Box sx={{ px: { xs: 2, md: 4 }, pt: { xs: 4, md: 7 }, pb: { xs: 4, md: 6 } }}>
        <Container maxWidth="lg">
          <Paper
            elevation={0}
            className="studio-panel"
            sx={{
              p: { xs: 3, md: 4 },
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                <Box>
                  <Chip
                    label={freeAccessMode ? "Free demo enabled" : "Interview studio"}
                    sx={{
                      mb: 1.2,
                      fontWeight: 800,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                    }}
                  />
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <InterviewsIcon color="primary" />
                    <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: "-0.04em" }}>
                      Choose interview type
                    </Typography>
                  </Stack>
                  <Typography color="text.secondary" sx={{ mt: 1.1, maxWidth: 720 }}>
                    {freeAccessMode
                      ? "Select one format. No trial code is required for the hosted beta flow."
                      : "Select the format that matches the session you want to practice."}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1.2} sx={{ flexWrap: "wrap" }}>
                  <Button variant="outlined" onClick={() => navigate("/dashboard")} sx={{ borderRadius: 999, px: 2.5 }}>
                    Back to dashboard
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<ArrowForward />}
                    onClick={handleContinue}
                    sx={{ borderRadius: 999, px: 2.8 }}
                  >
                    Continue with {selectedInterview.title}
                  </Button>
                </Stack>
              </Stack>

              <Grid container spacing={2.5}>
                {interviewTypes.map((type) => {
                  const selected = selectedType === type.id;
                  return (
                    <Grid item xs={12} md={6} key={type.id}>
                      <Paper
                        elevation={0}
                        component="button"
                        type="button"
                        aria-pressed={selected}
                        className="studio-section"
                        onClick={() => setSelectedType(type.id)}
                        sx={{
                          width: "100%",
                          textAlign: "left",
                          height: "100%",
                          cursor: "pointer",
                          font: "inherit",
                          color: "inherit",
                          borderColor: selected ? "primary.main" : "divider",
                          boxShadow: "none",
                          bgcolor: selected ? "action.selected" : "background.paper",
                          "&:focus-visible": {
                            outline: "3px solid",
                            outlineColor: "primary.light",
                            outlineOffset: 2,
                          },
                        }}
                      >
                        <Stack spacing={2}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                            <Box sx={{ color: selected ? "primary.main" : "text.secondary" }}>{type.icon}</Box>
                            <Chip
                              label={selected ? "Selected" : "Select"}
                              size="small"
                              color={selected ? "primary" : "default"}
                              variant={selected ? "filled" : "outlined"}
                            />
                          </Box>
                          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
                            {type.title}
                          </Typography>
                          <Typography color="text.secondary" sx={{ maxWidth: 560 }}>
                            {type.description}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                            <Chip label={type.duration} size="small" variant="outlined" />
                            <Chip label={type.difficulty} size="small" variant="outlined" />
                          </Stack>
                        </Stack>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
