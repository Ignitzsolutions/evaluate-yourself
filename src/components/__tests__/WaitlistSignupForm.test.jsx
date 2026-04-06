import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import WaitlistSignupForm from "../WaitlistSignupForm";

jest.mock("../../utils/apiClient", () => ({
  authFetch: jest.fn(),
}));

const { authFetch } = require("../../utils/apiClient");

describe("WaitlistSignupForm", () => {
  beforeEach(() => {
    authFetch.mockReset();
  });

  test("submits waitlist signup for landing", async () => {
    authFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "You have been added to the waitlist." }),
    });

    render(<WaitlistSignupForm sourcePage="landing" />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /join waitlist/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/waitlist"),
        null,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "user@example.com", source_page: "landing", intent: "free_trial" }),
        }),
      );
    });

    expect(await screen.findByText(/added to the waitlist/i)).toBeInTheDocument();
  });

  test("submits waitlist signup for pricing", async () => {
    authFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "You are already on the waitlist." }),
    });

    render(<WaitlistSignupForm sourcePage="pricing" />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /join waitlist/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/waitlist"),
        null,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "user@example.com", source_page: "pricing", intent: "free_trial" }),
        }),
      );
    });

    expect(await screen.findByText(/already on the waitlist/i)).toBeInTheDocument();
  });
});
