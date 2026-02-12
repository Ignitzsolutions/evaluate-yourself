import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PricingPage from "../PricingPage";

describe("PricingPage", () => {
  it("renders free trial and plan pricing matrix", () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <PricingPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Try Free for 5 Minutes/i)).toBeInTheDocument();
    expect(screen.getByText("₹499")).toBeInTheDocument();
    expect(screen.getByText("₹1,499")).toBeInTheDocument();
    expect(screen.getByText("₹7,999")).toBeInTheDocument();
  });
});
