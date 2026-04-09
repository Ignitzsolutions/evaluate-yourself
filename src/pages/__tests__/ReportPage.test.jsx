import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ReportPage from "../ReportPage";

const mockGetToken = jest.fn().mockResolvedValue("test-token");

jest.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

jest.mock("../../utils/apiClient", () => ({
  authFetch: jest.fn(),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const { authFetch } = require("../../utils/apiClient");

describe("ReportPage", () => {
  beforeEach(() => {
    authFetch.mockReset();
    mockGetToken.mockClear();
  });

  it("shows incomplete capture banner and hides AI feedback section", async () => {
    authFetch.mockImplementation(async (url) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: {} }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: "r1",
          metrics: {
            capture_status: "INCOMPLETE_NO_CANDIDATE_AUDIO",
            total_duration: 1,
            total_words: 0,
            questions_answered: 0,
          },
          transcript: [
            { speaker: "ai", text: "Hello, I'm Sonia", timestamp: "2026-02-14T00:00:00Z" },
          ],
          ai_feedback: {
            overall_summary: "Should not render for incomplete",
          },
        }),
      };
    });

    render(
      <MemoryRouter
        initialEntries={["/report/session_1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Evaluation incomplete/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/AI Interview Feedback/i)).not.toBeInTheDocument();
  });

  it("shows a mixed-evidence warning when fallback transcript was excluded from trusted scoring", async () => {
    authFetch.mockImplementation(async (url) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: {} }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: "r2",
          metrics: {
            capture_status: "COMPLETE",
            score_trust_level: "mixed_evidence",
            capture_integrity: {
              trusted_candidate_turn_count: 1,
              fallback_candidate_turn_count: 1,
            },
            total_duration: 2,
            total_words: 42,
            questions_answered: 2,
          },
          transcript: [
            { speaker: "ai", text: "Tell me about a recent challenge", timestamp: "2026-02-14T00:00:00Z" },
            { speaker: "user", text: "Trusted answer", timestamp: "2026-02-14T00:00:10Z" },
          ],
          ai_feedback: null,
        }),
      };
    });

    render(
      <MemoryRouter
        initialEntries={["/report/session_2"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Mixed transcript evidence detected/i)).toBeInTheDocument();
    expect(screen.getByText("mixed_evidence")).toBeInTheDocument();
    expect(screen.getByText(/Fallback candidate turns:/i)).toBeInTheDocument();
  });

  it("renders communication signals and confidence score from trusted transcript analytics", async () => {
    authFetch.mockImplementation(async (url) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: { eye_contact_pct: 87, total_events: 1 } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: "r3",
          overall_score: 84,
          metrics: {
            capture_status: "COMPLETE",
            score_trust_level: "trusted",
            confidence_score: 88,
            communication_signals: {
              pacing_band: "ideal",
              filler_word_count: 2,
              filler_words_per_100: 1.8,
              quality_flags: ["MODERATE_FILLER_DENSITY"],
            },
            total_duration: 3,
            total_words: 120,
            questions_answered: 3,
          },
          transcript: [
            { speaker: "ai", text: "Question", timestamp: "2026-02-14T00:00:00Z" },
            { speaker: "user", text: "Answer", timestamp: "2026-02-14T00:00:08Z" },
          ],
          ai_feedback: null,
        }),
      };
    });

    render(
      <MemoryRouter
        initialEntries={["/report/session_3"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Communication Signals/i)).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("ideal")).toBeInTheDocument();
    expect(screen.getByText("MODERATE_FILLER_DENSITY")).toBeInTheDocument();
  });
});
