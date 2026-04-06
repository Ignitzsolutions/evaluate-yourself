import { classifyOnboardingGuardError } from "../onboardingGuardState";

describe("classifyOnboardingGuardError", () => {
  test("treats auth errors as auth_required", () => {
    const error = { code: "AUTH_REQUIRED" };

    expect(
      classifyOnboardingGuardError(error, {
        isAuthRequiredError: (candidate) => candidate?.code === "AUTH_REQUIRED",
        isBackendUnavailableError: () => false,
      }),
    ).toBe("auth_required");
  });

  test("treats backend failures as backend_unavailable", () => {
    const error = { code: "BACKEND_UNAVAILABLE" };

    expect(
      classifyOnboardingGuardError(error, {
        isAuthRequiredError: () => false,
        isBackendUnavailableError: (candidate) => candidate?.code === "BACKEND_UNAVAILABLE",
      }),
    ).toBe("backend_unavailable");
  });

  test("falls back to generic for other errors", () => {
    expect(
      classifyOnboardingGuardError(new Error("boom"), {
        isAuthRequiredError: () => false,
        isBackendUnavailableError: () => false,
      }),
    ).toBe("generic");
  });
});
