// src/utils/apiClient.js

export async function authFetch(url, token, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url, {
    ...options,
    headers,
  });
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
