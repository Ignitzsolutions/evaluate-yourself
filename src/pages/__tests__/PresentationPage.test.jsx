import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import PresentationPage from "../PresentationPage";

describe("PresentationPage", () => {
  test("renders the presentation deck with all slides and final contacts", () => {
    render(
      <MemoryRouter>
        <PresentationPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /practice the interview before it matters\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download presentation/i })).toBeInTheDocument();
    expect(screen.getByAltText(/ignitz logo/i)).toBeInTheDocument();
    expect(screen.queryByText(/slide 1 of 10/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/product overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/the first screen now uses the actual product visual/i)).not.toBeInTheDocument();
    expect(screen.getByText(/join the waitlist/i)).toBeInTheDocument();
    expect(screen.queryByText(/a simple white-stage product reveal with restrained liquid-glass panels\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/a direct product view of sonia guiding the conversation with clean message pacing\./i)).not.toBeInTheDocument();

    expect(document.querySelectorAll("section.presentation-slide")).toHaveLength(12);
  });
});
