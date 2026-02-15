import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ReportPage from "../ReportPage";

jest.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: jest.fn().mockResolvedValue("test-token"),
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
  });

  it("shows incomplete capture banner and hides AI feedback section", async () => {
    authFetch.mockResolvedValue({
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
    });

    render(
      <MemoryRouter initialEntries={["/report/session_1"]}>
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
});
