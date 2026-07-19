import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import {
  CheckRounded,
  GraphicEqRounded,
  InsightsRounded,
  PlayArrow,
  PsychologyRounded,
  QueryStatsRounded,
  RecordVoiceOverRounded,
  ShieldOutlined,
  TrendingUpRounded,
} from "@mui/icons-material";

import WaitlistSignupForm from "../components/WaitlistSignupForm";
import { useClerk, useUser } from "../context/AuthContext";
import { pricingPlans } from "../config/pricingConfig";
import "../ui.css";

const practiceSignals = [
  "Live interviewer-led sessions",
  "Technical, behavioral, and 360 tracks",
  "Evidence-backed report after every session",
];

const signalCards = [
  {
    icon: RecordVoiceOverRounded,
    title: "Conversation Quality",
    body: "Sonia listens for pacing, clarity, structure, and whether your answer actually resolves the question.",
  },
  {
    icon: PsychologyRounded,
    title: "Reasoning Depth",
    body: "Follow-ups pressure-test tradeoffs, assumptions, and the details that real interviewers probe.",
  },
  {
    icon: QueryStatsRounded,
    title: "Progress Evidence",
    body: "Reports connect transcript evidence to coaching priorities, not vague encouragement.",
  },
];

const reportRows = [
  { label: "Opening structure", value: "Strong", tone: "good" },
  { label: "Technical depth", value: "Needs proof", tone: "warn" },
  { label: "Pacing", value: "148 WPM", tone: "good" },
  { label: "Follow-up readiness", value: "Practice", tone: "neutral" },
];

const workflowSteps = [
  {
    step: "01",
    title: "Choose the round",
    body: "Pick behavioral, technical, or 360 interview setup with role context.",
  },
  {
    step: "02",
    title: "Talk to Sonia",
    body: "Answer naturally while the app tracks listening, speaking, transcript, and evidence state.",
  },
  {
    step: "03",
    title: "Review the report",
    body: "Use scored evidence, pacing notes, and next-practice priorities to improve.",
  },
];

export default function LandingPage() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 36);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const startPath = isSignedIn ? "/interviews" : "/interview-config";

  return (
    <div className="landing-page">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className={`landing-header ${isScrolled ? "is-scrolled" : ""}`}>
        <div className="landing-header-inner">
          <Link to="/" className="landing-brand" aria-label="Evaluate Yourself home">
            <img
              src="/assets/logo.png"
              alt="Evaluate Yourself logo"
              width="52"
              height="52"
              fetchpriority="high"
              className="landing-brand-logo"
            />
            <span className="landing-brand-copy">
              <strong translate="no">Evaluate Yourself</strong>
              <span>An Ignitz Product</span>
            </span>
          </Link>

          <nav className="landing-nav" aria-label="Primary">
            <a href="#how-it-works">How It Works</a>
            <a href="#report">Report</a>
            <Link to="/pricing">Pricing</Link>
          </nav>

          <div className="landing-actions">
            {!isSignedIn ? (
              <>
                <Link to="/login" className="landing-link-button">
                  Sign In
                </Link>
                <Link to="/register" className="landing-primary-link">
                  Create Account
                </Link>
              </>
            ) : (
              <>
                <button type="button" className="landing-link-button" onClick={() => navigate("/dashboard")}>
                  Go to App
                </button>
                <button type="button" className="landing-primary-link" onClick={signOut}>
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-shell landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-kicker">AI Interview Studio by Ignitz</p>
              <h1 id="landing-title">Practice real interviews. Understand how you perform. Get interview-ready.</h1>
              <p className="landing-lede">
                Evaluate Yourself gives candidates a live AI interviewer, structured evidence capture, and a coaching
                report that makes the next practice session obvious.
              </p>

              <div className="landing-cta-row">
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrow aria-hidden="true" />}
                  onClick={() => navigate(startPath)}
                >
                  Start Practicing
                </Button>
                <Button variant="outlined" size="large" onClick={() => navigate("/pricing")}>
                  View Pricing
                </Button>
              </div>

              <ul className="landing-proof-list" aria-label="Platform highlights">
                {practiceSignals.map((item) => (
                  <li key={item}>
                    <CheckRounded aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="landing-studio-card" aria-label="Interview studio preview">
              <div className="landing-studio-top">
                <div>
                  <span className="landing-status-dot" />
                  Sonia Is Live
                </div>
                <span>Round 1 · Technical</span>
              </div>
              <div className="landing-sonia-stage">
                <div className="landing-sonia-avatar" aria-hidden="true">
                  <GraphicEqRounded />
                </div>
                <div>
                  <p className="landing-stage-label">Sonia</p>
                  <h2>“Walk me through your approach before you optimize it.”</h2>
                </div>
              </div>
              <div className="landing-signal-grid">
                <div>
                  <span>Listening</span>
                  <strong>Active</strong>
                </div>
                <div>
                  <span>Evidence</span>
                  <strong>Trusted</strong>
                </div>
                <div>
                  <span>Next Turn</span>
                  <strong>Adaptive</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="signal-title">
          <div className="landing-shell">
            <div className="landing-section-heading">
              <p className="landing-kicker">What Gets Measured</p>
              <h2 id="signal-title">The interview feels live because the system watches the right signals.</h2>
            </div>

            <div className="landing-signal-cards">
              {signalCards.map(({ icon: Icon, title, body }) => (
                <article className="landing-signal-card" key={title}>
                  <Icon aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-report-section" id="report" aria-labelledby="report-title">
          <div className="landing-shell landing-report-grid">
            <div className="landing-section-heading">
              <p className="landing-kicker">Actionable Feedback Report</p>
              <h2 id="report-title">A report that shows what broke, what worked, and what to practice next.</h2>
              <p>
                No generic confidence score by itself. The report ties observations back to transcript, pacing, and
                interviewer-style expectations.
              </p>
            </div>

            <div className="landing-report-card">
              <div className="landing-report-header">
                <div>
                  <p>Session Breakdown</p>
                  <h3>Backend Engineer · System Design</h3>
                </div>
                <InsightsRounded aria-hidden="true" />
              </div>
              <div className="landing-report-score">
                <strong>74</strong>
                <span>Coach-Grade Score</span>
              </div>
              <div className="landing-report-rows">
                {reportRows.map((row) => (
                  <div className="landing-report-row" key={row.label}>
                    <span>{row.label}</span>
                    <strong className={`is-${row.tone}`}>{row.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="how-it-works" aria-labelledby="workflow-title">
          <div className="landing-shell">
            <div className="landing-section-heading is-centered">
              <p className="landing-kicker">Release-Ready Candidate Flow</p>
              <h2 id="workflow-title">One clear path from setup to report.</h2>
            </div>

            <div className="landing-workflow">
              {workflowSteps.map((item) => (
                <article className="landing-workflow-step" key={item.step}>
                  <span>{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-pricing-strip" aria-labelledby="pricing-title">
          <div className="landing-shell">
            <div className="landing-section-heading is-centered">
              <p className="landing-kicker">Plans</p>
              <h2 id="pricing-title">Start free, upgrade when you need deeper preparation.</h2>
            </div>

            <div className="landing-plan-row">
              {pricingPlans.map((plan) => (
                <article className={`landing-plan-card ${plan.highlighted ? "is-highlighted" : ""}`} key={plan.key}>
                  <p>{plan.tierLabel}</p>
                  <h3>{plan.name}</h3>
                  <strong>{plan.priceLabel}</strong>
                  <span>{plan.bestFor}</span>
                </article>
              ))}
            </div>

            {!isSignedIn && (
              <div className="landing-waitlist">
                <WaitlistSignupForm
                  sourcePage="landing"
                  intent="free_trial"
                  title="Want launch updates without creating an account?"
                  helperText="Join the waitlist for release notes, trial windows, and new interview tracks."
                />
              </div>
            )}
          </div>
        </section>

        <section className="landing-final-cta" aria-labelledby="final-title">
          <div className="landing-shell landing-final-inner">
            <ShieldOutlined aria-hidden="true" />
            <h2 id="final-title">Make tomorrow’s test run feel like a real candidate session.</h2>
            <p>Use the platform end to end: setup, live interview, saved evidence, and report review.</p>
            <Button variant="contained" size="large" startIcon={<TrendingUpRounded aria-hidden="true" />} onClick={() => navigate(startPath)}>
              Start Practicing
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
