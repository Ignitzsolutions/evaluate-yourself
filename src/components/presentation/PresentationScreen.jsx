import React from "react";
import { Box, Stack, Typography } from "@mui/material";

function Pill({ children, tone = "default" }) {
  return (
    <Typography className={`presentation-screen-pill presentation-screen-pill-${tone}`}>
      {children}
    </Typography>
  );
}

function Metric({ label, value, tone = "blue" }) {
  return (
    <Box className="presentation-screen-metric">
      <Typography className="presentation-screen-metric-label">{label}</Typography>
      <Typography className={`presentation-screen-metric-value presentation-screen-metric-value-${tone}`}>
        {value}
      </Typography>
    </Box>
  );
}

function ProgressRow({ label, value, width }) {
  return (
    <Box className="presentation-screen-progress-row">
      <Box className="presentation-screen-progress-meta">
        <Typography className="presentation-screen-progress-label">{label}</Typography>
        <Typography className="presentation-screen-progress-number">{value}</Typography>
      </Box>
      <Box className="presentation-screen-progress-track">
        <Box className="presentation-screen-progress-fill" sx={{ width }} />
      </Box>
    </Box>
  );
}

export default function PresentationScreen({ variant }) {
  if (variant === "hero") {
    return (
      <Box className="presentation-screen presentation-screen-hero-image">
        <Box
          component="img"
          src="/assets/skillevaluation.png"
          alt="Evaluate Yourself product overview"
          className="presentation-screen-product-image"
        />
      </Box>
    );
  }

  if (variant === "studio") {
    return (
      <Box className="presentation-screen presentation-screen-studio">
        <Box className="presentation-screen-row">
          <Box className="presentation-screen-card presentation-screen-card-large">
            <Typography className="presentation-screen-card-kicker">Interview setup</Typography>
            <Typography className="presentation-screen-card-title">Choose the exact round you want to practice.</Typography>
            <Stack direction="row" spacing={1.2} className="presentation-screen-pill-row">
              <Pill>25-45 min</Pill>
              <Pill tone="soft">Adaptive</Pill>
              <Pill tone="soft">Role-based</Pill>
            </Stack>
          </Box>
          <Box className="presentation-screen-card">
            <Typography className="presentation-screen-card-kicker">Modes</Typography>
            <Typography className="presentation-screen-mini-list">Technical</Typography>
            <Typography className="presentation-screen-mini-list">Behavioral</Typography>
            <Typography className="presentation-screen-mini-list">360 interview</Typography>
          </Box>
        </Box>
        <Box className="presentation-screen-card presentation-screen-card-glass">
          <Typography className="presentation-screen-card-kicker">Candidate view</Typography>
          <Typography className="presentation-screen-card-title">The flow feels formal, useful, and focused.</Typography>
          <Typography className="presentation-screen-card-copy">
            The screen avoids clutter so the candidate can stay with the question instead of the interface.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (variant === "sonia") {
    return (
      <Box className="presentation-screen presentation-screen-sonia">
        <Box className="presentation-screen-avatar-card">
          <Box
            component="img"
            src="/assets/presentation/sonia-avatar.png"
            alt="Sonia AI interviewer portrait"
            className="presentation-screen-avatar-image"
          />
          <Typography className="presentation-screen-avatar-name">Sonia</Typography>
          <Typography className="presentation-screen-avatar-role">AI interviewer</Typography>
        </Box>
        <Box className="presentation-screen-conversation">
          <Box className="presentation-screen-message presentation-screen-message-ai">
            Tell me about a time you solved a difficult problem under pressure.
          </Box>
          <Box className="presentation-screen-message presentation-screen-message-user">
            I start by clarifying the failure mode, then isolate the system bottleneck before proposing fixes.
          </Box>
          <Box className="presentation-screen-message presentation-screen-message-ai">
            Good. Walk me through the tradeoff you chose and why it was right for that moment.
          </Box>
        </Box>
      </Box>
    );
  }

  if (variant === "signals") {
    return (
      <Box className="presentation-screen presentation-screen-signals">
        <Box className="presentation-screen-card presentation-screen-card-large">
          <Typography className="presentation-screen-card-kicker">Live coaching layer</Typography>
          <ProgressRow label="Communication flow" value="84/100" width="84%" />
          <ProgressRow label="Technical depth" value="76/100" width="76%" />
          <ProgressRow label="Confidence under pressure" value="82/100" width="82%" />
          <ProgressRow label="Focus and gaze" value="74/100" width="74%" />
        </Box>
        <Box className="presentation-screen-card">
          <Typography className="presentation-screen-card-kicker">Signals captured</Typography>
          <Typography className="presentation-screen-mini-list">Pace and structure</Typography>
          <Typography className="presentation-screen-mini-list">Clarity of explanation</Typography>
          <Typography className="presentation-screen-mini-list">Presence and delivery</Typography>
        </Box>
      </Box>
    );
  }

  if (variant === "report") {
    return (
      <Box className="presentation-screen presentation-screen-report">
        <Box className="presentation-screen-row">
          <Box className="presentation-screen-card">
            <Metric label="Overall score" value="84/100" />
          </Box>
          <Box className="presentation-screen-card">
            <Metric label="Report status" value="Ready" tone="green" />
          </Box>
        </Box>
        <Box className="presentation-screen-card presentation-screen-card-large">
          <Typography className="presentation-screen-card-kicker">What to improve next</Typography>
          <Typography className="presentation-screen-card-title">Tighter openings. Stronger examples. Cleaner structure.</Typography>
          <Typography className="presentation-screen-card-copy">
            The report explains where the response was strong, where it drifted, and what to practice in the next round.
          </Typography>
        </Box>
        <Box className="presentation-screen-card presentation-screen-card-glass">
          <Typography className="presentation-screen-mini-list">Evidence-backed breakdowns</Typography>
          <Typography className="presentation-screen-mini-list">Patterns across the session</Typography>
          <Typography className="presentation-screen-mini-list">Specific next-session guidance</Typography>
        </Box>
      </Box>
    );
  }

  if (variant === "coverage") {
    return (
      <Box className="presentation-screen presentation-screen-coverage">
        <Box className="presentation-screen-mode-card presentation-screen-mode-card-blue">
          <Typography className="presentation-screen-mode-title">Technical</Typography>
          <Typography className="presentation-screen-mode-copy">Concepts, system thinking, and problem solving.</Typography>
        </Box>
        <Box className="presentation-screen-mode-card presentation-screen-mode-card-green">
          <Typography className="presentation-screen-mode-title">Behavioral</Typography>
          <Typography className="presentation-screen-mode-copy">Stories, structure, and communication under pressure.</Typography>
        </Box>
        <Box className="presentation-screen-mode-card presentation-screen-mode-card-amber">
          <Typography className="presentation-screen-mode-title">360 Interview</Typography>
          <Typography className="presentation-screen-mode-copy">A blended round that mirrors real interview variety.</Typography>
        </Box>
      </Box>
    );
  }

  if (variant === "loop") {
    return (
      <Box className="presentation-screen presentation-screen-loop">
        <Box className="presentation-screen-loop-step">
          <span>1</span>
          <Typography>Practice</Typography>
        </Box>
        <Box className="presentation-screen-loop-step">
          <span>2</span>
          <Typography>Review</Typography>
        </Box>
        <Box className="presentation-screen-loop-step">
          <span>3</span>
          <Typography>Refine</Typography>
        </Box>
        <Box className="presentation-screen-loop-step">
          <span>4</span>
          <Typography>Repeat</Typography>
        </Box>
      </Box>
    );
  }

  if (variant === "waitlist") {
    return (
      <Box className="presentation-screen presentation-screen-waitlist">
        <Box className="presentation-screen-waitlist-hero">
          <Typography className="presentation-screen-waitlist-badge">
            Try Free for 5 Minutes
          </Typography>
          <Typography className="presentation-screen-waitlist-title">
            Pricing That Scales With Interview Goals
          </Typography>
          <Typography className="presentation-screen-waitlist-copy">
            Join the free-trial waitlist and leave your email to get notified when new
            5-minute trial slots open.
          </Typography>
          <Box className="presentation-screen-waitlist-form">
            <Typography className="presentation-screen-waitlist-input">
              Email
            </Typography>
            <Typography className="presentation-screen-waitlist-button">
              Join waitlist
            </Typography>
          </Box>
        </Box>
        <Box className="presentation-screen-waitlist-pricing">
          <Box className="presentation-screen-price-card">
            <Typography className="presentation-screen-price-tier">Launchpad</Typography>
            <Typography className="presentation-screen-price-value">₹499</Typography>
            <Typography className="presentation-screen-price-copy">
              For students and early job seekers
            </Typography>
          </Box>
          <Box className="presentation-screen-price-card presentation-screen-price-card-featured">
            <Typography className="presentation-screen-price-tier">Career Sprint</Typography>
            <Typography className="presentation-screen-price-value">₹1,499</Typography>
            <Typography className="presentation-screen-price-copy">
              For serious interview preparation
            </Typography>
          </Box>
          <Box className="presentation-screen-price-card">
            <Typography className="presentation-screen-price-tier">Talent Grid</Typography>
            <Typography className="presentation-screen-price-value">₹7,999</Typography>
            <Typography className="presentation-screen-price-copy">
              For institutions and hiring teams
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="presentation-screen presentation-screen-quote">
      <Typography className="presentation-screen-quote-line">
        Interview is not a process to impress.
      </Typography>
      <Typography className="presentation-screen-quote-line presentation-screen-quote-line-soft">
        It is a process of engaging and presenting yourself with confidence.
      </Typography>
    </Box>
  );
}
