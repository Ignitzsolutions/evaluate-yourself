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
    const checks = {};
    const recordFinding = (title, body, severity = "warning") => {
      findings.push({ title, body, severity });
    };
    const markCheck = (name, status, detail) => {
      checks[name] = { status, detail };
    };
    const requireVisible = async (name, locator, detail, options = {}) => {
      try {
        await expect(locator).toBeVisible(options);
        markCheck(name, "passed", detail);
      } catch (error) {
        markCheck(name, "failed", detail);
        recordFinding(name, detail, "failure");
        throw error;
      }
    };
    const observeOptional = async (name, locator, positiveDetail, missingDetail, options = {}) => {
      try {
        await expect(locator).toBeVisible(options);
        markCheck(name, "observed", positiveDetail);
        return true;
      } catch {
        markCheck(name, "not_observed", missingDetail);
        recordFinding(name, missingDetail);
        return false;
      }
    };

    page.on("console", (message) => {
      if (message.type() === "error") {
        recordFinding("console-error", message.text());
      }
    });
    page.on("pageerror", (error) => {
      recordFinding("page-error", String(error));
    });

    try {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.goto(SESSION_URL, { waitUntil: "networkidle" });

      await requireVisible(
        "sonia_intro_state",
        page.getByText(/Sonia interviewer avatar|Sonia/i).first(),
        "Expected Sonia's live stage to render at session start.",
        { timeout: 30000 },
      );

      const statusBadge = page.getByText(/Listening|Sonia Speaking|Thinking|Recovery Mode|Resuming|Live/i).first();
      await requireVisible(
        "runtime_status_badges",
        statusBadge,
        "Expected runtime status badges to be visible during the hosted session.",
        { timeout: 30000 },
      );

      const speakingBadge = page.getByText(/Sonia Speaking/i).first();
      const listeningBadge = page.getByText(/Listening/i).first();
      const sawSpeaking = await observeOptional(
        "sonia_speaking_transition",
        speakingBadge,
        "Observed Sonia speaking status during the live session.",
        "Did not observe a Sonia speaking status during this hosted run.",
        { timeout: 45000 },
      );
      const sawListening = await observeOptional(
        "listening_transition",
        listeningBadge,
        "Observed candidate listening/listening-active status during the live session.",
        "Did not observe a listening status during this hosted run.",
        { timeout: 45000 },
      );
      if (sawSpeaking && sawListening) {
        markCheck("listening_speaking_badges", "passed", "Observed both Sonia speaking and listening states.");
      } else if (!checks.listening_speaking_badges) {
        markCheck(
          "listening_speaking_badges",
          "partial",
          "Only part of the expected speaking/listening badge sequence was observed during this hosted run.",
        );
      }

      const bargeInSignal = page.getByText(/Candidate barge-in detected\. Sonia paused so you can continue\./i).first();
      await observeOptional(
        "barge_in_behavior",
        bargeInSignal,
        "Observed explicit barge-in recovery messaging while Sonia was speaking.",
        "Did not observe the candidate barge-in recovery message during this hosted run.",
        { timeout: 30000 },
      );

      const degradedSignal = page
        .getByText(/browser fallback is active|Recovery Mode|Connection issue detected|Internet disconnected/i)
        .first();
      await observeOptional(
        "degraded_warning_behavior",
        degradedSignal,
        "Observed degraded or fallback runtime warning behavior.",
        "Did not observe degraded or fallback warning UI during this hosted run.",
        { timeout: 30000 },
      );

      const endCallButton = page.getByRole("button", { name: /end call/i }).first();
      await requireVisible(
        "end_call_control",
        endCallButton,
        "Expected the end call control to be visible before finishing the interview.",
        { timeout: 30000 },
      );

      await endCallButton.click();

      const retryDialog = page.getByRole("button", { name: /Retry|Resume Interview|End Without Saving/i }).first();
      if (await retryDialog.isVisible().catch(() => false)) {
        markCheck("end_session_save", "failed", "Ending the interview opened a recovery dialog instead of the report flow.");
        recordFinding(
          "end-session-save-blocked",
          "Ending the interview opened a recovery dialog instead of reaching the report flow.",
          "failure",
        );
      }

      try {
        await expect(page).toHaveURL(/\/report\//, { timeout: 90000 });
        markCheck("end_session_save", "passed", "Ending the interview navigated to the report flow.");
      } catch (error) {
        recordFinding(
          "report-navigation-missing",
          `Expected report navigation after ending the call, but remained on ${page.url()}.`,
          "failure",
        );
        throw error;
      }

      const reportHeading = page.getByText(/Interview Report|Interview Analysis|Overall Score|Evaluation Summary/i).first();
      await requireVisible(
        "report_load",
        reportHeading,
        "Expected the report page heading after ending the interview.",
        { timeout: 30000 },
      );

      await requireVisible(
        "report_back_to_dashboard",
        page.getByRole("button", { name: /Back to Dashboard/i }).first(),
        "Expected the report page to expose the back-to-dashboard control.",
        { timeout: 30000 },
      );
      await requireVisible(
        "report_download_pdf",
        page.getByRole("button", { name: /Download PDF/i }).first(),
        "Expected the report page to expose PDF download controls.",
        { timeout: 30000 },
      );
    } catch (error) {
      throw error;
    } finally {
      await testInfo.attach("runtime-findings", {
        body: JSON.stringify(
          {
            baseUrl: BASE_URL,
            sessionUrl: SESSION_URL,
            findings,
            checks,
            finalUrl: page.url(),
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    }
  });
});
