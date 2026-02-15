import { getApiBaseUrl } from "../apiBaseUrl";

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
  const originalLocation = window.location.href;

  afterEach(() => {
    process.env.REACT_APP_API_URL = originalEnv;
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
});
