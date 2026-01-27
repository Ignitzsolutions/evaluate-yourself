import React, { useEffect, useState, useCallback } from "react";
import { Container, Typography, Grid, Card, Box, CardContent, Button, Stack, Divider, Paper, Alert, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { PlayArrow, Speed, Psychology, Assessment, TrendingUp } from "@mui/icons-material";
import { useUser, useAuth } from "@clerk/clerk-react";
import { authFetch } from "../utils/apiClient";

const API_BASE = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || "http://localhost:8000";

export default function Dashboard() {
  const nav = useNavigate();
  const go = useNavigate();
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();
  const [backendUser, setBackendUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | ok | error
  const [syncError, setSyncError] = useState(null);

  const syncUser = useCallback(async () => {
    setSyncError(null);
    if (!isLoaded) return;
    const token = await getToken();
    if (!token) {
      setSyncStatus("idle");
      return;
    }
    setSyncStatus("syncing");
    try {
      const resp = await authFetch(`${API_BASE}/api/me`, token, { method: "GET" });
      if (!resp.ok) {
        const text = await resp.text();
        let msg = `Backend returned ${resp.status}`;
        try {
          const data = JSON.parse(text);
          msg = data.detail || msg;
        } catch {
          if (text) msg = text.slice(0, 120);
        }
        setSyncError(msg);
        setSyncStatus("error");
        return;
      }
      const data = await resp.json();
      setBackendUser(data);
      setSyncStatus("ok");
    } catch (err) {
      setSyncError(err.message || "Failed to sync user with backend");
      setSyncStatus("error");
    }
  }, [getToken, isLoaded]);

  useEffect(() => {
    if (isLoaded) syncUser();
  }, [isLoaded, syncUser]);


  const cards = [
    {
      icon: <PlayArrow sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Start an Interview",
      subtitle: "Practice in a real interview setup",
      body: "Launch a live AI interview that feels like a real conversation. Choose one question or a full interview and respond naturally.",
      cta: "Start Now",
      action: () => go("/interviews")
    },
    {
      icon: <TrendingUp sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Experience How You Perform",
      subtitle: "See how you actually answer under pressure",
      body: "While you speak, the system observes your pace, clarity, confidence, and technical understanding — just like a real interviewer would.",
      cta: "View Insights",
      action: () => go("/analytics")
    },
    {
      icon: <Assessment sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Review Your Report",
      subtitle: "Clear mistakes and improvement areas",
      body: "After the interview, get a detailed report highlighting where you struggled, what worked, and why it matters in real interviews.",
      cta: "Open Report",
      action: () => go("/report")
    },
    {
      icon: <Psychology sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Adaptive Follow-ups",
      subtitle: "Questions change based on your response",
      body: "If your answer is unclear or shallow, the interviewer probes deeper. If it’s strong, the difficulty increases."
    },
    {
      icon: <TrendingUp sx={{ fontSize: 38, opacity: 0.8 }} />,
      title: "Improve Over Time",
      subtitle: "Track progress across sessions",
      body: "Your dashboard shows how your communication, depth, and confidence improve with practice — so every session has a purpose."
    }
  ];

  return (
    <>
      {/* PAGE WRAPPER FIXED TO WHITE SURFACE ONLY IN THIS COMPONENT */}
      <div style={{ minHeight: "100vh", display: "grid", gridTemplateRows: "1fr auto", background: "#fff", margin: 0, padding: 0 }}>

        {/* MAIN CONTENT */}
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <Stack spacing={1.8} textAlign="left" alignItems="flex-start" sx={{ mb: 6 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="h5" sx={{ fontWeight: 700, opacity: 0.85 }}>
                Hello, {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "User"} 👋
              </Typography>
              {syncStatus === "syncing" && <CircularProgress size={18} sx={{ ml: 0.5 }} />}
              {syncStatus === "ok" && backendUser && (
                <Typography component="span" sx={{ fontSize: 13, opacity: 0.6 }}>
                  • Synced with backend
                </Typography>
              )}
            </Box>
            {syncError && (
              <Alert severity="warning" onClose={() => setSyncError(null)} sx={{ width: "100%", maxWidth: 560 }}>
                {syncError}
              </Alert>
            )}
            <Typography sx={{ fontSize: 15, opacity: 0.55 }}>
              Welcome back! Ready to sharpen your interview skills.
            </Typography>

            <Typography variant="h3" sx={{ fontWeight: 800, opacity: 0.9 }}>
              How to Use{" "}
              <Box component="span" sx={{ color: (theme) => theme.palette.primary.main }}>
                Evaluate Yourself
              </Box>
            </Typography>

            <Typography sx={{ fontSize: 17, opacity: 0.6, maxWidth: 700 }}>
              A realistic interview experience designed to help you practice, improve, and get ready.
            </Typography>
          </Stack>

          <Divider sx={{ my: 6 }} />

          {/* ROW 1 → 3 CARDS WITH BUTTONS */}
          <Grid container spacing={4} justifyContent="flex-start" wrap="nowrap" sx={{ overflowX: "auto", pb: 2 }}>
            {cards.slice(0, 3).map((card, i) => (
              <Grid item key={i} sx={{ minWidth: 340 }}>
                <Card sx={{ borderRadius: 4, boxShadow: 1.4 }}>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={2.5} alignItems="flex-start" textAlign="left" sx={{ width: "100%" }}>
                      {card.icon}
                      <Typography variant="h6" sx={{ fontWeight: 700, opacity: 0.9 }}>
                        {card.title}
                      </Typography>

                      <Paper elevation={0} sx={{ px: 2, py: 0.6, borderRadius: 2, opacity: 0.5, alignSelf: "flex-start" }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{card.subtitle}</Typography>
                      </Paper>

                      <Typography sx={{ fontSize: 15, opacity: 0.75, lineHeight: 1.5 }}>
                        {card.body}
                      </Typography>

                      <Button variant="contained" size="large" onClick={card.action} sx={{ px: 3.5, fontSize: 15, borderRadius: 2, alignSelf: "flex-start" }}>
                        {card.cta}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* ROW 2 → REMAINING CARDS WITHOUT BUTTON */}
          <Grid container spacing={4} justifyContent="flex-start">
            {cards.slice(3).map((card, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card sx={{ borderRadius: 4, boxShadow: 1, height: "100%" }}>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={2.2} alignItems="flex-start" textAlign="left">
                      {card.icon}
                      <Typography variant="h6" sx={{ fontWeight: 600, opacity: 0.85 }}>
                        {card.title}
                      </Typography>
                      <Typography sx={{ fontSize: 14, opacity: 0.55 }}>{card.subtitle}</Typography>
                      <Typography sx={{ fontSize: 15, opacity: 0.7, lineHeight: 1.5 }}>
                        {card.body}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 8 }} />

          {/* Your Progress Section */}
          <Box sx={{ mb: 8 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, opacity: 0.9, mb: 4 }}>
              Your Progress
            </Typography>
            
            <Grid container spacing={3}>
              {/* Clarity Card */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  borderRadius: 2, 
                  boxShadow: 1,
                  border: "1px solid #e0e0e0",
                  height: "100%"
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Speed sx={{ fontSize: 24, color: "#6b7280" }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "16px" }}>
                          Clarity
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#111827" }}>
                        82%
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "13px" }}>
                        Average across sessions
                      </Typography>
                      <Box sx={{ height: "4px", background: "#e5e7eb", borderRadius: "2px", overflow: "hidden" }}>
                        <Box sx={{ height: "100%", width: "82%", background: "#4ade80" }} />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Confidence Card */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  borderRadius: 2, 
                  boxShadow: 1,
                  border: "1px solid #e0e0e0",
                  height: "100%"
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <TrendingUp sx={{ fontSize: 24, color: "#6b7280" }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "16px" }}>
                          Confidence
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#111827" }}>
                        75%
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "13px" }}>
                        Improving over time
                      </Typography>
                      <Box sx={{ height: "4px", background: "#e5e7eb", borderRadius: "2px", overflow: "hidden" }}>
                        <Box sx={{ height: "100%", width: "75%", background: "#3b82f6" }} />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Pace Card */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  borderRadius: 2, 
                  boxShadow: 1,
                  border: "1px solid #e0e0e0",
                  height: "100%"
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Speed sx={{ fontSize: 24, color: "#6b7280" }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "16px" }}>
                          Pace
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#111827" }}>
                        78%
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "13px" }}>
                        Speaking rate optimal
                      </Typography>
                      <Box sx={{ height: "4px", background: "#e5e7eb", borderRadius: "2px", overflow: "hidden" }}>
                        <Box sx={{ height: "100%", width: "78%", background: "#f59e0b" }} />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Technical Depth Card */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  borderRadius: 2, 
                  boxShadow: 1,
                  border: "1px solid #e0e0e0",
                  height: "100%"
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Assessment sx={{ fontSize: 24, color: "#6b7280" }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "16px" }}>
                          Technical Depth
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#111827" }}>
                        70%
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#6b7280", fontSize: "13px" }}>
                        Room for improvement
                      </Typography>
                      <Box sx={{ height: "4px", background: "#e5e7eb", borderRadius: "2px", overflow: "hidden" }}>
                        <Box sx={{ height: "100%", width: "70%", background: "#ef4444" }} />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 8 }} />

          {/* FINAL LEFT ALIGNED CTA */}
          <Stack spacing={3} alignItems="flex-start" textAlign="left" sx={{ width: "100%" }}>
            <Typography variant="h4" sx={{ fontWeight: 700, opacity: 0.8 }}>
              Interviews are a skill.<br />Skills improve when you practice the real thing.
            </Typography>

            <Button variant="contained" size="large" onClick={() => nav("/interviews")} sx={{ px: 4, py: 1.4, fontSize: 16, borderRadius: 2 }}>
              Start practicing now
            </Button>

            <Typography sx={{ fontSize: 15, opacity: 0.5 }}>
              So when the real interview happens, it won’t feel new anymore.
            </Typography>
          </Stack>

        </Container>


      </div>
      <Box
        component="div"
        sx={{
          width: "100%",
          bgcolor: "primary.main", // EXACT MUI button color
          m: 0,                    // no margin
          py: 3,
          textAlign: "center"
        }}
      >
        <Typography
          sx={{
            fontSize: 164,
            fontWeight: 800,
            letterSpacing: 1.2,
            opacity: 0.95,
            color: "white"
          }}
        >
          EvaluateYourself
        </Typography>
        {/* Break line below main text */}
        <div style={{ width: "100%", marginTop: 12, marginBottom: 12 }}>
          <Divider sx={{ bgcolor: "white", opacity: 0.3, height: 2, width: "100%" }} />
        </div>

        {/* Copyright text */}
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 500,
            color: "white",
            opacity: 0.7
          }}
        >
          © {new Date().getFullYear()} Evaluate Yourself. All rights reserved.
        </Typography>
      </Box>
    </>
  );
}
