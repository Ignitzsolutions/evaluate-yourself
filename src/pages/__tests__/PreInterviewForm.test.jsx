import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

import PreInterviewForm from "../PreInterviewForm";
import { renderWithFutureRouter } from "../../testUtils/renderWithFutureRouter";

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

    renderWithFutureRouter(
      <Routes>
        <Route path="/interview-config" element={<PreInterviewForm />} />
      </Routes>,
      {
        initialEntries: [
          {
            pathname: "/interview-config",
            state: {
              type: "behavioral",
              recoveryMessage: "Previous interview session ended unexpectedly.",
            },
          },
        ],
      },
    );

    expect(await screen.findByText("Previous interview session ended unexpectedly.")).toBeInTheDocument();
    expect(screen.getByText("Sonia Demo Setup")).toBeInTheDocument();
    expect(screen.getByText(/Free access is active for the hosted beta demo/i)).toBeInTheDocument();
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

    renderWithFutureRouter(
      <Routes>
        <Route path="/interview-config" element={<PreInterviewForm />} />
      </Routes>,
      { initialEntries: [{ pathname: "/interview-config", state: { type: "technical" } }] },
    );

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalled();
    });
    expect(screen.getByRole("button", { name: "Start Sonia Demo" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Trial Code")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeem" })).not.toBeInTheDocument();
  });

  test("does not load stream catalog for behavioral interviews", async () => {
    renderWithFutureRouter(
      <Routes>
        <Route path="/interview-config" element={<PreInterviewForm />} />
      </Routes>,
      { initialEntries: [{ pathname: "/interview-config", state: { type: "behavioral" } }] },
    );

    expect(await screen.findByText(/I consent to session transcript storage/i)).toBeInTheDocument();
    expect(screen.queryByText(/Stream Selection/i)).not.toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  test("retries stream catalog loading for technical interviews", async () => {
    authFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: { get: () => "application/json" },
        json: async () => ({ detail: { message: "catalog unavailable" } }),
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tracks: [{ id: "algorithms", label: "Algorithms" }],
          suggested_defaults: [],
          selection_rules: { min: 0, max: 2 },
        }),
      });

    renderWithFutureRouter(
      <Routes>
        <Route path="/interview-config" element={<PreInterviewForm />} />
      </Routes>,
      { initialEntries: [{ pathname: "/interview-config", state: { type: "technical" } }] },
    );

    expect(await screen.findByRole("button", { name: /retry catalog/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry catalog/i }));
    expect(await screen.findByText("Algorithms")).toBeInTheDocument();
    expect(authFetch).toHaveBeenCalledTimes(2);
  });
});
