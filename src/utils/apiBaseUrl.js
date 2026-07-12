const isLoopbackHost = (host) => host === "localhost" || host === "127.0.0.1" || host === "::1";

export function getApiBaseUrl() {
  const configured = String(process.env.REACT_APP_API_URL || "").trim();
  if (!configured) return "";

  try {
    const parsed = new URL(configured);
    if (isLoopbackHost(parsed.hostname)) {
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
      if (currentHost && !isLoopbackHost(currentHost)) {
        // In hosted environments never call loopback; use same-origin API.
        return "";
      }
    }
    return configured.replace(/\/+$/, "");
  } catch (error) {
    return configured.replace(/\/+$/, "");
  }
}

export function apiUrl(path, params) {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  const baseUrl = getApiBaseUrl();
  const url = baseUrl ? new URL(normalizedPath, `${baseUrl}/`) : new URL(normalizedPath, "http://local.app");

  if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  if (!baseUrl) {
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return url.toString();
}

export function wsUrl(path, params) {
  const fallbackOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8000";
  const baseUrl = getApiBaseUrl() || fallbackOrigin;
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;
  let url;

  try {
    url = new URL(normalizedPath, baseUrl);
  } catch (error) {
    url = new URL(normalizedPath, fallbackOrigin);
  }

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}
