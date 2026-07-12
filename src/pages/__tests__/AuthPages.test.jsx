import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import LoginPage from "../LoginPage";
import RegisterPage from "../RegisterPage";
import ForgotPasswordPage from "../ForgotPasswordPage";
import SetPasswordPage from "../SetPasswordPage";

const mockLogin = jest.fn();
const mockRegister = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuthActions: () => ({
    login: mockLogin,
    register: mockRegister,
    signOut: jest.fn(),
    completeMfaLogin: jest.fn(),
  }),
}));

describe("auth pages", () => {
  beforeEach(() => {
    mockLogin.mockClear();
    mockRegister.mockClear();
  });

  test("register page shows the account creation flow", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/start practicing interviews with a setup that actually feels serious/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  test("forgot password page shows the recovery flow", () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/reset your password/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to sign in/i })).toBeInTheDocument();
  });

  test("set password page requires a secure setup token", () => {
    render(
      <MemoryRouter initialEntries={["/set-password"]}>
        <SetPasswordPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/set your password/i)).toBeInTheDocument();
    expect(screen.getByText(/needs a secure setup token/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set password/i })).toBeDisabled();
  });

  test("login page shows the sign-in flow", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/build interview confidence with realtime coaching/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
