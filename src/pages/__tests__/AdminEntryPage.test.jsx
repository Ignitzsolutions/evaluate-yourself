import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AdminEntryPage from "../AdminEntryPage";

jest.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: jest.fn().mockResolvedValue("token"),
  }),
}));

jest.mock("../../utils/devAuthBypass", () => ({
  isDevAuthBypassEnabled: () => false,
}));

jest.mock("../../utils/apiClient", () => ({
  authFetch: jest.fn(),
  getApiErrorMessage: jest.fn((error) => error.message),
  isBackendUnavailableError: jest.fn((error) => error?.code === "BACKEND_UNAVAILABLE"),
}));

const { authFetch } = require("../../utils/apiClient");

describe("AdminEntryPage", () => {
  beforeEach(() => {
    authFetch.mockReset();
  });

  test("routes admins directly to the dashboard", async () => {
    authFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ is_admin: true }),
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminEntryPage />} />
          <Route path="/admin/dashboard" element={<div>Admin dashboard</div>} />
          <Route path="/admin/login" element={<div>Admin login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Admin login")).not.toBeInTheDocument();
  });

  test("renders retryable state for generic verification failures", async () => {
    authFetch.mockRejectedValueOnce(new Error("admin verification failed"));

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminEntryPage />} />
          <Route path="/admin/dashboard" element={<div>Admin dashboard</div>} />
          <Route path="/admin/login" element={<div>Admin login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Admin Access Check Failed/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });
});
