import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
import { useUser, useClerk } from "@clerk/clerk-react";
import { Box, Container, Typography, Button, Card, Grid } from "@mui/material";
import { PlayArrow, Assessment, Settings } from "@mui/icons-material";
import { Divider, Stack, Paper } from "@mui/material";
import "../ui.css";

export default function LandingPage() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const nav = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateRows: "auto 1fr", background: "#fff" }}>
      {/* Glossy header */}
      <header className="glossy-header">
        <div className="glossy-inner">
          {/* Left: Logo */}
          <div className="brand-section">
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}>
              <img
                src="/assets/logo.png"
                alt="Evaluate Yourself Logo"
                style={{
                  width: isScrolled ? 40 : 56,
                  height: isScrolled ? 40 : 56,
                  borderRadius: "12px",
                  transition: "all 0.3s ease-in-out"
                }}
              />
              <strong style={{
                fontSize: isScrolled ? "15px" : "18px",
                transition: "all 0.3s ease-in-out"
              }}>Evaluate Yourself</strong>
            </Link>
          </div>

          {/* Center: Navigation */}
          <nav className="nav-center">

          </nav>

          {/* Right: Action buttons */}
          <div className="nav-right">
            {!isSignedIn ? (
              <>
                <Link to="/login" className="btn btn-primary" style={{
                  textDecoration: "none",
                  fontSize: isScrolled ? "13px" : "14px",
                  padding: isScrolled ? "6px 12px" : "8px 14px",
                  transition: "all 0.3s ease-in-out"
                }}>Login</Link>
                <Link to="/register" className="btn btn-primary" style={{
                  textDecoration: "none",
                  fontSize: isScrolled ? "13px" : "14px",
                  padding: isScrolled ? "6px 12px" : "8px 14px",
                  transition: "all 0.3s ease-in-out"
                }}>Register</Link>
              </>
            ) : (
              <>
                <button onClick={() => nav("/dashboard")} className="btn" style={{
                  background: "#111827",
                  color: "#fff",
                  fontSize: isScrolled ? "13px" : "14px",
                  padding: isScrolled ? "6px 12px" : "8px 14px",
                  transition: "all 0.3s ease-in-out"
                }}>Go to App</button>
                <button onClick={signOut} className="btn btn-ghost" style={{
                  fontSize: isScrolled ? "13px" : "14px",
                  padding: isScrolled ? "6px 10px" : "8px 12px",
                  transition: "all 0.3s ease-in-out"
                }}>Logout</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <Box className="hero" sx={{ pt: 10, pb: 10 }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">

            {/* LEFT CONTENT */}
            <Grid item xs={12} md={6}>
              <Stack spacing={3} textAlign="left">
                <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  Practice real interviews.<br />
                  Understand how you perform.<br />
                  Get interview-ready.
                </Typography>

                <Typography sx={{ fontSize: 18, opacity: 0.65, lineHeight: 1.6, maxWidth: 540 }}>
                  Evaluate Yourself is a real-time AI interview platform that lets you experience realistic interviews,
                  observes how you communicate and reason under pressure, and shows you exactly how to improve before the real one.
                </Typography>

                <Box sx={{ display: "flex", gap: 2, pt: 1 }}>
                  {!isSignedIn ? (
                    <>
                      <Button variant="contained" size="large" onClick={() => nav("/setup")} sx={{ px: 4, fontSize: 16 }}>
                        Start practicing
                      </Button>
                      <Button variant="outlined" size="large" onClick={() => nav("/sample-report")} sx={{ px: 3, fontSize: 16 }}>
                        View sample report
                      </Button>
                    </>
                  ) : (
                    <Button variant="contained" size="large" onClick={() => nav("/interviews")} sx={{ px: 4, fontSize: 16 }}>
                      Start practicing
                    </Button>
                  )}
                </Box>
              </Stack>
            </Grid>

            {/* RIGHT IMAGE */}
            <Grid item xs={12} md={6} sx={{ display: "flex", justifyContent: "center" }}>
              <Paper elevation={2} sx={{ p: 1, borderRadius: 5, width: "100%", maxWidth: 520 }}>
                <Box
                  component="img"
                  src="/assets/skillevaluation.png"
                  alt="Interview Practice"
                  sx={{ width: "100%", borderRadius: 5, display: "block" }}
                />
              </Paper>
            </Grid>

          </Grid>
        </Container>
      </Box>

                  
      <Divider sx={{ my: 2 }} />

      {/* SECTION 1 */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack spacing={6} textAlign="center">
          <Typography variant="h3" sx={{ fontWeight: 700 }}>Practice a Real Interview</Typography>
          <Grid container spacing={4}>
            {[
              { title: "Conversational flow", body: "Speak, pause, think, ask for clarification and continue naturally." },
              { title: "No rehearsed answers", body: "You don’t memorize — you respond in real time." },
              { title: "Human-like interviewer", body: "Questions and follow-ups react to you." }
            ].map((item, i) => (
              <Grid item xs={12} md={4} key={i}>
                <Card sx={{ p: 4, borderRadius: 4, boxShadow: 1, height: "100%" }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>{item.title}</Typography>
                  <Typography sx={{ opacity: 0.7, fontSize: 16 }}>{item.body}</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Container>

      <Divider sx={{ my: 2 }} />

      {/* SECTION 2 */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack spacing={6} textAlign="center">
          <Typography variant="h3" sx={{ fontWeight: 700 }}>Experience How You Perform</Typography>

          <Grid container spacing={4} justifyContent="center">

            {/* CARD 1 */}
            <Grid item xs={12} md={5}>
              <Card sx={{ p: 4, borderRadius: 4, boxShadow: 1, height: "100%" }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                  We observe how you answer,<br /> not just what you answer.
                </Typography>

                <Typography sx={{ fontSize: 16, opacity: 0.7, mb: 3 }}>
                  The system listens and evaluates in real time, tracking:
                </Typography>

                <Grid container spacing={1.8} justifyContent="center">
                  {[
                    "Pace and flow of communication",
                    "Clarity of explanation",
                    "Technical depth and reasoning",
                    "Confidence under pressure",
                    "Understanding the real question"
                  ].map((text, i) => (
                    <Grid item xs={12} sm={6} key={i}>
                      <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}>
                          {text}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Card>
            </Grid>

            {/* CARD 2 */}
            <Grid item xs={12} md={5}>
              <Card sx={{ p: 4, borderRadius: 4, boxShadow: 1, height: "100%" }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                  Adaptive Follow-Ups,<br /> Just Like Real Interviews
                </Typography>

                <Grid container spacing={2.2} justifyContent="center" sx={{ mb: 3 }}>
                  {[
                    { icon: <PlayArrow sx={{ fontSize: 26, opacity: 0.8 }} />, label: "Probes deeper when answers are shallow" },
                    { icon: <Settings sx={{ fontSize: 26, opacity: 0.8 }} />, label: "Clarifies when you sound unclear" },
                    { icon: <Assessment sx={{ fontSize: 26, opacity: 0.8 }} />, label: "Raises the bar when you're strong" }
                  ].slice(0, 2).map((item, i) => (  // taking only 2 cards as requested
                    <Grid item xs={12} key={i}>
                      <Paper elevation={1} sx={{ p: 2.2, borderRadius: 2, display: "flex", alignItems: "center", gap: 1.6 }}>
                        {item.icon}
                        <Typography sx={{ fontSize: 14, fontWeight: 600, opacity: 0.85 }}>
                          {item.label}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <Typography sx={{ fontSize: 16, opacity: 0.6 }}>
                  The interviewer reacts to you, challenges you when you're strong, and guides you when you're stuck.
                </Typography>
              </Card>
            </Grid>

          </Grid>
        </Stack>
      </Container>


      <Divider sx={{ my: 2 }} />

      {/* SECTION 3 */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Stack spacing={7} textAlign="center" alignItems="center">

          <Typography variant="h3" sx={{ fontWeight: 800, opacity: 0.9 }}>
            Actionable Feedback Report
          </Typography>

          <Grid container spacing={5} justifyContent="center" sx={{ width: "100%", maxWidth: 1200 }}>

            {/* CARD 1 */}
            <Grid item xs={12} md={5}>
              <Card sx={{ p: 5, borderRadius: 4, boxShadow: 1.2, height: "100%" }}>
                <Stack spacing={2.2} alignItems="center">
                  <Assessment sx={{ fontSize: 34, opacity: 0.8 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700, opacity: 0.9 }}>
                    Breakdown & Patterns
                  </Typography>
                </Stack>

                <Stack spacing={2.4} sx={{ mt: 4 }}>
                  {[
                    "Where your answers broke down",
                    "Detected patterns across the interview",
                    "Common mistakes real interviewers notice",
                    "Why those mistakes matter in real rounds"
                  ].map((text, i) => (
                    <Paper key={i} elevation={1} sx={{ p: 2.2, borderRadius: 2, width: "100%" }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 600, opacity: 0.8 }}>
                        {text}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Card>
            </Grid>

            {/* CARD 2 */}
            <Grid item xs={12} md={5}>
              <Card sx={{ p: 5, borderRadius: 4, boxShadow: 1.2, height: "100%" }}>
                <Stack spacing={2.2} alignItems="center">
                  <Settings sx={{ fontSize: 32, opacity: 0.8 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700, opacity: 0.9 }}>
                    What to Improve Next
                  </Typography>
                </Stack>

                <Stack spacing={2.4} sx={{ mt: 4 }}>
                  {[
                    "What to change in communication or logic",
                    "How to structure answers better",
                    "What to practice in the next session",
                    "Signals of confidence vs hesitation"
                  ].map((text, i) => (
                    <Paper key={i} elevation={1} sx={{ p: 2.2, borderRadius: 2, width: "100%" }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 600, opacity: 0.8 }}>
                        {text}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Card>
            </Grid>

          </Grid>

          {/* REPORT SUMMARY BOX */}
          <Paper elevation={2} sx={{ p: 4.5, borderRadius: 3, maxWidth: 780, mt: 6 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 600, opacity: 0.65, lineHeight: 1.6 }}>
              No vague advice. No generic scores.<br />
              Just clear, repeatable, interviewer-grade improvement guidance.
            </Typography>
          </Paper>

        </Stack>
      </Container>


      <Divider sx={{ my: 2 }} />

      {/* CLOSING SECTION */}
      <Box sx={{ py: 6 }}>
        <Container maxWidth="sm">
          <Stack spacing={5} textAlign="center" alignItems="center">
            <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.3 }}>
              Interviews are a skill.<br />Skills improve with practice and feedback.
            </Typography>

            <Stack direction="row" spacing={2.5} justifyContent="center">
              {[
                "Real interview experience",
                "Honest observation",
                "Clear direction to improve"
              ].map((text, i) => (
                <Paper key={i} elevation={1} sx={{ px: 2.5, py: 1.4, borderRadius: 2 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 600, opacity: 0.8 }}>
                    {text}
                  </Typography>
                </Paper>
              ))}
            </Stack>

            <Button variant="contained" size="large" onClick={() => nav("/setup")} sx={{ px: 5, fontSize: 17, borderRadius: 2 }}>
              Start practicing now
            </Button>

            <Typography sx={{ fontSize: 16, opacity: 0.6 }}>
              So when the real interview happens, it won’t feel new anymore.
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* ONE-LINE YC SUMMARY */}
      <Box sx={{ textAlign: "center", py: 3, opacity: 0.5, fontSize: 14 }}>
        Evaluate Yourself helps candidates practice real interviews, understand how they perform under pressure, and improve before the real interview.
      </Box>

      <Box
        component="div"
        sx={{
          width: "100%",
          bgcolor: "primary.main",
          m: 0,
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
        <div style={{ width: "100%", marginTop: 12, marginBottom: 12 }}>
          <Divider sx={{ bgcolor: "white", opacity: 0.3, height: 2, width: "100%" }} />
        </div>
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

    </div>
  );
}

// function Feature({ tone, title, body }) {
//   return (
//     <div className={`card ${tone}`}>
//       <div className="card-title">{title}</div>
//       <div className="card-body">{body}</div>
//     </div>
//   );
// }
