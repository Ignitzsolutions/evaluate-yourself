import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import LoginPage from "../LoginPage";
import RegisterPage from "../RegisterPage";
import ForgotPasswordPage from "../ForgotPasswordPage";

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

  test("register page renders with registration form", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/start practicing interviews with a setup that actually feels serious/i)).toBeInTheDocument();
  });

  test("forgot password page renders with password recovery form", () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/password recovery/i)).toBeInTheDocument();
  });

  test("login page renders with login form", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/build interview confidence with realtime coaching/i)).toBeInTheDocument();
  });
});
