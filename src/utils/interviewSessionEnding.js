export const SESSION_END_ERROR_CODES = {
  EMPTY_CAPTURE: "EMPTY_CAPTURE",
  NO_CANDIDATE_AUDIO: "NO_CANDIDATE_AUDIO",
};

export function createSessionEndError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function isCaptureEndError(error) {
  return (
    error?.code === SESSION_END_ERROR_CODES.EMPTY_CAPTURE ||
    error?.code === SESSION_END_ERROR_CODES.NO_CANDIDATE_AUDIO
  );
}

export function getEndErrorPresentation(error) {
  if (error?.code === SESSION_END_ERROR_CODES.EMPTY_CAPTURE) {
    return {
      title: "No Interview Captured",
      description:
        "We didn’t capture any interview turns, so there’s nothing we can turn into a report yet. You can resume the session and try again, or end without saving.",
      primaryActionLabel: "Resume Interview",
    };
  }

  if (error?.code === SESSION_END_ERROR_CODES.NO_CANDIDATE_AUDIO) {
    return {
      title: "No Candidate Response Captured",
      description:
        "Sonia connected, but we didn’t capture a usable candidate answer. Check the microphone and transcript capture, then resume the interview or end without saving.",
      primaryActionLabel: "Resume Interview",
    };
  }

  return {
    title: "Couldn't Generate Report",
    description:
      "The interview is still connected. You can retry generating the report, or end without saving.",
    primaryActionLabel: "Retry",
  };
}
