import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser, useClerk } from "../context/AuthContext";
import { Box, Container, Typography, Button, Card, Grid } from "@mui/material";
import { PlayArrow, Assessment, Settings, CheckRounded } from "@mui/icons-material";
import { Divider, Stack, Paper } from "@mui/material";
import { pricingPlans } from "../config/pricingConfig";
import WaitlistSignupForm from "../components/WaitlistSignupForm";
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
                <Link to="/pricing" className="btn btn-ghost" style={{
                  textDecoration: "none",
                  fontSize: isScrolled ? "13px" : "14px",
                  padding: isScrolled ? "6px 12px" : "8px 14px",
                  transition: "all 0.3s ease-in-out"
                }}>Pricing</Link>
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
      <Box className="hero" sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 } }}>
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">

            {/* LEFT CONTENT */}
            <Grid item xs={12} md={6}>
              <Stack spacing={3} textAlign="left">
                <Typography
                  variant="h2"
                  sx={{ fontWeight: 800, lineHeight: 1.2, fontSize: { xs: "2.1rem", sm: "2.6rem", md: "3.2rem" } }}
                >
                  Practice real interviews.<br />
                  Understand how you perform.<br />
                  Get interview-ready.
                </Typography>

                <Typography sx={{ fontSize: { xs: 15, md: 18 }, opacity: 0.65, lineHeight: 1.6, maxWidth: 540 }}>
                  Evaluate Yourself is a real-time AI interview platform that lets you experience realistic interviews,
                  observes how you communicate and reason under pressure, and shows you exactly how to improve before the real one.
                </Typography>

                <Box sx={{ display: "flex", gap: 2, pt: 1, flexWrap: "wrap" }}>
                  {!isSignedIn ? (
                    <>
                      <Button variant="contained" size="large" onClick={() => nav("/interview-config")} sx={{ px: { xs: 3, md: 4 }, fontSize: { xs: 14, md: 16 } }}>
                        Start practicing
                      </Button>
                      <Button variant="outlined" size="large" onClick={() => nav("/pricing")} sx={{ px: { xs: 2.5, md: 3 }, fontSize: { xs: 14, md: 16 } }}>
                        View pricing
                      </Button>
                    </>
                  ) : (
                    <Button variant="contained" size="large" onClick={() => nav("/interviews")} sx={{ px: { xs: 3, md: 4 }, fontSize: { xs: 14, md: 16 } }}>
                      Start practicing
                    </Button>
                  )}
                </Box>

                {!isSignedIn && (
                  <WaitlistSignupForm
                    sourcePage="landing"
                    intent="free_trial"
                    title="Want early access without creating an account?"
                    helperText="Join the launch waitlist for free-trial reminders and release updates."
                  />
                )}
              </Stack>
            </Grid>

            {/* RIGHT SUMMARY */}
            <Grid item xs={12} md={6} sx={{ display: "flex", justifyContent: "center" }}>
              <Paper
                elevation={2}
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: 5,
                  width: "100%",
                  maxWidth: 520,
                  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                  border: "1px solid rgba(148,163,184,.16)",
                  boxShadow: "0 18px 44px rgba(15,23,42,.08)",
                }}
              >
                <Stack spacing={2.25}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#2563eb" }}>
                    Interview Studio
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                    Structured practice with a clear before-and-after view.
                  </Typography>
                  <Typography sx={{ fontSize: 15, lineHeight: 1.7, opacity: 0.72 }}>
                    The session is built to feel formal and useful: one interviewer, one question at a time, then a report that shows where your answers were strong and where they broke down.
                  </Typography>
                  <Stack spacing={1.4} sx={{ pt: 1 }}>
                    {[
                      "Live interview flow instead of a quiz-style prompt list",
                      "Evidence-backed report after each session",
                      "Behavioral, technical, and 360 interview tracks in one workspace",
                    ].map((item) => (
                      <Paper
                        key={item}
                        elevation={0}
                        sx={{
                          p: 1.6,
                          borderRadius: 3,
                          backgroundColor: "rgba(37,99,235,.05)",
                          border: "1px solid rgba(37,99,235,.08)",
                        }}
                      >
                        <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, color: "#0f172a" }}>
                          {item}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            </Grid>

          </Grid>
        </Container>
      </Box>

                  
      <Divider sx={{ my: 2 }} />

      {/* SECTION 1 */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 }, px: { xs: 2, md: 3 } }}>
        <Stack spacing={6} textAlign="center">
          <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: "1.9rem", md: "2.6rem" } }}>Practice a Real Interview</Typography>
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
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 }, px: { xs: 2, md: 3 } }}>
        <Stack spacing={6} textAlign="center">
          <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: "1.9rem", md: "2.6rem" } }}>Experience How You Perform</Typography>

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
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 }, px: { xs: 2, md: 3 } }}>
        <Stack spacing={7} textAlign="center" alignItems="center">

          <Typography variant="h3" sx={{ fontWeight: 800, opacity: 0.9, fontSize: { xs: "2rem", md: "2.8rem" } }}>
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

          <Stack spacing={1.5} alignItems="center" sx={{ width: "100%", mt: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, opacity: 0.92 }}>
              Pricing Plans
            </Typography>
            <Typography sx={{ fontSize: 16, opacity: 0.65, maxWidth: 720 }}>
              Choose the track that matches your interview goals. Start with a free 5-minute trial.
            </Typography>
          </Stack>

          <Grid container spacing={2.5} sx={{ width: "100%", maxWidth: 1240 }}>
            {pricingPlans.map((plan) => (
              <Grid item xs={12} md={4} key={plan.key}>
                <Card
                  sx={{
                    p: 3.5,
                    borderRadius: 2.5,
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
                    height: "100%",
                    textAlign: "left",
                  }}
                >
                  <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                    {plan.tierLabel}
                  </Typography>
                  <Typography sx={{ mt: 0.6, fontSize: 16, opacity: 0.74 }}>
                    {plan.tagline}
                  </Typography>

                  <Typography sx={{ mt: 3, fontSize: { xs: 34, md: 44 }, fontWeight: 800, lineHeight: 1 }}>
                    {plan.priceLabel}
                  </Typography>
                  <Typography sx={{ mt: 0.6, fontSize: 16, opacity: 0.62 }}>
                    {plan.priceSubLabel}
                  </Typography>

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => nav("/pricing")}
                    sx={{
                      mt: 2.4,
                      py: 1.1,
                      borderRadius: 2,
                      textTransform: "none",
                      fontWeight: 700,
                      bgcolor: "#0b0f19",
                      "&:hover": { bgcolor: "#111827" },
                    }}
                  >
                    {plan.ctaLabel}
                  </Button>

                  <Divider sx={{ my: 2.2 }} />

                  <Typography sx={{ fontSize: 17, fontWeight: 700, mb: 0.8 }}>
                    {plan.introLine}
                  </Typography>

                  <Stack spacing={1.2}>
                    {plan.features.slice(0, 5).map((feature) => (
                      <Stack key={feature} direction="row" spacing={1} alignItems="flex-start">
                        <CheckRounded sx={{ fontSize: 18, mt: "3px", opacity: 0.82 }} />
                        <Typography sx={{ fontSize: 16, opacity: 0.88 }}>
                          {feature}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>

        </Stack>
      </Container>


      <Divider sx={{ my: 2 }} />

      {/* CLOSING SECTION */}
      <Box sx={{ py: 6 }}>
        <Container maxWidth="sm">
          <Stack spacing={5} textAlign="center" alignItems="center">
            <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.3, fontSize: { xs: "1.9rem", md: "2.6rem" } }}>
              Interviews are a skill.<br />Skills improve with practice and feedback.
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} justifyContent="center" sx={{ width: "100%" }}>
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

            <Button variant="contained" size="large" onClick={() => nav("/interview-config")} sx={{ px: 5, fontSize: 17, borderRadius: 2 }}>
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
          mt: { xs: 4, md: 6 },
          py: { xs: 4, md: 5 },
          textAlign: "center"
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: 56, sm: 96, md: 164 },
            fontWeight: 800,
            letterSpacing: 1.2,
            lineHeight: 0.9,
            opacity: 0.95,
            color: "white"
          }}
        >
          EvaluateYourself
        </Typography>
        <div style={{ width: "100%", marginTop: 12, marginBottom: 8 }}>
          <Divider sx={{ bgcolor: "white", opacity: 0.3, height: 2, width: "100%" }} />
        </div>
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
