export function classifyOnboardingGuardError(error, detectors) {
  const {
    isAuthRequiredError,
    isBackendUnavailableError,
  } = detectors;

  if (isAuthRequiredError(error)) {
    return "auth_required";
  }
  if (isBackendUnavailableError(error)) {
    return "backend_unavailable";
  }
  return "generic";
}
