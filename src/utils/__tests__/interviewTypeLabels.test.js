import { formatInterviewTypeLabel } from "../interviewTypeLabels";

describe("formatInterviewTypeLabel", () => {
  test("maps mixed to 360 Interview", () => {
    expect(formatInterviewTypeLabel("mixed")).toBe("360 Interview");
  });

  test("formats known types", () => {
    expect(formatInterviewTypeLabel("technical")).toBe("Technical");
    expect(formatInterviewTypeLabel("behavioral")).toBe("Behavioral");
  });
});

