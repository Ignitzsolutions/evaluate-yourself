import { apiUrl, getApiBaseUrl, wsUrl } from "../apiBaseUrl";

function mockLocation(url) {
  delete window.location;
  Object.defineProperty(window, "location", {
    value: new URL(url),
    writable: true,
    configurable: true,
  });
}

describe("getApiBaseUrl", () => {
  const originalEnv = process.env.REACT_APP_API_URL;
  const originalViteEnv = process.env.VITE_API_URL;
  const originalLocation = window.location.href;

  afterEach(() => {
    process.env.REACT_APP_API_URL = originalEnv;
    process.env.VITE_API_URL = originalViteEnv;
    mockLocation(originalLocation);
  });

  test("returns empty string for hosted origin with loopback api url", () => {
    process.env.REACT_APP_API_URL = "http://127.0.0.1:8000";
    mockLocation("https://project.example.com/dashboard");
    expect(getApiBaseUrl()).toBe("");
  });

  test("returns configured loopback api url when running locally", () => {
    process.env.REACT_APP_API_URL = "http://127.0.0.1:8000";
    mockLocation("http://localhost:3001/dashboard");
    expect(getApiBaseUrl()).toBe("http://127.0.0.1:8000");
  });

  test("ignores VITE_API_URL and uses the React app API variable only", () => {
    process.env.VITE_API_URL = "https://vite.example.com";
    process.env.REACT_APP_API_URL = "";
    expect(getApiBaseUrl()).toBe("");
  });
});

describe("apiUrl", () => {
  const originalEnv = process.env.REACT_APP_API_URL;
  const originalLocation = window.location.href;

  afterEach(() => {
    process.env.REACT_APP_API_URL = originalEnv;
    mockLocation(originalLocation);
  });

  test.each([
    {
      name: "same-origin path when api base is empty",
      env: "",
      currentUrl: "http://localhost:3000/dashboard",
      path: "/api/profile/status",
      params: undefined,
      expected: "/api/profile/status",
    },
    {
      name: "configured localhost base when running locally",
      env: "http://localhost:8000",
      currentUrl: "http://localhost:3000/dashboard",
      path: "/api/profile/status",
      params: undefined,
      expected: "http://localhost:8000/api/profile/status",
    },
    {
      name: "hosted loopback config falls back to same-origin",
      env: "http://localhost:8000",
      currentUrl: "https://app.example.com/dashboard",
      path: "/api/profile/status",
      params: undefined,
      expected: "/api/profile/status",
    },
    {
      name: "strips trailing slashes and preserves query params",
      env: "https://api.example.com///",
      currentUrl: "https://app.example.com/report/1",
      path: "/api/interview/reports?format=json",
      params: { limit: 25, empty: "", missing: null },
      expected: "https://api.example.com/api/interview/reports?format=json&limit=25",
    },
    {
      name: "adds a leading slash to paths",
      env: "",
      currentUrl: "http://localhost:3000/dashboard",
      path: "api/me",
      params: { refresh: true },
      expected: "/api/me?refresh=true",
    },
  ])("$name", ({ env, currentUrl, path, params, expected }) => {
    process.env.REACT_APP_API_URL = env;
    mockLocation(currentUrl);
    expect(apiUrl(path, params)).toBe(expected);
  });
});

describe("wsUrl", () => {
  const originalEnv = process.env.REACT_APP_API_URL;
  const originalLocation = window.location.href;

  afterEach(() => {
    process.env.REACT_APP_API_URL = originalEnv;
    mockLocation(originalLocation);
  });

  test.each([
    {
      name: "same-origin http becomes ws",
      env: "",
      currentUrl: "http://localhost:3000/dashboard",
      path: "/ws/gaze/session-1",
      params: { token: "abc" },
      expected: "ws://localhost:3000/ws/gaze/session-1?token=abc",
    },
    {
      name: "same-origin https becomes wss",
      env: "",
      currentUrl: "https://app.example.com/dashboard",
      path: "/ws/gaze/session-1",
      params: undefined,
      expected: "wss://app.example.com/ws/gaze/session-1",
    },
    {
      name: "configured api base controls websocket host",
      env: "https://api.example.com/",
      currentUrl: "https://app.example.com/dashboard",
      path: "ws",
      params: { token: "abc", empty: "" },
      expected: "wss://api.example.com/ws?token=abc",
    },
  ])("$name", ({ env, currentUrl, path, params, expected }) => {
    process.env.REACT_APP_API_URL = env;
    mockLocation(currentUrl);
    expect(wsUrl(path, params)).toBe(expected);
  });
});
