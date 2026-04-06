import {
  createSessionEndError,
  getEndErrorPresentation,
  isCaptureEndError,
  SESSION_END_ERROR_CODES,
} from "../interviewSessionEnding";

describe("interviewSessionEnding", () => {
  test("marks empty capture as a capture-specific end error", () => {
    const error = createSessionEndError(
      SESSION_END_ERROR_CODES.EMPTY_CAPTURE,
      "No interview turns were captured.",
    );

    expect(isCaptureEndError(error)).toBe(true);
    expect(getEndErrorPresentation(error)).toMatchObject({
      title: "No Interview Captured",
      primaryActionLabel: "Resume Interview",
    });
  });

  test("keeps generic save failures on the retry path", () => {
    const error = new Error("Save failed");

    expect(isCaptureEndError(error)).toBe(false);
    expect(getEndErrorPresentation(error)).toMatchObject({
      title: "Couldn't Generate Report",
      primaryActionLabel: "Retry",
    });
  });
});
