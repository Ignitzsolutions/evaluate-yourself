import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Container, Stack, Typography, Link } from "@mui/material";
import MacbookStage from "../components/presentation/MacbookStage";
import PresentationScreen from "../components/presentation/PresentationScreen";
import {
  contactCards,
  notableLines,
  presentationSlides,
} from "../config/presentationContent";
import "./presentation.css";

function SlideActions({ actions = [] }) {
  if (!actions.length) return null;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
      {actions.map((action) => (
        <Button
          key={action.label}
          component={RouterLink}
          to={action.to}
          variant={action.variant === "secondary" ? "outlined" : "contained"}
          className={`presentation-cta presentation-cta-${action.variant || "primary"}`}
        >
          {action.label}
        </Button>
      ))}
    </Stack>
  );
}

function SlideTitle({ segments = [], isHero }) {
  return (
    <Typography variant={isHero ? "h1" : "h2"} className="presentation-title">
      {segments.map((segment) => (
        <Box
          key={`${segment.text}-${segment.tone}`}
          component="span"
          className={`presentation-title-segment presentation-title-segment-${segment.tone || "plain"}`}
        >
          {segment.text}{" "}
        </Box>
      ))}
    </Typography>
  );
}

function SlideSection({ slide, index }) {
  const isHero = slide.id === "hero";
  const hasScreen = Boolean(slide.screen);
  const isContact = slide.id === "contact";

  return (
    <Box
      component="section"
      id={slide.id}
      aria-label={`Slide ${index + 1}: ${slide.titleSegments?.map((item) => item.text).join(" ") || slide.id}`}
      className={`presentation-slide presentation-slide-${slide.id}`}
    >
      <Container maxWidth="xl" className="presentation-slide-inner">
        <Box className="presentation-slide-grid">
          <Stack spacing={3} className="presentation-copy">
            <Typography className="presentation-eyebrow">{slide.eyebrow}</Typography>
            <SlideTitle segments={slide.titleSegments} isHero={isHero} />
            <Typography className="presentation-body">{slide.body}</Typography>
            {slide.quote ? (
              <Typography className="presentation-quote">“{slide.quote}”</Typography>
            ) : null}
            {slide.bullets?.length ? (
              <Box className="presentation-bullet-row">
                {slide.bullets.map((bullet) => (
                  <Typography key={bullet} className="presentation-bullet-pill">
                    {bullet}
                  </Typography>
                ))}
              </Box>
            ) : null}
            {slide.actions ? <SlideActions actions={slide.actions} /> : null}
            {isContact ? (
              <Box className="presentation-contact-grid">
                {contactCards.map((card) => (
                  <Box key={card.name} className="presentation-contact-card">
                    <Typography className="presentation-contact-name">{card.name}</Typography>
                    <Typography className="presentation-contact-role">{card.role}</Typography>
                    <Link href={card.linkedin} target="_blank" rel="noreferrer" className="presentation-contact-link">
                      LinkedIn
                    </Link>
                    <Link href={`mailto:${card.email}`} className="presentation-contact-link">
                      {card.email}
                    </Link>
                  </Box>
                ))}
              </Box>
            ) : null}
          </Stack>

          <Box className="presentation-visual">
            {hasScreen ? (
              <MacbookStage caption={slide.caption} title="Evaluate Yourself">
                <PresentationScreen variant={slide.screen} />
              </MacbookStage>
            ) : isContact ? (
              <Box className="presentation-closing-panel">
                <Typography className="presentation-closing-label">Thanks and greetings</Typography>
                <Typography className="presentation-closing-title">Connect with us. Follow to know more.</Typography>
                <Typography className="presentation-closing-copy">
                  We are building a sharper, more confident interview preparation experience. Reach out for demos, product conversations, and publishing opportunities.
                </Typography>
              </Box>
            ) : (
              <Box className="presentation-notable-panel">
                <Typography className="presentation-panel-label">Notable Lines</Typography>
                <Stack spacing={1.5}>
                  {notableLines.slice(index % 3, index % 3 + 4).map((line) => (
                    <Typography key={line} className="presentation-panel-line">
                      {line}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default function PresentationPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = presentationSlides[activeIndex];
  const isFirstSlide = activeIndex === 0;
  const isLastSlide = activeIndex === presentationSlides.length - 1;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        setActiveIndex((current) => Math.min(current + 1, presentationSlides.length - 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setActiveIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDownload = () => {
    window.print();
  };

  return (
    <Box className="presentation-page">
      <Box className="presentation-company-badge">
        <Box
          component="img"
          src="/assets/brand/ignitz-logo.png"
          alt="Ignitz logo"
          className="presentation-company-logo"
        />
      </Box>
      <Box className="presentation-progress" aria-label="Presentation slide selector">
        {presentationSlides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={`presentation-progress-dot ${index === activeIndex ? "is-active" : ""}`}
            onClick={() => setActiveIndex(index)}
            aria-label={`Go to slide ${index + 1}`}
          >
            <span />
          </button>
        ))}
      </Box>

      <Box className="presentation-stage">
        <SlideSection slide={activeSlide} index={activeIndex} />
      </Box>

      <Box className="presentation-controls">
        <Box className="presentation-controls-meta">
          <Typography className="presentation-controls-label">
            {activeSlide.eyebrow}
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
          <Button
            type="button"
            variant="outlined"
            className="presentation-nav-button presentation-nav-button-secondary"
            onClick={() => setActiveIndex((current) => Math.max(current - 1, 0))}
            disabled={isFirstSlide}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outlined"
            className="presentation-nav-button presentation-nav-button-secondary"
            onClick={handleDownload}
          >
            Download Presentation
          </Button>
          <Button
            type="button"
            variant="contained"
            className="presentation-nav-button presentation-nav-button-primary"
            onClick={() =>
              setActiveIndex((current) => Math.min(current + 1, presentationSlides.length - 1))
            }
            disabled={isLastSlide}
          >
            Next
          </Button>
        </Stack>
      </Box>

      <Box className="presentation-print-deck" aria-hidden="true">
        {presentationSlides.map((slide, index) => (
          <SlideSection key={slide.id} slide={slide} index={index} />
        ))}
      </Box>
    </Box>
  );
}
