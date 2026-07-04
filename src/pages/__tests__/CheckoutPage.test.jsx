import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CheckoutPage from "../CheckoutPage";

const originalEnv = process.env;
const originalLocation = window.location;

function renderCheckout(planKey = "pro") {
  return render(
    <MemoryRouter
      initialEntries={[`/checkout/${planKey}`]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/checkout/:planKey" element={<CheckoutPage />} />
        <Route path="/pricing" element={<div>Pricing route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete window.location;
    window.location = { ...originalLocation, assign: jest.fn(), origin: "http://localhost" };
  });

  afterEach(() => {
    process.env = originalEnv;
    window.location = originalLocation;
  });

  it("renders the selected plan with card, wallet, and UPI payment routes", () => {
    renderCheckout("pro");

    expect(screen.getByText(/Pay Evaluate Yourself/i)).toBeInTheDocument();
    expect(screen.getByText("Career Sprint")).toBeInTheDocument();
    expect(screen.getAllByText("₹1,499")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /^Card$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Link$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^UPI$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Mastercard/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows a configuration warning when no payment URL exists", () => {
    renderCheckout("basic");

    fireEvent.click(screen.getByRole("button", { name: /Continue to Card/i }));

    expect(screen.getByText(/Payment link is not configured/i)).toBeInTheDocument();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  test.each([
    ["card", /Continue to Card/i],
    ["link", /Continue to Link/i],
    ["upi", /Continue to UPI/i],
    ["apple_pay", /Continue to Apple Pay/i],
    ["google_pay", /Continue to Google Pay/i],
  ])("redirects %s through the shared provider URL", (method, submitButtonName) => {
    process.env.REACT_APP_PAYMENT_CHECKOUT_URL = "https://pay.example.com/checkout";
    renderCheckout("pro");

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "candidate@example.com" },
    });
    if (method !== "card") {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${method === "apple_pay" ? "Apple Pay" : method === "google_pay" ? "Google Pay" : method}$`, "i") }));
    }
    fireEvent.click(screen.getByRole("button", { name: submitButtonName }));

    expect(window.location.assign).toHaveBeenCalledWith(
      `https://pay.example.com/checkout?prefilled_email=candidate%40example.com&plan=pro&method=${method}&amount=%E2%82%B91%2C499&currency=INR`,
    );
  });
});
