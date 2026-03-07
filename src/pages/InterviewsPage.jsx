import React, { useState } from "react";
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
} from "@mui/material";
import {
  Work as InterviewsIcon,
  Code,
  Psychology,
  Shuffle,
  PlayArrow,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import "../ui.css";

const interviewTypes = [
  {
    id: "technical",
    title: "Technical Interview",
    description: "Practice coding questions, system design, and technical concepts with AI feedback.",
    icon: <Code sx={{ fontSize: 48 }} />,
    color: "primary",
    duration: "25-45 min",
    difficulty: "Medium-Hard",
  },
  {
    id: "behavioral",
    title: "Behavioral Interview",
    description: "Master STAR method and practice soft-skill questions with AI.",
    icon: <Psychology sx={{ fontSize: 48 }} />,
    color: "primary",
    duration: "15-30 min",
    difficulty: "Medium",
  },
  {
    id: "mixed",
    title: "360 Interview",
    description: "Combination of technical + behavioral questions in one session.",
    icon: <Shuffle sx={{ fontSize: 48 }} />,
    color: "primary",
    duration: "30-60 min",
    difficulty: "Varies",
  },
];

export default function InterviewsPage() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState("");

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <InterviewsIcon color="primary" />
          Interviews
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Choose an interview type to start practicing
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {interviewTypes.map((type) => (
          <Grid item xs={12} md={4} key={type.id}>
            <Card
              onClick={() => setSelectedType(type.id)}
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                cursor: "pointer",
                transform: selectedType === type.id ? "translateY(-4px)" : "none",
                boxShadow: selectedType === type.id ? 8 : 1,
                border: selectedType === type.id ? "2px solid var(--brand)" : "1px solid #e0e0e0",
                transition: "all 0.2s ease",
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: "center", pt: 4 }}>
                <Box sx={{ color: `${type.color}.main`, mb: 2 }}>{type.icon}</Box>
                <Typography variant="h5" gutterBottom>{type.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {type.description}
                </Typography>

                <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
                  <Chip label={type.duration} size="small" variant="outlined" />
                  <Chip label={type.difficulty} size="small" color={type.color} />
                </Box>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  variant="contained"
                  color={type.color}
                  startIcon={<PlayArrow />}
                  onClick={() =>
                    navigate("/interview-config", { state: { type: type.id } })
                  }
                  fullWidth
                >
                  Start {type.title.split(" ")[0]}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
