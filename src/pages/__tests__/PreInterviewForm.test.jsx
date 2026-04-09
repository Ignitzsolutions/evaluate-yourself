import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
        duration: 5,
        difficulty: "medium",
        role: "Backend Engineer",
        company: "OpenAI",
        questionMix: "balanced",
        interviewStyle: "neutral",
        transcriptConsent: true,
        trialCode: "TRY-READY",
        trialEntitlement: {
          plan_tier: "trial",
          duration_minutes_effective: 5,
          is_active: true,
        },
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
              recoveryMessage: "Redeem a valid trial code before starting.",
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

    expect(await screen.findByText("Redeem a valid trial code before starting.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Target Role")).toHaveValue("Backend Engineer");
    });
    expect(screen.getByLabelText("Target Company")).toHaveValue("OpenAI");
    expect(screen.getByLabelText("Trial Code")).toHaveValue("TRY-READY");
  });

  test("renders structured redeem failures as inline feedback", async () => {
    authFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tracks: [],
          suggested_defaults: [],
          selection_rules: { min: 0, max: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            detail: {
              code: "TRIAL_CODE_ALREADY_REDEEMED",
              message: "Trial code already redeemed",
              retryable: false,
            },
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

    fireEvent.change(await screen.findByLabelText("Trial Code"), {
      target: { value: "TRY-TAKEN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Redeem" }));

    await waitFor(() => {
      const redeemCall = authFetch.mock.calls.find(([url]) =>
        String(url).includes("/api/trial-codes/redeem"),
      );
      expect(redeemCall).toBeTruthy();
      expect(redeemCall[2]).toEqual(expect.objectContaining({ method: "POST" }));
    });
    expect(await screen.findByText("Trial code already redeemed")).toBeInTheDocument();
  });
});
