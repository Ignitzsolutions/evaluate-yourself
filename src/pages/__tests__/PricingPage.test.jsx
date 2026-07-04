import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import PricingPage from "../PricingPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

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
    expect(screen.getByText(/Join the free-trial waitlist/i)).toBeInTheDocument();
    expect(screen.getByText(/Most popular/i)).toBeInTheDocument();
    expect(screen.getByText(/Included in every plan/i)).toBeInTheDocument();
    expect(screen.getByText("₹499")).toBeInTheDocument();
    expect(screen.getByText("₹1,499")).toBeInTheDocument();
    expect(screen.getByText("₹7,999")).toBeInTheDocument();
  });

  test.each([
    ["Start Launchpad", "/checkout/basic"],
    ["Start Career Sprint", "/checkout/pro"],
    ["Contact Sales", "/checkout/enterprise"],
  ])("routes %s to %s", (buttonLabel, expectedPath) => {
    render(
      <MemoryRouter
        initialEntries={["/pricing"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/pricing" element={<><PricingPage /><LocationProbe /></>} />
          <Route path="/checkout/:planKey" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: buttonLabel }));

    expect(screen.getByTestId("location")).toHaveTextContent(expectedPath);
  });

  it("renders included and excluded capability states with accessible Material icons", () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <PricingPage />
      </MemoryRouter>
    );

    expect(
      screen.getByLabelText("Technical depth analysis not included")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Team and cohort workspace included")
    ).toBeInTheDocument();
    expect(screen.queryByText(/⭐/)).not.toBeInTheDocument();
  });

  it("routes the comparison helper to the pro checkout", () => {
    render(
      <MemoryRouter
        initialEntries={["/pricing"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/pricing" element={<><PricingPage /><LocationProbe /></>} />
          <Route path="/checkout/:planKey" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Compare from Career Sprint/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/checkout/pro");
  });
});
