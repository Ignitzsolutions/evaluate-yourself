import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import LandingPage from "../LandingPage";

jest.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ isSignedIn: false }),
  useClerk: () => ({ signOut: jest.fn() }),
}));

describe("LandingPage", () => {
  test("renders the simplified hero summary copy", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /practice real interviews\. understand how you perform\. get interview-ready\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/structured practice with a clear before-and-after view/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^start practicing$/i })).toBeInTheDocument();
    expect(screen.getByText(/join the launch waitlist/i)).toBeInTheDocument();
  });
});
