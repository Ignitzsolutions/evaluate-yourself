const { defineConfig, devices } = require("@playwright/test");

const PORT = process.env.PW_PORT || "4173";
const HOST = process.env.PW_HOST || "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.PW_CERT_BASE_URL
    ? undefined
    : {
        command: `HOST=${HOST} PORT=${PORT} BROWSER=none npm start`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
