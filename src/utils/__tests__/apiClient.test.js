import { authFetch, buildApiErrorFromResponse, getApiErrorMessage, isBackendUnavailableError } from "../apiClient";

describe("apiClient network error handling", () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  test("wraps fetch network failures as backend unavailable", async () => {
    global.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(authFetch("/api/profile/status", "token")).rejects.toMatchObject({
      code: "BACKEND_UNAVAILABLE",
    });
  });

  test("formats backend unavailable error for UI", () => {
    const error = new Error("Backend service is unavailable. Start the API server and try again.");
    error.code = "BACKEND_UNAVAILABLE";

    expect(isBackendUnavailableError(error)).toBe(true);
    expect(
      getApiErrorMessage(error, {
        backendLabel: "profile service",
      }),
    ).toBe("Cannot reach the profile service. Start the API server and try again.");
  });

  test("formats backend unavailable error for hosted UI without local-server copy", () => {
    const error = new Error("Backend service is unavailable.");
    error.code = "BACKEND_UNAVAILABLE";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        hostname: "app.example.com",
      },
    });

    expect(
      getApiErrorMessage(error, {
        backendLabel: "profile service",
      }),
    ).toBe("The profile service is temporarily unavailable. Please retry.");
  });

  test("parses structured backend errors into typed UI errors", async () => {
    const response = {
      status: 400,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          detail: {
            code: "TRIAL_CODE_EXPIRED",
            message: "Trial code expired",
            retryable: false,
          },
        }),
      ),
    };

    const error = await buildApiErrorFromResponse(response, {
      defaultMessage: "Fallback message",
    });

    expect(error.status).toBe(400);
    expect(error.code).toBe("TRIAL_CODE_EXPIRED");
    expect(error.userMessage).toBe("Trial code expired");
    expect(error.retryable).toBe(false);
    expect(getApiErrorMessage(error)).toBe("Trial code expired");
  });
});
