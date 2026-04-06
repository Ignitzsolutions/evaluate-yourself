import { authFetch, getApiErrorMessage, isBackendUnavailableError } from "../apiClient";

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
});
