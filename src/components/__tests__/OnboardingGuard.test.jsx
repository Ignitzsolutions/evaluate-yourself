import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import OnboardingGuard from "../OnboardingGuard";

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

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <OnboardingGuard>
                <div>Protected content</div>
              </OnboardingGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Profile Service Unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to login when authentication is missing", async () => {
    mockGetToken.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={["/dashboard"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });
});
