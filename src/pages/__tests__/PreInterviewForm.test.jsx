import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import PreInterviewForm from "../PreInterviewForm";

const mockGetToken = jest.fn().mockResolvedValue("token");

jest.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

jest.mock("../../utils/apiClient", () => {
  const actual = jest.requireActual("../../utils/apiClient");
  return {
    ...actual,
    authFetch: jest.fn(),
  };
});

const { authFetch } = require("../../utils/apiClient");

describe("PreInterviewForm", () => {
  beforeEach(() => {
    authFetch.mockReset();
    mockGetToken.mockClear();
    sessionStorage.clear();
  });

  test("restores saved interview config and shows startup recovery message", async () => {
    sessionStorage.setItem(
      "interviewConfig",
      JSON.stringify({
        type: "behavioral",
        duration: 30,
        difficulty: "medium",
        role: "Backend Engineer",
        company: "OpenAI",
        questionMix: "balanced",
        interviewStyle: "neutral",
        transcriptConsent: true,
        selectedSkills: ["algorithms"],
      }),
    );

    authFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tracks: [{ id: "algorithms", label: "Algorithms" }],
        suggested_defaults: [],
        selection_rules: { min: 0, max: 2 },
      }),
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/interview-config",
            state: {
              type: "behavioral",
              recoveryMessage: "Previous interview session ended unexpectedly.",
            },
          },
        ]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/interview-config" element={<PreInterviewForm />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Previous interview session ended unexpectedly.")).toBeInTheDocument();
    expect(screen.getByText(/Free access is active/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Target Role")).toHaveValue("Backend Engineer");
    });
    expect(screen.getByLabelText("Target Company")).toHaveValue("OpenAI");
    expect(screen.queryByLabelText("Trial Code")).not.toBeInTheDocument();
  });

  test("hides trial code controls in free access mode", async () => {
    authFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tracks: [],
        suggested_defaults: [],
        selection_rules: { min: 0, max: 0 },
      }),
    });

    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/interview-config", state: { type: "technical" } }]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/interview-config" element={<PreInterviewForm />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalled();
    });
    expect(screen.queryByLabelText("Trial Code")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeem" })).not.toBeInTheDocument();
  });
});
