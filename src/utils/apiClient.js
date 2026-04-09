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

export const adminApi = {
  summary: (baseUrl, token) => authFetch(`${baseUrl}/api/admin/summary`, token, { method: "GET" }),
  dashboardOverview: (baseUrl, token) => authFetch(`${baseUrl}/api/admin/dashboard/overview`, token, { method: "GET" }),
  candidates: (baseUrl, token, query = "") => authFetch(`${baseUrl}/api/admin/candidates${query}`, token, { method: "GET" }),
  candidateDetail: (baseUrl, token, clerkUserId) => authFetch(`${baseUrl}/api/admin/candidates/${encodeURIComponent(clerkUserId)}`, token, { method: "GET" }),
  deactivateCandidate: (baseUrl, token, clerkUserId) => authFetch(`${baseUrl}/api/admin/candidates/${encodeURIComponent(clerkUserId)}/deactivate`, token, { method: "POST" }),
  softDeleteCandidate: (baseUrl, token, clerkUserId) => authFetch(`${baseUrl}/api/admin/candidates/${encodeURIComponent(clerkUserId)}`, token, { method: "DELETE" }),
  activeUsers: (baseUrl, token, query = "") => authFetch(`${baseUrl}/api/admin/active-users${query}`, token, { method: "GET" }),
  interviews: (baseUrl, token, query = "") => authFetch(`${baseUrl}/api/admin/interviews${query}`, token, { method: "GET" }),
  reports: (baseUrl, token, query = "") => authFetch(`${baseUrl}/api/admin/reports${query}`, token, { method: "GET" }),
  config: (baseUrl, token) => authFetch(`${baseUrl}/api/admin/config`, token, { method: "GET" }),
  createExport: (baseUrl, token, payload) =>
    authFetch(`${baseUrl}/api/admin/exports`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  exports: (baseUrl, token, query = "") => authFetch(`${baseUrl}/api/admin/exports${query}`, token, { method: "GET" }),
  exportDetail: (baseUrl, token, exportId) => authFetch(`${baseUrl}/api/admin/exports/${encodeURIComponent(exportId)}`, token, { method: "GET" }),
  exportDownloadUrl: (baseUrl, exportId) => `${baseUrl}/api/admin/exports/${encodeURIComponent(exportId)}/download`,
  createTrialCode: (baseUrl, token, payload) =>
    authFetch(`${baseUrl}/api/admin/trial-codes`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  trialCodes: (baseUrl, token, query = "") => authFetch(`${baseUrl}/api/admin/trial-codes${query}`, token, { method: "GET" }),
  deleteTrialCode: (baseUrl, token, codeId) => authFetch(`${baseUrl}/api/admin/trial-codes/${encodeURIComponent(codeId)}`, token, { method: "DELETE" }),
};
