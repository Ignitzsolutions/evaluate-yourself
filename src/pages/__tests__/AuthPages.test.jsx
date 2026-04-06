import React from "react";
import { render, screen } from "@testing-library/react";

import LoginPage from "../LoginPage";
import RegisterPage from "../RegisterPage";
import ForgotPasswordPage from "../ForgotPasswordPage";

const mockSignIn = jest.fn((props) => <div data-testid="sign-in-props">{JSON.stringify(props)}</div>);
const mockSignUp = jest.fn((props) => <div data-testid="sign-up-props">{JSON.stringify(props)}</div>);

jest.mock("@clerk/clerk-react", () => ({
  SignIn: (props) => mockSignIn(props),
  SignUp: (props) => mockSignUp(props),
}));

describe("auth pages", () => {
  beforeEach(() => {
    mockSignIn.mockClear();
    mockSignUp.mockClear();
  });

  test("register page mounts SignUp on the register path", () => {
    render(<RegisterPage />);

    expect(screen.getByText(/start practicing interviews/i)).toBeInTheDocument();
    expect(mockSignUp.mock.calls[0][0]).toEqual(expect.objectContaining({
      path: "/register",
      routing: "path",
      signInUrl: "/login",
    }));
  });

  test("forgot password page mounts SignIn on the forgot-password path", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText(/reset access without guessing/i)).toBeInTheDocument();
    expect(mockSignIn.mock.calls[0][0]).toEqual(expect.objectContaining({
      path: "/forgot-password",
      routing: "path",
      initialStep: "forgot-password",
    }));
  });

  test("login page keeps the dedicated sign-in route", () => {
    render(<LoginPage />);

    expect(screen.getByText(/build interview confidence/i)).toBeInTheDocument();
    expect(mockSignIn.mock.calls[0][0]).toEqual(expect.objectContaining({
      path: "/login",
      routing: "path",
      signUpUrl: "/register",
    }));
  });
});
