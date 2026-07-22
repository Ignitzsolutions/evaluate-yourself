import React from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

import OnboardingPage from "../OnboardingPage";
import { renderWithFutureRouter } from "../../testUtils/renderWithFutureRouter";

const mockGetToken = jest.fn().mockResolvedValue("token");
const mockNavigate = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    getToken: mockGetToken,
    isLoaded: true,
    isSignedIn: true,
  }),
}));

jest.mock("../../utils/apiClient", () => {
  const actual = jest.requireActual("../../utils/apiClient");
  return {
    ...actual,
    authFetch: jest.fn(),
  };
});

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const { authFetch } = require("../../utils/apiClient");

function renderOnboarding() {
  return renderWithFutureRouter(
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
    </Routes>,
    { initialEntries: ["/onboarding"] },
  );
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    authFetch.mockReset();
    mockGetToken.mockClear();
    mockNavigate.mockClear();
    localStorage.clear();
  });

  test("saves fast-start profile with optional contact consent unchecked", async () => {
    authFetch
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        text: async () => "",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    renderOnboarding();

    expect(await screen.findByText(/Fast Start/i)).toBeInTheDocument();
    expect(screen.queryByText("python_fundamentals")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Job switch"));
    fireEvent.click(screen.getByText("SDE"));
    fireEvent.click(screen.getByText("Growth"));
    fireEvent.click(screen.getByText("Technical"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByLabelText(/Region \/ State/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Region \/ State/i), { target: { value: "California" } });
    fireEvent.change(screen.getByLabelText(/Current title/i), { target: { value: "Frontend Engineer" } });
    fireEvent.change(screen.getByLabelText(/Years of experience/i), { target: { value: "4" } });

    fireEvent.click(within(screen.getByText("Python fundamentals").closest("div")).getByLabelText("4 Stars"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText(/Contact consent is optional/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/I consent to profile and interview data usage/i));
    fireEvent.click(screen.getByRole("button", { name: /Complete Setup/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledTimes(2);
    });

    const [, , saveOptions] = authFetch.mock.calls[1];
    const payload = JSON.parse(saveOptions.body);
    expect(payload).toEqual(
      expect.objectContaining({
        consentDataUse: true,
        consentContact: false,
        stateCode: "California",
        currentRole: "Frontend Engineer",
        experienceBand: "4 years",
        careerCompBand: "Growth",
        primaryStream: "python_fundamentals",
      }),
    );
    expect(payload.domainExpertise).toEqual(["Python fundamentals (4/5)"]);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});
