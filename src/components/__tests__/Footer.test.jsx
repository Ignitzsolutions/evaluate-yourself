import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Footer from "../Footer";

describe("Footer", () => {
  it("renders brand and legal copy", () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Evaluate Yourself/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
  });
});
