import React from "react";
import { Route, Routes } from "react-router-dom";
import { fireEvent, screen } from "@testing-library/react";

import InterviewsPage from "../InterviewsPage";
import { renderWithFutureRouter } from "../../testUtils/renderWithFutureRouter";

describe("InterviewsPage", () => {
  test("shows demo-first copy and CTA in free access mode", () => {
    renderWithFutureRouter(
      <Routes>
        <Route path="/interviews" element={<InterviewsPage />} />
        <Route path="/interview-config" element={<div>Interview config</div>} />
      </Routes>,
      { initialEntries: ["/interviews"] },
    );

    expect(
      screen.getByText(/Start a live Sonia demo session immediately/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start Sonia Technical Demo/i }));

    expect(screen.getByText("Interview config")).toBeInTheDocument();
  });
});
