const { expect, test } = require("@playwright/test");

const BASE_URL = process.env.PW_CERT_BASE_URL || "";
const SESSION_URL = process.env.PW_CERT_SESSION_URL || "";
const STORAGE_STATE = process.env.PW_CERT_STORAGE_STATE || "";

test.use(STORAGE_STATE ? { storageState: STORAGE_STATE } : {});

test.describe("hosted runtime certification", () => {
  test("captures structured runtime findings for the deployed interview flow", async ({ page }, testInfo) => {
    test.skip(!BASE_URL, "PW_CERT_BASE_URL is required for hosted certification.");
    test.skip(!SESSION_URL, "PW_CERT_SESSION_URL is required for hosted certification.");
    test.skip(!STORAGE_STATE, "PW_CERT_STORAGE_STATE is required for authenticated hosted certification.");

    const findings = [];
    const recordFinding = (title, body) => {
      findings.push({ title, body });
    };

    page.on("console", (message) => {
      if (message.type() === "error") {
        recordFinding("console-error", message.text());
      }
    });
    page.on("pageerror", (error) => {
      recordFinding("page-error", String(error));
    });

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.goto(SESSION_URL, { waitUntil: "networkidle" });

    const statusBadge = page.getByText(/Listening|Sonia Speaking|Thinking|Recovery Mode|Resuming/i).first();
    await expect(statusBadge).toBeVisible({ timeout: 30000 });

    const transcriptRegion = page.getByText(/Sonia|Interviewer|Candidate|You/i).first();
    if (!(await transcriptRegion.isVisible().catch(() => false))) {
      recordFinding("transcript-missing", "Transcript UI did not become visible on the hosted interview screen.");
    }

    await testInfo.attach("runtime-findings", {
      body: JSON.stringify(
        {
          baseUrl: BASE_URL,
          sessionUrl: SESSION_URL,
          findings,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });
});
