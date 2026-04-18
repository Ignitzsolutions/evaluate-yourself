import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

import OnboardingGuard from "../OnboardingGuard";
import { renderWithFutureRouter } from "../../testUtils/renderWithFutureRouter";

const mockGetToken = jest.fn();

jest.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: mockGetToken,
    isLoaded: true,
  }),
}));

jest.mock("../../utils/devAuthBypass", () => ({
  isDevAuthBypassEnabled: () => false,
}));

jest.mock("../../utils/apiClient", () => {
  const actual = jest.requireActual("../../utils/apiClient");
  return {
    ...actual,
    authFetch: jest.fn(),
  };
});

const { authFetch } = require("../../utils/apiClient");

describe("OnboardingGuard", () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    authFetch.mockReset();
  });

  it("renders backend unavailable state when profile status check cannot reach the backend", async () => {
    mockGetToken.mockResolvedValue("token");
    authFetch.mockRejectedValue(Object.assign(new Error("offline"), { code: "BACKEND_UNAVAILABLE" }));

    renderWithFutureRouter(
      <Routes>
        <Route
          path="/dashboard"
          element={
            <OnboardingGuard>
              <div>Protected content</div>
            </OnboardingGuard>
          }
        />
      </Routes>,
      { initialEntries: ["/dashboard"] },
    );

    expect(await screen.findByText(/Profile Service Unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to login when authentication is missing", async () => {
    mockGetToken.mockResolvedValue(null);

    renderWithFutureRouter(
      <Routes>
        <Route
          path="/dashboard"
          element={
            <OnboardingGuard>
              <div>Protected content</div>
            </OnboardingGuard>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      { initialEntries: ["/dashboard"] },
    );

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("renders retryable generic error state for non-auth onboarding failures", async () => {
    mockGetToken.mockResolvedValue("token");
    authFetch.mockRejectedValue(new Error("unexpected failure"));

    authFetch.mockRejectedValueOnce(new Error("unexpected failure")).mockRejectedValueOnce(new Error("unexpected failure"));

    renderWithFutureRouter(
      <Routes>
        <Route
          path="/dashboard"
          element={
            <OnboardingGuard>
              <div>Protected content</div>
            </OnboardingGuard>
          }
        />
      </Routes>,
      { initialEntries: ["/dashboard"] },
    );

    expect(await screen.findByText(/couldn't verify your onboarding status/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledTimes(2);
    });
  });

  it("offers interview-safe navigation when onboarding verification fails on interview routes", async () => {
    mockGetToken.mockResolvedValue("token");
    authFetch.mockRejectedValue(new Error("unexpected failure"));

    renderWithFutureRouter(
      <Routes>
        <Route
          path="/interview/session/:sessionId"
          element={
            <OnboardingGuard>
              <div>Protected content</div>
            </OnboardingGuard>
          }
        />
      </Routes>,
      { initialEntries: ["/interview/session/test-session"] },
    );

    expect(await screen.findByRole("button", { name: /Back to Interviews/i })).toBeInTheDocument();
  });
});
