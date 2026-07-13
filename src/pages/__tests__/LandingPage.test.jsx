import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import LandingPage from "../LandingPage";

jest.mock("../../context/AuthContext", () => ({
  useUser: () => ({ isSignedIn: false, user: null }),
  useClerk: () => ({ signOut: jest.fn() }),
}));

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

describe("LandingPage", () => {
  test("renders the simplified hero summary copy", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /practice real interviews\. understand how you perform\. get interview-ready\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sonia is live/i)).toBeInTheDocument();
    expect(screen.getByText(/coach-grade score/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^start practicing$/i })).toHaveLength(2);
    expect(screen.getByText(/join the waitlist/i)).toBeInTheDocument();
  });
});
