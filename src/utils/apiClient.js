// src/utils/apiClient.js

const BACKEND_UNAVAILABLE_CODE = "BACKEND_UNAVAILABLE";
const AUTH_REQUIRED_CODE = "AUTH_REQUIRED";

function isLoopbackHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isHostedEnvironment() {
  if (typeof window === "undefined") return false;
  return !isLoopbackHost(window.location.hostname);
}

function isFetchNetworkFailure(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "TypeError" &&
    (message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("load failed") ||
      message.includes("network request failed"))
  );
}

function isProxyBackendFailure(status, rawText) {
  const text = String(rawText || "").toLowerCase();
  return (
    status >= 500 &&
    text.includes("proxy") &&
    (text.includes("econnrefused") || text.includes("could not proxy") || text.includes("trying to proxy"))
  );
}

function buildBackendUnavailableError(url, error) {
  const wrapped = new Error("Backend service is unavailable. Start the API server and try again.");
  wrapped.code = BACKEND_UNAVAILABLE_CODE;
  wrapped.userMessage = wrapped.message;
  wrapped.retryable = true;
  wrapped.url = url;
  wrapped.cause = error;
  return wrapped;
}

function buildApiError({
  status,
  code,
  userMessage,
  retryable,
  detail,
}) {
  const error = new Error(userMessage || `Request failed (${status}).`);
  error.status = status;
  error.code = code || `HTTP_${status}`;
  error.userMessage = userMessage || error.message;
  error.retryable = Boolean(retryable);
  error.detail = detail;
  return error;
}

function defaultRetryableForStatus(status) {
  return status >= 500 || status === 408 || status === 429;
}

export async function authFetch(url, token, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    return await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    if (isFetchNetworkFailure(error)) {
      throw buildBackendUnavailableError(url, error);
    }
    throw error;
  }
}

export function isBackendUnavailableError(error) {
  return error?.code === BACKEND_UNAVAILABLE_CODE || isFetchNetworkFailure(error);
}

export function isAuthRequiredError(error) {
  return error?.code === AUTH_REQUIRED_CODE;
}

export function buildAuthRequiredError(message = "Authentication required.") {
  const error = new Error(message);
  error.code = AUTH_REQUIRED_CODE;
  error.userMessage = message;
  error.retryable = false;
  return error;
}

export async function buildApiErrorFromResponse(response, options = {}) {
  const {
    defaultMessage = `Request failed (${response?.status || "unknown"}).`,
    defaultCode,
  } = options;

  const status = Number(response?.status || 0);
  const rawText = await response.text().catch(() => "");
  let parsed = null;

  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }

  if (isProxyBackendFailure(status, rawText)) {
    return buildBackendUnavailableError(response?.url || "", new Error(rawText));
  }

  const detail = parsed?.detail ?? parsed ?? rawText;
  const fallbackCode = defaultCode || `HTTP_${status || "UNKNOWN"}`;

  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    return buildApiError({
      status,
      code: detail.code || fallbackCode,
      userMessage:
        String(detail.message || detail.userMessage || detail.detail || "").trim() || defaultMessage,
      retryable:
        typeof detail.retryable === "boolean" ? detail.retryable : defaultRetryableForStatus(status),
      detail,
    });
  }

  const message = String(detail || "").trim() || defaultMessage;
  return buildApiError({
    status,
    code: fallbackCode,
    userMessage: message,
    retryable: defaultRetryableForStatus(status),
    detail,
  });
}

export async function throwForResponse(response, options = {}) {
  if (response.ok) {
    return response;
  }
  throw await buildApiErrorFromResponse(response, options);
}

export function getApiErrorMessage(error, options = {}) {
  const { backendLabel = "backend service", defaultMessage = "Request failed." } = options;
  if (isBackendUnavailableError(error)) {
    if (isHostedEnvironment()) {
      return `The ${backendLabel} is temporarily unavailable. Please retry.`;
    }
    return `Cannot reach the ${backendLabel}. Start the API server and try again.`;
  }
  const userMessage = String(error?.userMessage || "").trim();
  if (userMessage) {
    return userMessage;
  }
  const message = String(error?.message || "").trim();
  return message || defaultMessage;
}
