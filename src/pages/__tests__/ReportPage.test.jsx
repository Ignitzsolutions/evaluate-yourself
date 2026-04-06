import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    window.open = jest.fn(() => ({ closed: false }));
    window.URL.createObjectURL = jest.fn(() => "blob:report");
    window.URL.revokeObjectURL = jest.fn();
  });

  it("shows invalid-session banner and hides AI feedback section", async () => {
    authFetch.mockImplementation(async (url) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: null }),
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
      <MemoryRouter initialEntries={["/report/session_1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Session invalid for scored evaluation/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/AI Interview Feedback/i)).not.toBeInTheDocument();
  });

  it("renders invalid paid-session state with remediation and observational gaze copy", async () => {
    authFetch.mockImplementation(async (url) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: { total_events: 0, eye_contact_pct: null } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: "r2",
          report_state: "invalid_no_candidate_audio_report",
          overall_score: 0,
          metrics: {
            capture_status: "INCOMPLETE_NO_CANDIDATE_AUDIO",
            total_duration: 1,
            total_words: 0,
            questions_answered: 0,
            contract_passed: true,
            validation_summary: { validity_score: 12, validity_label: "low" },
          },
          transcript: [
            { speaker: "ai", text: "Tell me about yourself", timestamp: "2026-03-11T00:00:00Z" },
          ],
          ai_feedback: {
            areas_for_improvement: [
              "Verify microphone permissions.",
              "Confirm candidate speech appears in the live transcript.",
            ],
          },
          hiring_recommendation: {
            label: "Hire",
            signal: "hire",
          },
        }),
      };
    });

    render(
      <MemoryRouter initialEntries={["/report/session_2"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Session invalid for scored evaluation/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Remediation Steps/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Observational only/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/^Hiring Recommendation$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Top Strengths/i)).not.toBeInTheDocument();
  });

  it("renders score proof section when score ledger is present", async () => {
    authFetch.mockImplementation(async (url) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: { total_events: 1, eye_contact_pct: 78 } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: "r3",
          report_state: "valid_scored_report",
          overall_score: 81,
          metrics: {
            capture_status: "COMPLETE",
            total_duration: 12,
            total_words: 180,
            questions_answered: 3,
            plan_tier: "paid",
            trial_mode: false,
            evaluation_explainability: {
              formula: "overall = ((clarity × 0.25) + (communication × 0.20) + (depth × 0.30) + (relevance × 0.25)) × 20",
              weights: { clarity: 0.25, communication: 0.2, depth: 0.3, relevance: 0.25 },
            },
            score_ledger: [
              {
                turn_id: 1,
                transcript_ref: "turn_1",
                question_text: "Walk me through a recent technical decision you owned.",
                included_in_score: true,
                weighted_points: 84,
                answer_word_count: 52,
                evidence_quote: "I reduced duplicate processing by 30 percent.",
                dimension_scores: { clarity: 4, communication: 4, depth: 5, relevance: 4 },
              },
            ],
            validation_summary: { validity_score: 88, validity_label: "high", trust_signals: ["Three turns were evaluated."] },
          },
          transcript: [
            { speaker: "ai", text: "Question", timestamp: "2026-03-11T00:00:00Z" },
            { speaker: "user", text: "Answer", timestamp: "2026-03-11T00:00:05Z" },
          ],
        }),
      };
    });

    render(
      <MemoryRouter initialEntries={["/report/session_3"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Scoring Evidence Ledger/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText((content) => /communication\s+20%/i.test(content))).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/Included • 84\/100/i)).toBeInTheDocument();
    });
  });

  it("reflects saved post-trial feedback from report metrics", async () => {
    authFetch.mockImplementation(async (url, token, options = {}) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: null }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: "r4",
          report_state: "valid_scored_report",
          overall_score: 70,
          metrics: {
            capture_status: "COMPLETE",
            total_duration: 5,
            total_words: 120,
            questions_answered: 2,
            session_feedback: {
              rating: 4,
              comment: "Useful session",
              submitted_at: "2026-03-11T00:00:10Z",
            },
          },
          transcript: [
            { speaker: "ai", text: "Question", timestamp: "2026-03-11T00:00:00Z" },
            { speaker: "user", text: "Answer", timestamp: "2026-03-11T00:00:05Z" },
          ],
        }),
      };
    });

    render(
      <MemoryRouter initialEntries={["/report/session_4"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Feedback submitted before ending session: 4\/5/i)).toBeInTheDocument();
    });
  });

  it("shows trial upgrade messaging and hides detailed evidence sections for trial reports", async () => {
    authFetch.mockImplementation(async (url) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: { calibration_valid: false, calibration_state: "calibrating" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: "r5",
          report_state: "valid_scored_report",
          overall_score: 63,
          metrics: {
            capture_status: "COMPLETE",
            total_duration: 5,
            total_words: 110,
            questions_answered: 2,
            plan_tier: "trial",
            trial_mode: true,
            score_ledger: [
              { turn_id: 1, transcript_ref: "turn_1", question_text: "Question", included_in_score: true },
            ],
          },
          ai_feedback: {
            overall_summary: "Clear baseline with room to sharpen examples.",
            strengths: ["Good structure"],
            areas_for_improvement: ["Add measurable outcomes"],
          },
          improvement_roadmap: [
            {
              competency: "communication",
              finding: "Answers need stronger evidence.",
              suggested_action: "Close each answer with outcome and ownership.",
            },
          ],
          transcript: [
            { speaker: "ai", text: "Question", timestamp: "2026-03-11T00:00:00Z" },
            { speaker: "user", text: "Answer", timestamp: "2026-03-11T00:00:05Z" },
          ],
        }),
      };
    });

    render(
      <MemoryRouter initialEntries={["/report/session_5"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Trial interview report/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Upgrade for full-length interviews/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: /Scoring Evidence Ledger/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Hiring Recommendation/i })).not.toBeInTheDocument();
  });

  it("opens the printable HTML artifact as the primary export path", async () => {
    authFetch.mockImplementation(async (url) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: null }),
        };
      }
      if (String(url).includes("/artifact?format=html")) {
        return {
          ok: true,
          text: async () => "<html><body>Printable report</body></html>",
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: "r6",
          report_state: "valid_scored_report",
          overall_score: 70,
          metrics: {
            capture_status: "COMPLETE",
            total_duration: 5,
            total_words: 120,
            questions_answered: 2,
            plan_tier: "paid",
            trial_mode: false,
          },
          transcript: [
            { speaker: "ai", text: "Question", timestamp: "2026-03-11T00:00:00Z" },
            { speaker: "user", text: "Answer", timestamp: "2026-03-11T00:00:05Z" },
          ],
        }),
      };
    });

    render(
      <MemoryRouter initialEntries={["/report/session_6"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open Printable Report/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Open Printable Report/i }));

    await waitFor(() => {
      expect(
        authFetch.mock.calls.some(([url]) => String(url).includes("/artifact?format=html")),
      ).toBe(true);
    });
    expect(window.open).toHaveBeenCalled();
  });

  it("shows a user-visible error when the printable artifact cannot be opened", async () => {
    authFetch.mockImplementation(async (url) => {
      if (String(url).includes("/gaze-events")) {
        return {
          ok: true,
          json: async () => ({ events: [], summary: null }),
        };
      }
      if (String(url).includes("/artifact?format=html")) {
        return {
          ok: false,
          status: 503,
          text: async () => "artifact unavailable",
        };
      }
      return {
        ok: true,
        json: async () => ({
          id: "r7",
          report_state: "valid_scored_report",
          overall_score: 68,
          metrics: {
            capture_status: "COMPLETE",
            total_duration: 5,
            total_words: 90,
            questions_answered: 2,
            plan_tier: "paid",
            trial_mode: false,
          },
          transcript: [
            { speaker: "ai", text: "Question", timestamp: "2026-03-11T00:00:00Z" },
            { speaker: "user", text: "Answer", timestamp: "2026-03-11T00:00:05Z" },
          ],
        }),
      };
    });

    render(
      <MemoryRouter initialEntries={["/report/session_7"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/report/:sessionId" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open Printable Report/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Open Printable Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Unable to open printable report \(503\)/i)).toBeInTheDocument();
    });
  });
});
